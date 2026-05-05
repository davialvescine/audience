'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import {
  animationVariants,
  customPositionStyles,
  DEFAULT_TELAO_CONFIG,
  positionStyles,
  shadowStyle,
  type TelaoConfig,
} from '@/lib/telao/config';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

import { snapToGrid } from './snapToGrid';

type Submission = {
  id: string;
  name: string;
  comment: string;
  created_at: string;
};

type Props = {
  slug: string;
  eventId: string;
  eventName: string;
  config: TelaoConfig;
  preview?: boolean;
};

export function TelaoClient({ slug, eventId, eventName, config: initialConfig, preview = false }: Props) {
  // Config comes from SSR (page.tsx is force-dynamic so F5 always picks
  // up DB changes). Preview mode receives live updates via postMessage
  // from the admin TelaoTab. For non-preview /telao tabs, refresh after
  // saving config in admin to see changes.
  const [config, setConfig] = useState<TelaoConfig>(initialConfig);
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
    // Dedup por id+sent_at: a mesma submission re-enviada (botao "Mostrar
    // novamente") tem novo sent_at, entao conta como nova entrada na fila.
    // Sem dedup local: o lastSeenAt no poll ja garante que so pegamos
    // submissions com sent_at maior que o ultimo visto. Reshow gera novo
    // sent_at, entao volta como entrada nova.
    const enqueue = (row: Submission & { sent_at?: string | null }) => {
      queueRef.current.push({
        id: `${row.id}-${row.sent_at ?? Date.now()}`,
        name: row.name,
        comment: row.comment,
        created_at: row.created_at,
      });
    };

    // Polling via security-definer RPC. RLS sobre submissions e
    // owner-only — anon nao pode SELECT direto. A RPC e scoped ao slug
    // e seguramente expoe so os comentarios sent desse evento.
    let lastSeenAt = new Date().toISOString();
    const poll = async () => {
      const { data, error } = await supabase.rpc('get_telao_submissions_since', {
        p_slug: slug,
        p_since: lastSeenAt,
      });
      if (error || !data || data.length === 0) return;
      for (const row of data) {
        if (row.sent_at && row.sent_at > lastSeenAt) lastSeenAt = row.sent_at;
        enqueue({
          id: row.id,
          name: row.name,
          comment: row.comment,
          created_at: row.created_at,
          sent_at: row.sent_at,
        });
      }
    };
    const pollTimer = setInterval(() => { void poll(); }, 2000);

    // Poll config tambem — quando o dono muda cor/posicao no admin,
    // todas as telas /telao abertas (OBS, PiP, desktop) atualizam em
    // ate 5s sem precisar recarregar.
    const pollConfig = async () => {
      const { data, error } = await supabase.rpc('get_telao_config', { p_slug: slug });
      if (error || !data || data.length === 0) return;
      const event = data[0];
      if (!event) return;
      const overrides = (event.configs as Record<string, Partial<TelaoConfig>> | null) ?? {};
      // mode no preview e ignorado; em live, usamos o config global.
      // (per-mode override e aplicado no SSR via page.tsx, podemos
      // honrar tambem aqui depois se precisar.)
      const fresh: TelaoConfig = {
        ...DEFAULT_TELAO_CONFIG,
        ...((event.config as Partial<TelaoConfig>) ?? {}),
        ...(overrides.global ?? {}),
      };
      setConfig((cur) => (JSON.stringify(cur) === JSON.stringify(fresh) ? cur : fresh));
    };
    const cfgTimer = setInterval(() => { void pollConfig(); }, 5000);

    return () => {
      clearInterval(pollTimer);
      clearInterval(cfgTimer);
    };
  }, [eventId, slug, preview]);

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
    // Apos a animacao de saida, restaura o sample estatico — operador
    // continua vendo o card no preview mesmo depois do ciclo terminar.
    const restoreTimer = setTimeout(
      () => {
        setVisible([
          {
            id: `preview-${previewSample.name}-${previewSample.comment}`,
            name: previewSample.name || 'Nome de exemplo',
            comment: previewSample.comment || 'Mensagem de exemplo aparece aqui.',
            created_at: new Date().toISOString(),
          },
        ]);
      },
      250 + config.displaySeconds * 1000 + 600,
    );
    return () => {
      clearTimeout(enterTimer);
      clearTimeout(exitTimer);
      clearTimeout(restoreTimer);
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
  const [dragHud, setDragHud] = useState<{ x: number; y: number } | null>(null);

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
    setDragHud({ x: baseX, y: baseY });
    el.setPointerCapture(e.pointerId);
    e.preventDefault();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = ((e.clientX - d.startX) / 1920) * 100;
    const dy = ((e.clientY - d.startY) / 1080) * 100;
    // Snap em 0/25/50/75/100% quando dentro de 3% — o operador agarra
    // os cantos/centro sem precisar mirar pixel-perfect.
    const nx = snapToGrid(d.baseX + dx, 3);
    const ny = snapToGrid(d.baseY + dy, 3);
    d.lastX = nx;
    d.lastY = ny;
    setDragHud({ x: nx, y: ny });
    setConfig((c) => ({ ...c, posXPct: nx, posYPct: ny }));
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    rootRef.current?.releasePointerCapture(e.pointerId);
    dragRef.current = null;
    setDragHud(null);
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
                <span style={{ marginLeft: 8, opacity: 0.6 }} suppressHydrationWarning>
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
      {preview && dragHud ? (
        <div
          style={{
            position: 'fixed',
            top: 16,
            left: 16,
            background: 'rgba(0,0,0,0.78)',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: 8,
            fontFamily: 'ui-monospace, monospace',
            fontSize: 14,
            pointerEvents: 'none',
            zIndex: 1000,
          }}
        >
          X: {Math.round(dragHud.x)}% · Y: {Math.round(dragHud.y)}%
        </div>
      ) : null}
    </div>
  );
}
