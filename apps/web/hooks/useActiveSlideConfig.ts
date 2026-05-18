'use client';

import { useEffect, useRef, useState } from 'react';

import type { WordcloudConfig } from '@/hooks/useWordcloudActive';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

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

export type ActiveSlideType = 'wordcloud' | 'open_ended' | 'comments' | null;

export type UseActiveSlideOptions = {
  initialActiveSlideId: string | null;
  initialActiveType?: ActiveSlideType;
  initialActiveConfig: WordcloudConfig | null;
  channel?: ChannelLike | undefined;
};

/**
 * Audiência: mantém o slide ativo (id + tipo + config) sincronizados via
 * Realtime. Importante pra trocar entre nuvem/aberto em tempo real sem
 * precisar refreshar a página.
 *
 * Critical: subscribe roda UMA vez (deps só [channel, eventId]). O callback
 * lê activeSlideId via ref pra evitar closure stale — se trocar `activeSlideId`
 * nas deps do useEffect, cada mudança re-monta o subscribe (Supabase reseta
 * o canal a cada `on()` novo só funcionando antes do primeiro `subscribe`).
 */
export function useActiveSlideConfig(
  eventId: string,
  opts: UseActiveSlideOptions,
): {
  activeSlideId: string | null;
  activeType: ActiveSlideType;
  config: unknown;
} {
  const [activeSlideId, setActiveSlideId] = useState<string | null>(opts.initialActiveSlideId);
  const [activeType, setActiveType] = useState<ActiveSlideType>(opts.initialActiveType ?? null);
  const [config, setConfig] = useState<unknown>(opts.initialActiveConfig);
  const activeSlideIdRef = useRef<string | null>(opts.initialActiveSlideId);

  // Mantém ref em sincronia com state — usado dentro do callback de slides UPDATE
  // pra saber qual slide está ativo agora (sem closure stale).
  useEffect(() => {
    activeSlideIdRef.current = activeSlideId;
  }, [activeSlideId]);

  useEffect(() => {
    const ch = opts.channel;
    if (!ch) return;

    const sb = getSupabaseBrowserClient();
    ch.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${eventId}` },
      (payload) => {
        const row = payload.new as { active_slide_id?: string | null };
        if ('active_slide_id' in row) {
          const newId = row.active_slide_id ?? null;
          setActiveSlideId(newId);
          activeSlideIdRef.current = newId;
          // Refetch tipo + config quando o slide ativo muda — operador pode
          // ter trocado de nuvem pra aberto, audiência precisa adaptar input.
          if (newId) {
            void sb
              .from('slides')
              .select('type, config')
              .eq('id', newId)
              .maybeSingle()
              .then(({ data }) => {
                const row2 = data as { type?: string; config?: unknown } | null;
                if (
                  row2?.type === 'wordcloud' ||
                  row2?.type === 'open_ended' ||
                  row2?.type === 'comments'
                ) {
                  setActiveType(row2.type);
                }
                if (row2?.config) setConfig(row2.config);
              });
          } else {
            setActiveType(null);
            setConfig(null);
          }
        }
      },
    )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'slides', filter: `event_id=eq.${eventId}` },
        (payload) => {
          const row = payload.new as { id?: string; type?: string; config?: unknown };
          if (row.id && row.id === activeSlideIdRef.current) {
            if (
              row.type === 'wordcloud' ||
              row.type === 'open_ended' ||
              row.type === 'comments'
            ) {
              setActiveType(row.type);
            }
            if (row.config) setConfig(row.config);
          }
        },
      )
      .subscribe();

    return () => {
      ch.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, opts.channel]);

  // Polling fallback — refetch active slide + config every 3s. Caso o
  // Realtime falhe (firewall, CSP, transport, etc.), o celular ainda
  // pega as mudanças do operador em ~3s.
  useEffect(() => {
    let cancelled = false;
    const sb = getSupabaseBrowserClient();
    const poll = async () => {
      const { data: ev } = await sb
        .from('events')
        .select('active_slide_id')
        .eq('id', eventId)
        .maybeSingle();
      if (cancelled) return;
      const newActiveId = (ev as { active_slide_id?: string | null } | null)?.active_slide_id ?? null;
      if (newActiveId !== activeSlideIdRef.current) {
        setActiveSlideId(newActiveId);
        activeSlideIdRef.current = newActiveId;
      }
      if (newActiveId) {
        const { data: slideRow } = await sb
          .from('slides')
          .select('type, config')
          .eq('id', newActiveId)
          .maybeSingle();
        if (cancelled) return;
        const row = slideRow as { type?: string; config?: unknown } | null;
        if (row?.type === 'wordcloud' || row?.type === 'open_ended' || row?.type === 'comments') {
          setActiveType((prev) => (prev === row.type ? prev : row.type as ActiveSlideType));
        }
        if (row?.config) {
          setConfig((prev: unknown) =>
            JSON.stringify(prev) === JSON.stringify(row.config) ? prev : row.config,
          );
        }
      } else {
        setActiveType(null);
        setConfig(null);
      }
    };
    void poll();
    // Polling agressivo (1s) — captura mudanças mesmo se Realtime falhar.
    // Quase de graça: 2 SELECTs simples por evento por segundo.
    const id = setInterval(poll, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [eventId]);

  return { activeSlideId, activeType, config };
}
