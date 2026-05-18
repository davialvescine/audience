'use client';

import { useEffect, useMemo, useState } from 'react';

import { PollDisplay } from '@/components/telao/PollDisplay';
import { useActiveSlideConfig } from '@/hooks/useActiveSlideConfig';
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
  const [slideChannel, setSlideChannel] = useState<HookChannel | undefined>(undefined);

  useEffect(() => {
    const rt = getSupabaseRealtimeClient();
    const ts = Date.now();
    const v = rt.channel(`telao:${eventId}:pollvotes:${ts}`) as unknown as ChannelLike;
    const s = rt.channel(`telao:${eventId}:pollconfig:${ts}`) as unknown as HookChannel;
    setVotesChannel(v);
    setSlideChannel(s);
    return () => {
      v?.unsubscribe();
      s?.unsubscribe();
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
    <PollDisplay
      slug={slug}
      slideId={slideId}
      config={merged}
      initialCounts={initialCounts}
      channel={votesChannel}
      showBackground={showBackground}
      joinUrl={joinUrl}
      isOperator={isOperator}
    />
  );
}
