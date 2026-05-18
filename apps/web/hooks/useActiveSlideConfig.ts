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

export type ActiveSlideType = 'wordcloud' | 'open_ended' | 'comments' | 'poll' | null;

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

  // Polling = fonte única de verdade. Realtime apenas dispara um poll
  // imediato (não aplica payload direto). Isso evita o bug clássico de
  // realtime: mensagens stale/buffered chegando fora de ordem e revertendo
  // o estado pra um valor antigo (o "as vezes troca mas volta").
  //
  // Sempre que o poll roda, ele lê o ESTADO ATUAL do DB. Mesmo que um
  // realtime velho dispare um poll extra, o poll lê o mesmo valor que
  // estaria lá, sem reverter.
  const pollNowRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    const ch = opts.channel;
    if (!ch) return;

    // Realtime = "alguma coisa mudou, vai ler o DB agora".
    ch.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'events', filter: `id=eq.${eventId}` },
      () => {
        void pollNowRef.current();
      },
    )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'slides', filter: `event_id=eq.${eventId}` },
        () => {
          void pollNowRef.current();
        },
      )
      .subscribe();

    return () => {
      ch.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, opts.channel]);

  // Polling = fonte única. Re-fetch a cada 1s + dispara também quando
  // realtime fira (latência praticamente zero quando funciona).
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
        if (
          row?.type === 'wordcloud' ||
          row?.type === 'open_ended' ||
          row?.type === 'comments' ||
          row?.type === 'poll'
        ) {
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
    pollNowRef.current = poll;
    void poll();
    // Polling 1s — captura mudanças mesmo se Realtime cair. Em fluxo
    // normal, Realtime fira primeiro e dispara o poll instantâneo.
    const id = setInterval(poll, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [eventId]);

  return { activeSlideId, activeType, config };
}
