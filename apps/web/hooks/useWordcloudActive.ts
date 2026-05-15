'use client';

import { useEffect, useState } from 'react';

export type WordcloudConfig = {
  question: string;
  maxWordsPerSubmission: 1 | 2 | 3;
  filterStopwords: boolean;
  filterProfanity: boolean;
  palette: string[];
  showTotal: boolean;
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

export type UseWordcloudActiveOptions = {
  initialActive: boolean;
  initialConfig: WordcloudConfig;
  /**
   * Optional pre-built channel. Tests inject a fake channel; production code
   * builds a real Supabase channel inside this hook (via factory).
   */
  channel?: ChannelLike | undefined;
};

export function useWordcloudActive(
  eventId: string,
  opts: UseWordcloudActiveOptions,
): { active: boolean; config: WordcloudConfig } {
  const [active, setActive] = useState(opts.initialActive);
  const [config, setConfig] = useState<WordcloudConfig>(opts.initialConfig);

  useEffect(() => {
    const channel = opts.channel;
    if (!channel) return;

    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `id=eq.${eventId}` },
        (payload) => {
          const row = payload.new as { id?: string; wordcloud_active?: boolean; wordcloud_config?: WordcloudConfig };
          if (!row || row.id !== eventId) return;
          if (typeof row.wordcloud_active === 'boolean') setActive(row.wordcloud_active);
          if (row.wordcloud_config) setConfig(row.wordcloud_config);
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [eventId, opts.channel]);

  return { active, config };
}
