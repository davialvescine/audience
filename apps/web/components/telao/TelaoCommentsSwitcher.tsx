'use client';

import { useEffect, useState } from 'react';

import { TelaoClient } from '@/components/telao/TelaoClient';
import { backgroundStyle } from '@/components/telao/WordCloudDisplay';
import { useActiveSlideConfig } from '@/hooks/useActiveSlideConfig';
import { getSupabaseRealtimeClient } from '@/lib/supabase/browser';
import { DEFAULT_COMMENTS_CONFIG, type CommentsConfig } from '@/lib/slides/types';

type ChannelLike = NonNullable<Parameters<typeof useActiveSlideConfig>[1]['channel']>;

type Props = {
  slug: string;
  eventId: string;
  eventName: string;
  initialActiveSlideId: string;
  initialConfig: CommentsConfig;
  intervalSeconds: number;
  /** Quando true, pinta o fundo do slide (config.background) atrás do TelaoClient.
   *  Em modo browser_source (?mode=browser_source), passar false pra manter
   *  transparência absoluta. */
  showBackground: boolean;
};

/**
 * Wrapper realtime do TelaoClient pro slide `comments`. Escuta
 * `useActiveSlideConfig` pra atualizar config ao vivo (cor, fonte, posição,
 * título, etc.) sem refresh.
 */
export function TelaoCommentsSwitcher({
  slug,
  eventId,
  eventName,
  initialActiveSlideId,
  initialConfig,
  intervalSeconds,
  showBackground,
}: Props) {
  const [channel, setChannel] = useState<ChannelLike | undefined>(undefined);

  useEffect(() => {
    const rt = getSupabaseRealtimeClient();
    const ch = rt.channel(`telao:${eventId}:cmts:${Date.now()}`) as unknown as ChannelLike;
    setChannel(ch);
    return () => {
      ch?.unsubscribe();
    };
  }, [eventId]);

  const slide = useActiveSlideConfig(eventId, {
    initialActiveSlideId,
    initialActiveType: 'comments',
    // Passamos como WordcloudConfig só pelo shape do hook — na prática
    // armazena um CommentsConfig. Cast abaixo no consumo.
    initialActiveConfig: initialConfig as unknown as never,
    channel,
  });

  const merged: CommentsConfig = {
    ...DEFAULT_COMMENTS_CONFIG,
    ...((slide.activeType === 'comments' && slide.config
      ? (slide.config as Partial<CommentsConfig>)
      : initialConfig) ?? {}),
  };

  const wrapStyle = showBackground
    ? backgroundStyle(merged.background ?? { type: 'none' })
    : undefined;

  return (
    <div className="absolute inset-0" style={wrapStyle}>
      <TelaoClient
        slug={slug}
        eventId={eventId}
        eventName={eventName}
        config={merged}
        intervalSeconds={intervalSeconds}
        title={merged.title}
        showTitle={merged.showTitle === true}
      />
    </div>
  );
}
