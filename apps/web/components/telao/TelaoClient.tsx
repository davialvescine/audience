'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';

import {
  animationVariants,
  positionStyles,
  shadowClass,
  type TelaoConfig,
} from '@/lib/telao/config';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

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
  const [config, setConfig] = useState<TelaoConfig>(initialConfig);
  const [visible, setVisible] = useState<Submission[]>([]);
  const queueRef = useRef<Submission[]>([]);
  const seenIdsRef = useRef<Set<string>>(new Set());

  const [previewSample, setPreviewSample] = useState<{ name: string; comment: string }>({
    name: 'João da Silva',
    comment: 'Que evento incrível! Deus abençoe todos vocês.',
  });

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
    };
    window.addEventListener('message', handler);
    // Tell parent we're ready (parent then sends initial config)
    window.parent.postMessage({ type: 'telao-preview-ready' }, window.location.origin);
    return () => window.removeEventListener('message', handler);
  }, [preview]);

  // Subscribe to new sent submissions
  useEffect(() => {
    if (preview) return;
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`telao:${eventId}`)
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
          if (seenIdsRef.current.has(row.id)) return;
          seenIdsRef.current.add(row.id);
          queueRef.current.push({ id: row.id, name: row.name, comment: row.comment, created_at: row.created_at });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, preview]);

  // Display loop — pulls from queue, respects maxConcurrent and displaySeconds
  useEffect(() => {
    if (preview) {
      // Show one demo message — re-render whenever sample changes
      setVisible([
        {
          id: `preview-${previewSample.name}-${previewSample.comment}`,
          name: previewSample.name || 'Nome de exemplo',
          comment: previewSample.comment || 'Mensagem de exemplo aparece aqui.',
          created_at: new Date().toISOString(),
        },
      ]);
      return;
    }

    const tick = setInterval(() => {
      if (queueRef.current.length === 0) return;
      if (visible.length >= config.maxConcurrent) return;
      const next = queueRef.current.shift();
      if (!next) return;
      setVisible((cur) => [...cur, next]);
      const removeAfter = config.displaySeconds * 1000;
      setTimeout(() => {
        setVisible((cur) => cur.filter((m) => m.id !== next.id));
      }, removeAfter);
    }, 500);

    return () => clearInterval(tick);
  }, [config.maxConcurrent, config.displaySeconds, visible.length, preview, previewSample]);

  const variants = animationVariants(config.animation);

  return (
    <div
      id="telao-root"
      style={{
        ...positionStyles(config.position),
        width: `${config.widthPct}%`,
        maxWidth: '100vw',
        fontFamily: config.fontFamily,
      }}
    >
      <AnimatePresence>
        {visible.map((m) => (
          <motion.div
            key={m.id}
            initial={variants.initial}
            animate={variants.animate}
            exit={variants.exit}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className={`mb-3 ${shadowClass(config.shadow)}`}
            style={{
              background: config.cardBg,
              color: config.cardText,
              borderRadius: `${config.borderRadius}px`,
              backdropFilter: config.backdropBlur > 0 ? `blur(${config.backdropBlur}px)` : undefined,
              WebkitBackdropFilter: config.backdropBlur > 0 ? `blur(${config.backdropBlur}px)` : undefined,
              padding: `${Math.round(config.fontSizePx * 0.6)}px ${Math.round(config.fontSizePx * 0.85)}px`,
              fontSize: `${config.fontSizePx}px`,
              lineHeight: 1.3,
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
