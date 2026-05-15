'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { WordCloudDisplay } from '@/components/telao/WordCloudDisplay';
import { useOnlinePresence } from '@/hooks/useOnlinePresence';
import { useWordcloudActive, type WordcloudConfig } from '@/hooks/useWordcloudActive';
import { getSupabaseRealtimeClient } from '@/lib/supabase/browser';
import type { WordEntry } from '@/lib/wordcloud/types';

type ChannelLike = NonNullable<Parameters<typeof useWordcloudActive>[1]['channel']>;
type PresenceChannelLike = Parameters<typeof useOnlinePresence>[0]['channel'];

type Props = {
  eventId: string;
  initialWordcloudActive: boolean;
  initialWordcloudConfig: WordcloudConfig;
  initialWordcloudEntries: WordEntry[];
  children: ReactNode;
};

/**
 * Wraps the telão render tree. When wordcloud_active is true (via SSR seed
 * OR a live Realtime update), shows the WordCloudDisplay instead of the
 * normal comments-based TelaoClient. Both live in the same DOM tree so the
 * stage scaler / mode wrappers don't have to change.
 *
 * Also creates the audience-presence channel (shared with the /e/<slug>
 * page) so WordCloudDisplay can render the OnlineBadge with the live count.
 */
export function TelaoWordcloudSwitcher({
  eventId,
  initialWordcloudActive,
  initialWordcloudConfig,
  initialWordcloudEntries,
  children,
}: Props) {
  const [eventsChannel, setEventsChannel] = useState<ChannelLike | undefined>(undefined);
  const [wordsChannel, setWordsChannel] = useState<ChannelLike | undefined>(undefined);
  const [presenceChannel, setPresenceChannel] = useState<PresenceChannelLike | undefined>(
    undefined,
  );

  useEffect(() => {
    const rt = getSupabaseRealtimeClient();
    const ev = rt.channel(`telao:${eventId}:events:${Date.now()}`) as unknown as ChannelLike;
    const wc = rt.channel(`telao:${eventId}:words:${Date.now()}`) as unknown as ChannelLike;
    // Shared presence channel — audience joins the same name in
    // AudienceInputSwitcher so this channel sees all the trackers.
    const pres = rt.channel(`presence:event:${eventId}`, {
      config: { presence: { key: '' } },
    }) as unknown as PresenceChannelLike;
    setEventsChannel(ev);
    setWordsChannel(wc);
    setPresenceChannel(pres);
    return () => {
      ev?.unsubscribe();
      wc?.unsubscribe();
      pres?.unsubscribe();
    };
  }, [eventId]);

  const { active, config } = useWordcloudActive(eventId, {
    initialActive: initialWordcloudActive,
    initialConfig: initialWordcloudConfig,
    channel: eventsChannel,
  });

  return useMemo(() => {
    if (!active) return <>{children}</>;
    if (!wordsChannel) {
      // Realtime channel not ready yet — show static initial state.
      return (
        <WordCloudDisplay
          eventId={eventId}
          config={config}
          initialEntries={initialWordcloudEntries}
          channel={
            // No-op fake channel: never emits, never throws
            {
              on() {
                return this as unknown as ChannelLike;
              },
              subscribe() {
                return this as unknown as ChannelLike;
              },
              unsubscribe() {},
            } as unknown as ChannelLike
          }
        />
      );
    }
    return (
      <WordCloudDisplay
        eventId={eventId}
        config={config}
        initialEntries={initialWordcloudEntries}
        channel={wordsChannel}
        presenceChannel={presenceChannel}
      />
    );
  }, [active, children, config, eventId, initialWordcloudEntries, wordsChannel, presenceChannel]);
}
