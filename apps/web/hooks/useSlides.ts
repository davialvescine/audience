'use client';

import { useEffect, useState } from 'react';

import type { Slide } from '@/lib/slides/types';

type ChannelLike = {
  on: (
    event: string,
    filter: { table?: string; event?: string; schema?: string; filter?: string },
    cb: (payload: {
      eventType: 'INSERT' | 'UPDATE' | 'DELETE' | string;
      new: Record<string, unknown>;
      old: Record<string, unknown>;
      table: string;
    }) => void,
  ) => ChannelLike;
  subscribe: (statusCb?: (status: string) => void) => ChannelLike;
  unsubscribe: () => void;
};

export type UseSlidesOptions = {
  initialSlides: Slide[];
  channel?: ChannelLike | undefined;
};

/**
 * Mantém a lista de slides de um evento sincronizada via Realtime.
 * INSERT adiciona; UPDATE substitui; DELETE remove. Reordena sempre por
 * `position` ascendente.
 */
export function useSlides(
  eventId: string,
  opts: UseSlidesOptions,
): { slides: Slide[] } {
  const [slides, setSlides] = useState<Slide[]>(opts.initialSlides);

  useEffect(() => {
    setSlides(opts.initialSlides);
  }, [opts.initialSlides]);

  useEffect(() => {
    const ch = opts.channel;
    if (!ch) return;

    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'slides', filter: `event_id=eq.${eventId}` },
      (payload) => {
        setSlides((prev) => {
          if (payload.eventType === 'INSERT') {
            const row = payload.new as Slide;
            return [...prev.filter((s) => s.id !== row.id), row].sort(
              (a, b) => a.position - b.position,
            );
          }
          if (payload.eventType === 'UPDATE') {
            const row = payload.new as Slide;
            return prev
              .map((s) => (s.id === row.id ? row : s))
              .sort((a, b) => a.position - b.position);
          }
          if (payload.eventType === 'DELETE') {
            const oldRow = payload.old as { id?: string };
            if (!oldRow.id) return prev;
            return prev.filter((s) => s.id !== oldRow.id);
          }
          return prev;
        });
      },
    ).subscribe();

    return () => {
      ch.unsubscribe();
    };
  }, [eventId, opts.channel]);

  return { slides };
}
