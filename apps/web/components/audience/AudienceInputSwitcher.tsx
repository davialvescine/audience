'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { OpenEndedInput } from '@/components/audience/OpenEndedInput';
import { PollInput } from '@/components/audience/PollInput';
import { SubmissionForm } from '@/components/audience/SubmissionForm';
import { WordCloudInput } from '@/components/audience/WordCloudInput';
import { useActiveSlideConfig } from '@/hooks/useActiveSlideConfig';
import type { OpenEndedResponse } from '@/hooks/useOpenEndedResponses';
import { usePresenceJoin } from '@/hooks/usePresenceJoin';
import type { WordcloudConfig } from '@/hooks/useWordcloudActive';
import type { OpenEndedConfig, PollConfig } from '@/lib/slides/types';
import { getSupabaseRealtimeClient } from '@/lib/supabase/browser';

type Props = {
  slug: string;
  eventId: string;
  initialActiveSlideId: string | null;
  initialActiveSlideType: 'wordcloud' | 'open_ended' | 'comments' | 'poll' | null;
  initialActiveSlideConfig: WordcloudConfig | null;
  initialOpenEndedConfig: OpenEndedConfig | null;
  initialOpenEndedResponses: OpenEndedResponse[];
  initialPollConfig?: PollConfig | null;
  submissionsOpen: boolean;
  /** 'auto' (default) segue o slide ativo; 'comments' força form de comentário;
   *  'slides' força nuvem (mostra 'aguardando slide' se nenhum ativo). */
  forceMode?: 'auto' | 'comments' | 'slides' | undefined;
};

type ChannelLike = Parameters<typeof useActiveSlideConfig>[1]['channel'];
type PresenceChannelLike = Parameters<typeof usePresenceJoin>[0]['channel'];

export function AudienceInputSwitcher({
  slug,
  eventId,
  initialActiveSlideId,
  initialActiveSlideType,
  initialActiveSlideConfig,
  initialOpenEndedConfig,
  initialOpenEndedResponses,
  initialPollConfig,
  submissionsOpen,
  forceMode = 'auto',
}: Props) {
  const [slidesChannel, setSlidesChannel] = useState<ChannelLike | undefined>(undefined);
  const [presenceChannel, setPresenceChannel] = useState<PresenceChannelLike | undefined>(
    undefined,
  );

  useEffect(() => {
    const rt = getSupabaseRealtimeClient();
    const slides = rt.channel(`event:${eventId}:slides:${Date.now()}`) as unknown as ChannelLike;
    const pres = rt.channel(`presence:event:${eventId}`, {
      config: { presence: { key: '' } },
    }) as unknown as PresenceChannelLike;
    setSlidesChannel(slides);
    setPresenceChannel(pres);
    return () => {
      slides?.unsubscribe();
      pres?.unsubscribe();
    };
  }, [eventId]);

  // Lê slide ativo + tipo + config dele em tempo real.
  // initialActiveConfig precisa refletir o TIPO do SSR — se for open_ended,
  // passa openEndedConfig; senão wordcloud. Sem isso, audiência abre em
  // open_ended mas slideConfig=null e cai no fallback do wordcloud.
  const ssrInitialConfig =
    initialActiveSlideType === 'open_ended'
      ? (initialOpenEndedConfig as unknown as WordcloudConfig | null)
      : initialActiveSlideType === 'poll'
        ? (initialPollConfig as unknown as WordcloudConfig | null)
        : initialActiveSlideConfig;
  const { activeSlideId, activeType, config: slideConfig } = useActiveSlideConfig(eventId, {
    initialActiveSlideId,
    initialActiveType: initialActiveSlideType,
    initialActiveConfig: ssrInitialConfig,
    channel: slidesChannel,
  });

  // Quando o operador troca o slide ativo (ex: comments → wordcloud), o
  // input troca via state interno aqui. Mas o PublicEventShell (Server
  // Component) tem heroSubtitle e footer text que dependem do TIPO do
  // slide — esses só atualizam com router.refresh() porque vêm do SSR.
  // router.refresh() re-executa o RSC sem recarregar a página inteira.
  const router = useRouter();
  const lastSlideRef = useRef<string | null>(initialActiveSlideId);
  useEffect(() => {
    if (activeSlideId !== lastSlideRef.current) {
      lastSlideRef.current = activeSlideId;
      router.refresh();
    }
  }, [activeSlideId, router]);

  const active = activeSlideId != null;
  const wcConfig = activeType === 'wordcloud' ? (slideConfig as WordcloudConfig | null) : null;

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

  // Branch reativo — usa activeType do hook (Realtime), não só SSR.
  // Quando operador troca slide (nuvem → aberto ou vice-versa), audiência
  // re-renderiza pro input correto sem precisar refreshar a página.
  const renderActiveSlide = () => {
    if (activeType === 'open_ended' && slideConfig && activeSlideId) {
      // initialOpenEndedResponses só vale pra primeira carga (SSR do mesmo
      // slide); quando muda de slide via Realtime, começa vazio e o hook
      // useOpenEndedResponses popula via Realtime/refetch.
      const responses =
        activeSlideId === initialActiveSlideId ? initialOpenEndedResponses : [];
      return (
        <OpenEndedInput
          slug={slug}
          eventId={eventId}
          slideId={activeSlideId}
          config={slideConfig as OpenEndedConfig}
          initialResponses={responses}
        />
      );
    }
    if (activeType === 'comments') {
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
    if ((activeType as string) === 'poll' && slideConfig && activeSlideId) {
      return (
        <PollInput slug={slug} slideId={activeSlideId} config={slideConfig as PollConfig} />
      );
    }
    if (wcConfig) {
      return <WordCloudInput slug={slug} config={wcConfig} />;
    }
    return null;
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
    wcConfig,
    slideConfig,
    activeType,
    activeSlideId,
    submissionsOpen,
    forceMode,
    initialOpenEndedResponses,
    initialActiveSlideId,
  ]);

  return view;
}
