'use client';

import { useEffect, useMemo, useState } from 'react';

import { OpenEndedInput } from '@/components/audience/OpenEndedInput';
import { SubmissionForm } from '@/components/audience/SubmissionForm';
import { WordCloudInput } from '@/components/audience/WordCloudInput';
import { useActiveSlideConfig } from '@/hooks/useActiveSlideConfig';
import type { OpenEndedResponse } from '@/hooks/useOpenEndedResponses';
import { usePresenceJoin } from '@/hooks/usePresenceJoin';
import { useWordcloudActive, type WordcloudConfig } from '@/hooks/useWordcloudActive';
import type { OpenEndedConfig } from '@/lib/slides/types';
import { getSupabaseRealtimeClient } from '@/lib/supabase/browser';

type Props = {
  slug: string;
  eventId: string;
  initialWordcloudActive: boolean;
  initialWordcloudConfig: WordcloudConfig;
  initialActiveSlideId: string | null;
  initialActiveSlideType: 'wordcloud' | 'open_ended' | null;
  initialActiveSlideConfig: WordcloudConfig | null;
  initialOpenEndedConfig: OpenEndedConfig | null;
  initialOpenEndedResponses: OpenEndedResponse[];
  submissionsOpen: boolean;
  /** 'auto' (default) segue o slide ativo; 'comments' força form de comentário;
   *  'slides' força nuvem (mostra 'aguardando slide' se nenhum ativo). */
  forceMode?: 'auto' | 'comments' | 'slides' | undefined;
};

type ChannelLike = Parameters<typeof useWordcloudActive>[1]['channel'];
type PresenceChannelLike = Parameters<typeof usePresenceJoin>[0]['channel'];

export function AudienceInputSwitcher({
  slug,
  eventId,
  initialWordcloudActive,
  initialWordcloudConfig,
  initialActiveSlideId,
  initialActiveSlideType,
  initialActiveSlideConfig,
  initialOpenEndedConfig,
  initialOpenEndedResponses,
  submissionsOpen,
  forceMode = 'auto',
}: Props) {
  const [legacyChannel, setLegacyChannel] = useState<ChannelLike | undefined>(undefined);
  const [slidesChannel, setSlidesChannel] = useState<ChannelLike | undefined>(undefined);
  const [presenceChannel, setPresenceChannel] = useState<PresenceChannelLike | undefined>(
    undefined,
  );

  useEffect(() => {
    const rt = getSupabaseRealtimeClient();
    // 1 canal Realtime POR hook — Supabase não deixa adicionar .on() depois
    // do primeiro subscribe(). Hooks separados precisam de canais separados.
    const legacy = rt.channel(`event:${eventId}:legacy:${Date.now()}`) as unknown as ChannelLike;
    const slides = rt.channel(`event:${eventId}:slides:${Date.now()}`) as unknown as ChannelLike;
    const pres = rt.channel(`presence:event:${eventId}`, {
      config: { presence: { key: '' } },
    }) as unknown as PresenceChannelLike;
    setLegacyChannel(legacy);
    setSlidesChannel(slides);
    setPresenceChannel(pres);
    return () => {
      legacy?.unsubscribe();
      slides?.unsubscribe();
      pres?.unsubscribe();
    };
  }, [eventId]);

  // Legacy: lê events.wordcloud_active/_config (eventos antigos sem slides)
  const { active: legacyActive, config: legacyConfig } = useWordcloudActive(eventId, {
    initialActive: initialWordcloudActive,
    initialConfig: initialWordcloudConfig,
    channel: legacyChannel,
  });

  // Novo: lê slide ativo + config dele em tempo real (escuta events.active_slide_id
  // e slides UPDATE filtrado por event_id).
  const { activeSlideId, config: slideConfig } = useActiveSlideConfig(eventId, {
    initialActiveSlideId,
    initialActiveConfig: initialActiveSlideConfig,
    channel: slidesChannel,
  });

  // Prioridade: novo (slide ativo) → fallback legacy.
  const active = activeSlideId != null || legacyActive;
  const config = (slideConfig ?? legacyConfig) as WordcloudConfig;

  // Always join presence (independent of wordcloud_active) so the count is
  // accurate even before the operator enables the nuvem and so this hook
  // keeps working with future slide types.
  usePresenceJoin({
    channel:
      presenceChannel ??
      ({
        subscribe: () => ({}) as unknown,
        unsubscribe: () => {},
        track: () => Promise.resolve('ok' as const),
        untrack: () => Promise.resolve('ok' as const),
      } as unknown as PresenceChannelLike),
  });

  // Branch: se o slide ativo no SSR é open_ended, renderiza OpenEndedInput.
  // Não tem Realtime de tipo (caso operador troque o TIPO do slide ativo,
  // a audiência só atualiza no próximo refresh — caso raro).
  const renderActiveSlide = () => {
    if (initialActiveSlideType === 'open_ended' && initialOpenEndedConfig && initialActiveSlideId) {
      return (
        <OpenEndedInput
          slug={slug}
          eventId={eventId}
          slideId={initialActiveSlideId}
          config={initialOpenEndedConfig}
          initialResponses={initialOpenEndedResponses}
        />
      );
    }
    return <WordCloudInput slug={slug} config={config} />;
  };

  const view = useMemo(() => {
    if (forceMode === 'comments') {
      if (!submissionsOpen) {
        return (
          <div className="text-center py-8">
            <p className="text-2xl font-display text-primary mb-2">⏸️</p>
            <p className="text-ink/60">Submissões encerradas</p>
          </div>
        );
      }
      return <SubmissionForm slug={slug} />;
    }
    if (forceMode === 'slides') {
      if (!active) {
        return (
          <div className="text-center py-8">
            <p className="text-2xl font-display text-primary mb-2">⌛</p>
            <p className="text-ink/60">Aguardando o apresentador iniciar.</p>
          </div>
        );
      }
      return renderActiveSlide();
    }
    // auto
    if (active) return renderActiveSlide();
    if (!submissionsOpen) {
      return (
        <div className="text-center py-8">
          <p className="text-2xl font-display text-primary mb-2">⏸️</p>
          <p className="text-ink/60">Submissões encerradas</p>
        </div>
      );
    }
    return <SubmissionForm slug={slug} />;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    active,
    slug,
    config,
    submissionsOpen,
    forceMode,
    initialActiveSlideType,
    initialOpenEndedConfig,
    initialOpenEndedResponses,
    initialActiveSlideId,
  ]);

  return view;
}
