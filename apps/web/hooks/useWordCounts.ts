'use client';

import { useEffect, useRef, useState } from 'react';

import type { WordEntry } from '@/lib/wordcloud/types';

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

export type UseWordCountsOptions = {
  channel: ChannelLike;
  initialEntries: WordEntry[];
  /** Throttle interval in ms. Defaults to 2000. */
  throttleMs?: number | undefined;
  /** Filtra palavras pelo slide ativo. Quando muda, zera o estado e
   *  só conta inserts daquele slide. Undefined = não filtra (legacy). */
  slideId?: string | null | undefined;
};

export type UseWordCountsResult = {
  entries: WordEntry[];
  totalSubmissions: number;
  /** Status do canal Realtime. Útil pra mostrar "Reconectando" no telão. */
  connectionState: 'connecting' | 'subscribed' | 'error';
};

function buildEntries(counts: Map<string, number>): WordEntry[] {
  return Array.from(counts.entries())
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count || a.text.localeCompare(b.text));
}

export function useWordCounts(eventId: string, opts: UseWordCountsOptions): UseWordCountsResult {
  const throttleMs = opts.throttleMs ?? 2000;
  const slideId = opts.slideId ?? null;

  // Map<word, count> in a ref so realtime callbacks mutate without re-rendering.
  const countsRef = useRef<Map<string, number>>(
    new Map(opts.initialEntries.map((e) => [e.text, e.count])),
  );

  // Buffer of new inserts since the last flush.
  const bufferRef = useRef<string[]>([]);

  const [state, setState] = useState<UseWordCountsResult>({
    entries: opts.initialEntries.slice(),
    totalSubmissions: opts.initialEntries.reduce((s, e) => s + e.count, 0),
    connectionState: 'connecting',
  });

  // Quando slideId muda (operador troca de slide), zera o estado e adota
  // initialEntries novas. Cada slide é uma sessão isolada de palavras.
  useEffect(() => {
    countsRef.current = new Map(opts.initialEntries.map((e) => [e.text, e.count]));
    bufferRef.current = [];
    setState((prev) => ({
      entries: opts.initialEntries.slice(),
      totalSubmissions: opts.initialEntries.reduce((s, e) => s + e.count, 0),
      connectionState: prev.connectionState,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideId]);

  // Ref pra slideId — usado dentro do callback do realtime sem precisar
  // re-subscribe quando o slide muda (Supabase só permite 1 join por channel).
  const slideIdRef = useRef<string | null>(slideId);
  useEffect(() => {
    slideIdRef.current = slideId;
  }, [slideId]);

  useEffect(() => {
    const channel = opts.channel;

    channel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wordcloud_words' },
        (payload) => {
          const row = payload.new as {
            word?: string;
            event_id?: string;
            slide_id?: string | null;
          };
          if (!row || row.event_id !== eventId || !row.word) return;
          // Filtra pelo slide ativo atual (lê via ref pra ter o valor mais
          // recente sem re-subscribe).
          const sid = slideIdRef.current;
          if (sid !== null && row.slide_id !== sid) return;
          bufferRef.current.push(row.word);
        },
      )
      .subscribe((status: string) => {
        // Status pode ser: SUBSCRIBED, TIMED_OUT, CLOSED, CHANNEL_ERROR.
        if (status === 'SUBSCRIBED') {
          setState((s) => ({ ...s, connectionState: 'subscribed' }));
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          setState((s) => ({ ...s, connectionState: 'error' }));
        }
      });

    const tick = () => {
      if (bufferRef.current.length === 0) return;
      let total = 0;
      for (const w of bufferRef.current) {
        countsRef.current.set(w, (countsRef.current.get(w) ?? 0) + 1);
      }
      bufferRef.current = [];
      for (const v of countsRef.current.values()) total += v;
      setState((s) => ({
        entries: buildEntries(countsRef.current),
        totalSubmissions: total,
        connectionState: s.connectionState,
      }));
    };

    const id = setInterval(tick, throttleMs);

    return () => {
      clearInterval(id);
      channel.unsubscribe();
    };
    // slideId NÃO entra nas deps — é lido via slideIdRef. Subscribe acontece
    // 1 única vez por channel instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, opts.channel, throttleMs]);

  return state;
}
