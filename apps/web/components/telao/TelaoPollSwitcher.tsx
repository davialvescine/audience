'use client';

import { useEffect, useMemo, useState } from 'react';

import { FullscreenButton } from '@/components/telao/FullscreenButton';
import { PollDisplay } from '@/components/telao/PollDisplay';
import { StatsBadge } from '@/components/telao/StatsBadge';
import { useActiveSlideConfig } from '@/hooks/useActiveSlideConfig';
import { useOnlinePresence } from '@/hooks/useOnlinePresence';
import { getSupabaseRealtimeClient } from '@/lib/supabase/browser';
import { DEFAULT_POLL_CONFIG, type PollConfig } from '@/lib/slides/types';

type ChannelLike = Parameters<typeof PollDisplay>[0]['channel'];

type Props = {
  slug: string;
  eventId: string;
  slideId: string;
  initialConfig: PollConfig;
  initialCounts: number[];
  showBackground: boolean;
  joinUrl?: string | undefined;
  isOperator?: boolean | undefined;
};

export function TelaoPollSwitcher({
  slug,
  eventId,
  slideId,
  initialConfig,
  initialCounts,
  showBackground,
  joinUrl,
  isOperator,
}: Props) {
  const [votesChannel, setVotesChannel] = useState<ChannelLike | undefined>(undefined);
  type HookChannel = NonNullable<Parameters<typeof useActiveSlideConfig>[1]['channel']>;
  type PresenceChannel = NonNullable<Parameters<typeof useOnlinePresence>[0]['channel']>;
  const [slideChannel, setSlideChannel] = useState<HookChannel | undefined>(undefined);
  const [presenceChannel, setPresenceChannel] = useState<PresenceChannel | undefined>(undefined);
  const [totalVotes, setTotalVotes] = useState(0);

  useEffect(() => {
    setTotalVotes(initialCounts.reduce((a, b) => a + b, 0));
  }, [initialCounts]);

  useEffect(() => {
    const rt = getSupabaseRealtimeClient();
    const ts = Date.now();
    const v = rt.channel(`telao:${eventId}:pollvotes:${ts}`) as unknown as ChannelLike;
    const s = rt.channel(`telao:${eventId}:pollconfig:${ts}`) as unknown as HookChannel;
    const pres = rt.channel(`presence:event:${eventId}`, {
      config: { presence: { key: '' } },
    }) as unknown as PresenceChannel;
    setVotesChannel(v);
    setSlideChannel(s);
    setPresenceChannel(pres);
    return () => {
      v?.unsubscribe();
      s?.unsubscribe();
      pres?.unsubscribe();
    };
  }, [eventId]);

  // Hook pra atualizar config (pergunta/opções/revealed) via realtime.
  const slide = useActiveSlideConfig(eventId, {
    initialActiveSlideId: slideId,
    initialActiveType: 'poll' as never,
    initialActiveConfig: initialConfig as unknown as never,
    channel: slideChannel,
  });

  const merged: PollConfig = useMemo(() => {
    const source =
      slide.activeSlideId === slideId && slide.config
        ? (slide.config as Partial<PollConfig>)
        : initialConfig;
    return { ...DEFAULT_POLL_CONFIG, ...(source ?? {}) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(slide.config), JSON.stringify(initialConfig), slide.activeSlideId, slideId]);

  if (!votesChannel) return null;

  return (
    <>
      <PollDisplay
        slug={slug}
        slideId={slideId}
        config={merged}
        initialCounts={initialCounts}
        channel={votesChannel}
        showBackground={showBackground}
        joinUrl={joinUrl}
        isOperator={isOperator}
        onTotalChange={setTotalVotes}
      />
      {showBackground && presenceChannel ? (
        <StatsBadge
          presenceChannel={presenceChannel}
          count={totalVotes}
          label="voto"
          color={merged.textColorOverride ?? '#FFFFFF'}
        />
      ) : null}
      {showBackground && isOperator ? <FullscreenButton /> : null}
    </>
  );
}
