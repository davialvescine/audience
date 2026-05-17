'use client';

import { useEffect, useRef, useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

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
  // Reseta pro initial e refetch via SELECT pra pegar respostas existentes
  // do novo slide (caso operador volte pra slide com respostas anteriores).
  useEffect(() => {
    setResponses(opts.initialResponses);
    if (!slideId) return;
    let cancelled = false;
    // Cast 'as any' — types do Supabase ainda não conhecem open_ended_responses
    // (regenerar shared-types depois). Schema da tabela está estável na migration.
    void (
      getSupabaseBrowserClient().from('open_ended_responses' as never) as unknown as {
        select: (cols: string) => {
          eq: (col: string, val: string) => {
            eq: (col: string, val: string) => {
              order: (col: string, opts: { ascending: boolean }) => {
                limit: (n: number) => Promise<{
                  data: Array<Record<string, unknown>> | null;
                }>;
              };
            };
          };
        };
      }
    )
      .select('id, text, author_name, vote_count, created_at')
      .eq('event_id', eventId)
      .eq('slide_id', slideId)
      .order('created_at', { ascending: false })
      .limit(200)
      .then(({ data }) => {
        if (cancelled) return;
        if (!data || data.length === 0) return;
        setResponses(data.map((row) => rowToResponse(row)));
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideId, eventId]);

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
