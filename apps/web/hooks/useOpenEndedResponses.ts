'use client';

import { useEffect, useRef, useState } from 'react';

export type OpenEndedResponse = {
  id: string;
  text: string;
  authorName: string | null;
  voteCount: number;
  createdAt: string;
};

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

export type UseOpenEndedOptions = {
  channel: ChannelLike;
  initialResponses: OpenEndedResponse[];
  slideId: string | null;
};

export type UseOpenEndedResult = {
  responses: OpenEndedResponse[];
  connectionState: 'connecting' | 'subscribed' | 'error';
};

function rowToResponse(row: Record<string, unknown>): OpenEndedResponse {
  return {
    id: String(row.id ?? ''),
    text: String(row.text ?? ''),
    authorName: row.author_name == null ? null : String(row.author_name),
    voteCount: Number(row.vote_count ?? 0),
    createdAt: String(row.created_at ?? new Date().toISOString()),
  };
}

export function useOpenEndedResponses(
  eventId: string,
  opts: UseOpenEndedOptions,
): UseOpenEndedResult {
  const { channel, slideId } = opts;

  const [responses, setResponses] = useState<OpenEndedResponse[]>(opts.initialResponses);
  const [connectionState, setConnectionState] = useState<
    'connecting' | 'subscribed' | 'error'
  >('connecting');

  // Re-sincroniza quando slideId muda (operador troca de slide).
  useEffect(() => {
    setResponses(opts.initialResponses);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideId]);

  const slideIdRef = useRef<string | null>(slideId);
  useEffect(() => {
    slideIdRef.current = slideId;
  }, [slideId]);

  useEffect(() => {
    channel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'open_ended_responses' },
        (payload) => {
          const row = payload.new as Record<string, unknown> & {
            event_id?: string;
            slide_id?: string;
          };
          if (!row || row.event_id !== eventId) return;
          const sid = slideIdRef.current;
          if (sid !== null && row.slide_id !== sid) return;
          const resp = rowToResponse(row);
          setResponses((prev) => {
            if (prev.some((r) => r.id === resp.id)) return prev;
            return [resp, ...prev];
          });
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'open_ended_responses' },
        (payload) => {
          const row = payload.new as Record<string, unknown> & {
            event_id?: string;
            slide_id?: string;
          };
          if (!row || row.event_id !== eventId) return;
          const sid = slideIdRef.current;
          if (sid !== null && row.slide_id !== sid) return;
          const updated = rowToResponse(row);
          setResponses((prev) =>
            prev.map((r) => (r.id === updated.id ? updated : r)),
          );
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'open_ended_responses' },
        (payload) => {
          const row = payload.old as Record<string, unknown>;
          if (!row?.id) return;
          setResponses((prev) => prev.filter((r) => r.id !== row.id));
        },
      )
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') setConnectionState('subscribed');
        else if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        )
          setConnectionState('error');
      });

    return () => {
      channel.unsubscribe();
    };
    // slideId NÃO entra nas deps — lido via ref pra evitar re-subscribe
    // (Supabase só permite 1 join por channel instance).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, channel]);

  return { responses, connectionState };
}
