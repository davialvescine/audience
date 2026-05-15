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
};

export type UseWordCountsResult = {
  entries: WordEntry[];
  totalSubmissions: number;
};

function buildEntries(counts: Map<string, number>): WordEntry[] {
  return Array.from(counts.entries())
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => (b.count - a.count) || a.text.localeCompare(b.text));
}

export function useWordCounts(
  eventId: string,
  opts: UseWordCountsOptions,
): UseWordCountsResult {
  const throttleMs = opts.throttleMs ?? 2000;

  // Map<word, count> in a ref so realtime callbacks mutate without re-rendering.
  const countsRef = useRef<Map<string, number>>(
    new Map(opts.initialEntries.map((e) => [e.text, e.count])),
  );

  // Buffer of new inserts since the last flush.
  const bufferRef = useRef<string[]>([]);

  const [state, setState] = useState<UseWordCountsResult>({
    entries: opts.initialEntries.slice(),
    totalSubmissions: opts.initialEntries.reduce((s, e) => s + e.count, 0),
  });

  useEffect(() => {
    const channel = opts.channel;

    channel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'wordcloud_words' },
        (payload) => {
          const row = payload.new as { word?: string; event_id?: string };
          if (!row || row.event_id !== eventId || !row.word) return;
          bufferRef.current.push(row.word);
        },
      )
      .subscribe();

    const tick = () => {
      if (bufferRef.current.length === 0) return;
      let total = 0;
      for (const w of bufferRef.current) {
        countsRef.current.set(w, (countsRef.current.get(w) ?? 0) + 1);
      }
      bufferRef.current = [];
      for (const v of countsRef.current.values()) total += v;
      setState({ entries: buildEntries(countsRef.current), totalSubmissions: total });
    };

    const id = setInterval(tick, throttleMs);

    return () => {
      clearInterval(id);
      channel.unsubscribe();
    };
  }, [eventId, opts.channel, throttleMs]);

  return state;
}
