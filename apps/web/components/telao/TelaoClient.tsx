'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import {
  animationVariants,
  customPositionStyles,
  positionStyles,
  shadowStyle,
  type TelaoConfig,
} from '@/lib/telao/config';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

import { useLiveTelaoConfig } from './useLiveTelaoConfig';

type Submission = {
  id: string;
  name: string;
  comment: string;
  created_at: string;
};

type Props = {
  eventId: string;
  eventName: string;
  config: TelaoConfig;
  preview?: boolean;
};

export function TelaoClient({ eventId, eventName, config: initialConfig, preview = false }: Props) {
  // In preview, config is driven by postMessage from the admin TelaoTab.
  // In live mode, we subscribe to events.telao_config so any save in the
  // admin (autosave) propagates to all open /telao tabs without refresh.
  const liveConfig = useLiveTelaoConfig(eventId, initialConfig, !preview);
  const [previewConfig, setPreviewConfig] = useState<TelaoConfig>(initialConfig);
  const config = preview ? previewConfig : liveConfig;
  const setConfig = setPreviewConfig;
  const [visible, setVisible] = useState<Submission[]>([]);
  const queueRef = useRef<Submission[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());

  const [previewSample, setPreviewSample] = useState<{ name: string; comment: string }>({
    name: 'João da Silva',
    comment: 'Que evento incrível! Deus abençoe todos vocês.',
  });

  const [playCycleId, setPlayCycleId] = useState(0);

  // Listen for live config updates via postMessage when in preview mode
  useEffect(() => {
    if (!preview) return;
    const handler = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      const data = e.data as {
        type?: string;
        config?: TelaoConfig;
        sample?: { name: string; comment: string };
      };
      if (data.type === 'telao-config-update' && data.config) {
        setConfig(data.config);
      }
      if (data.type === 'telao-sample-update' && data.sample) {
        setPreviewSample(data.sample);
      }
      if (data.type === 'telao-play-cycle') {
        setPlayCycleId((id) => id + 1);
      }
    };
    window.addEventListener('message', handler);
    // Tell parent we're ready (parent then sends initial config)
    window.parent.postMessage({ type: 'telao-preview-ready' }, window.location.origin);
    return () => window.removeEventListener('message', handler);
  }, [preview]);

  // Subscribe to new sent submissions (Realtime) + polling fallback every 3s.
  // Belt-and-suspenders: if Realtime is blocked (corporate networks,
  // CDN/proxy, expired subscription) the poll catches up.
  useEffect(() => {
    if (preview) return;
    const supabase = getSupabaseBrowserClient();
    const enqueue = (row: Submission) => {
      if (seenIdsRef.current.has(row.id)) return;
      seenIdsRef.current.add(row.id);
      queueRef.current.push({
        id: row.id,
        name: row.name,
        comment: row.comment,
        created_at: row.created_at,
      });
    };

    const channel = supabase
      .channel(`telao:${eventId}`, { config: { broadcast: { self: false } } })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'submissions',
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const row = payload.new as Submission & { status: string };
          if (row.status !== 'sent') return;
          enqueue(row);
        },
      )
      // Broadcast diagnostic — fired by the "Disparar teste" button in admin.
      // Doesn't depend on postgres_changes / publication / RLS — pure WebSocket.
      // If this works but postgres_changes doesn't, the issue is in WAL/RLS path.
      .on('broadcast', { event: 'test_message' }, ({ payload }) => {
        const p = payload as { name?: string; comment?: string };
        enqueue({
          id: `test-${Date.now()}`,
          name: p.name ?? 'TESTE',
          comment: p.comment ?? 'Mensagem de teste',
          created_at: new Date().toISOString(),
        });
      })
      .subscribe();

    // Polling fallback — fetches recent sent submissions and enqueues new ones.
    // The seenIds Set guarantees we never display duplicates regardless of source.
    let lastSeenAt = new Date().toISOString();
    const poll = async () => {
      const { data, error } = await supabase
        .from('submissions')
        .select('id, name, comment, created_at, sent_at, status')
        .eq('event_id', eventId)
        .eq('status', 'sent')
        .gt('sent_at', lastSeenAt)
        .order('sent_at', { ascending: true })
        .limit(20);
      if (error) return;
      if (data && data.length > 0) {
        for (const row of data) {
          if (row.sent_at && row.sent_at > lastSeenAt) lastSeenAt = row.sent_at;
          enqueue(row as Submission);
        }
      }
    };
    const pollTimer = setInterval(() => { void poll(); }, 3000);

    return () => {
      void supabase.removeChannel(channel);
      clearInterval(pollTimer);
    };
  }, [eventId, preview]);

  // Preview default state: render the sample message statically when no cycle is running
  useEffect(() => {
    if (!preview) return;
    if (playCycleId > 0) return; // a cycle is in flight; don't override
    setVisible([
      {
        id: `preview-${previewSample.name}-${previewSample.comment}`,
        name: previewSample.name || 'Nome de exemplo',
        comment: previewSample.comment || 'Mensagem de exemplo aparece aqui.',
        created_at: new Date().toISOString(),
      },
    ]);
  }, [preview, playCycleId, previewSample]);

  // Preview enter/exit cycle: triggered by parent's "Tocar entrada e saída" button
  useEffect(() => {
    if (!preview) return;
    if (playCycleId === 0) return; // not triggered yet
    setVisible([]); // clear so AnimatePresence registers the next push as a fresh enter
    const enterTimer = setTimeout(() => {
      setVisible([
        {
          id: `cycle-${playCycleId}`,
          name: previewSample.name || 'Nome de exemplo',
          comment: previewSample.comment || 'Mensagem de exemplo aparece aqui.',
          created_at: new Date().toISOString(),
        },
      ]);
    }, 250);
    const exitTimer = setTimeout(
      () => {
        setVisible([]);
      },
      250 + config.displaySeconds * 1000,
    );
    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
    };
  }, [playCycleId, preview, previewSample, config.displaySeconds]);

  // Live tick (non-preview): pull from queue, respect maxConcurrent and displaySeconds
  useEffect(() => {
    if (preview) return;
    const tick = setInterval(() => {
      if (queueRef.current.length === 0) return;
      setVisible((cur) => {
        if (cur.length >= config.maxConcurrent) return cur;
        const next = queueRef.current.shift();
        if (!next) return cur;
        const removeAfter = config.displaySeconds * 1000;
        setTimeout(() => {
          setVisible((cur2) => cur2.filter((m) => m.id !== next.id));
        }, removeAfter);
        return [...cur, next];
      });
    }, 500);
    return () => clearInterval(tick);
  }, [preview, config.maxConcurrent, config.displaySeconds]);

  const variants = animationVariants(config.animation);
  const hasCustomPos =
    typeof config.posXPct === 'number' && typeof config.posYPct === 'number';
  const positionStyle = hasCustomPos
    ? customPositionStyles(config.posXPct as number, config.posYPct as number)
    : positionStyles(config.position);

  // Drag-to-position (preview only). The preview iframe runs at 1920x1080
  // native, so pointer.clientX/Y are already in stage coords — no scale math.
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    lastX: number;
    lastY: number;
  } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!preview) return;
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const baseX = ((rect.left + rect.width / 2) / 1920) * 100;
    const baseY = ((rect.top + rect.height / 2) / 1080) * 100;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      baseX,
      baseY,
      lastX: baseX,
      lastY: baseY,
    };
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = ((e.clientX - d.startX) / 1920) * 100;
    const dy = ((e.clientY - d.startY) / 1080) * 100;
    // Clamp only the card's center to the stage. The card may extend
    // past the edge if widthPct/height are large — user can shrink the
    // card via the Largura/Altura sliders if they don't want overflow.
    const nx = Math.max(0, Math.min(100, d.baseX + dx));
    const ny = Math.max(0, Math.min(100, d.baseY + dy));
    d.lastX = nx;
    d.lastY = ny;
    setConfig((c) => ({ ...c, posXPct: nx, posYPct: ny }));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    rootRef.current?.releasePointerCapture(e.pointerId);
    dragRef.current = null;
    // Tell parent so autosave persists the new coords.
    if (typeof window !== 'undefined' && window.parent !== window) {
      window.parent.postMessage(
        {
          type: 'telao-position-update',
          posXPct: d.lastX,
          posYPct: d.lastY,
        },
        window.location.origin,
      );
    }
  };

  return (
    <div
      id="telao-root"
      ref={rootRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        ...positionStyle,
        width: `${config.widthPct}%`,
        maxWidth: '100vw',
        fontFamily: config.fontFamily,
        cursor: preview ? (dragRef.current ? 'grabbing' : 'grab') : undefined,
        userSelect: preview ? 'none' : undefined,
        touchAction: preview ? 'none' : undefined,
      }}
    >
      <AnimatePresence>
        {visible.map((m) => (
          <motion.div
            key={`${m.id}-${config.animation}-${config.position}-${config.fontSizePx}-${config.cardBg}-${config.cardText}-${config.borderRadius}-${config.shadow}-${config.backdropBlur}-${config.widthPct}-${config.heightPx}`}
            initial={variants.initial}
            animate={variants.animate}
            exit={variants.exit}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="mb-3"
            style={{
              background: config.cardBg,
              color: config.cardText,
              borderRadius: `${config.borderRadius}px`,
              boxShadow: shadowStyle(config.shadow),
              backdropFilter: config.backdropBlur > 0 ? `blur(${config.backdropBlur}px)` : undefined,
              WebkitBackdropFilter: config.backdropBlur > 0 ? `blur(${config.backdropBlur}px)` : undefined,
              padding: `${Math.round(config.fontSizePx * 0.6)}px ${Math.round(config.fontSizePx * 0.85)}px`,
              fontSize: `${config.fontSizePx}px`,
              lineHeight: 1.3,
              minHeight: config.heightPx > 0 ? `${config.heightPx}px` : undefined,
              display: config.heightPx > 0 ? 'flex' : undefined,
              flexDirection: config.heightPx > 0 ? 'column' : undefined,
              justifyContent: config.heightPx > 0 ? 'center' : undefined,
            }}
          >
            <div
              style={{
                fontSize: `${Math.round(config.fontSizePx * 0.55)}px`,
                opacity: 0.75,
                fontWeight: 600,
                letterSpacing: '0.02em',
                marginBottom: '0.25em',
              }}
            >
              {config.showEventName ? <span style={{ marginRight: 8 }}>{eventName} ·</span> : null}
              {m.name}
              {config.showTimestamp ? (
                <span style={{ marginLeft: 8, opacity: 0.6 }}>
                  {new Date(m.created_at).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              ) : null}
            </div>
            <div style={{ fontWeight: 500, wordBreak: 'break-word' }}>{m.comment}</div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
