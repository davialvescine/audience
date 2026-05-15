'use client';

import { useEffect, useState } from 'react';

import type { WordcloudConfig } from '@/hooks/useWordcloudActive';

type ChannelLike = {
  on: (
    event: string,
    filter: { table?: string; event?: string; schema?: string; filter?: string },
    cb: (payload: {
      eventType: string;
      new: Record<string, unknown>;
      old: Record<string, unknown>;
      table: string;
    }) => void,
  ) => ChannelLike;
  subscribe: (statusCb?: (status: string) => void) => ChannelLike;
  unsubscribe: () => void;
};

export type UseActiveSlideOptions = {
  initialActiveSlideId: string | null;
  initialActiveConfig: WordcloudConfig | null;
  /** Channel pra escutar UPDATE em events (active_slide_id) + slides. */
  channel?: ChannelLike | undefined;
};

/**
 * Audiência: mantém o slide ativo + sua config sincronizados via Realtime.
 * Escuta:
 *   - events.active_slide_id (UPDATE) — quando operador troca de slide
 *   - slides (UPDATE) — quando operador edita config do slide ativo
 *     (1/2/3 palavras, pergunta, fundo, etc.)
 */
export function useActiveSlideConfig(
  eventId: string,
  opts: UseActiveSlideOptions,
): { activeSlideId: string | null; config: WordcloudConfig | null } {
  const [activeSlideId, setActiveSlideId] = useState<string | null>(opts.initialActiveSlideId);
  const [config, setConfig] = useState<WordcloudConfig | null>(opts.initialActiveConfig);

  useEffect(() => {
    const ch = opts.channel;
    if (!ch) return;

    ch.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${eventId}` },
      (payload) => {
        const row = payload.new as { active_slide_id?: string | null };
        if ('active_slide_id' in row) {
          setActiveSlideId(row.active_slide_id ?? null);
        }
      },
    )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'slides', filter: `event_id=eq.${eventId}` },
        (payload) => {
          const row = payload.new as { id?: string; config?: WordcloudConfig };
          if (row.id && row.id === activeSlideId && row.config) {
            setConfig(row.config);
          }
        },
      )
      .subscribe();

    return () => {
      ch.unsubscribe();
    };
  }, [eventId, opts.channel, activeSlideId]);

  return { activeSlideId, config };
}
