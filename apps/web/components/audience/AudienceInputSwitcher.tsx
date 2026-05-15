'use client';

import { useEffect, useMemo, useState } from 'react';

import { SubmissionForm } from '@/components/audience/SubmissionForm';
import { WordCloudInput } from '@/components/audience/WordCloudInput';
import { usePresenceJoin } from '@/hooks/usePresenceJoin';
import { useWordcloudActive, type WordcloudConfig } from '@/hooks/useWordcloudActive';
import { getSupabaseRealtimeClient } from '@/lib/supabase/browser';

type Props = {
  slug: string;
  eventId: string;
  initialWordcloudActive: boolean;
  initialWordcloudConfig: WordcloudConfig;
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
  submissionsOpen,
  forceMode = 'auto',
}: Props) {
  const [channel, setChannel] = useState<ChannelLike | undefined>(undefined);
  const [presenceChannel, setPresenceChannel] = useState<PresenceChannelLike | undefined>(
    undefined,
  );

  useEffect(() => {
    const rt = getSupabaseRealtimeClient();
    const ch = rt.channel(`event:${eventId}:wc:${Date.now()}`) as unknown as ChannelLike;
    // Shared presence channel — must match the name used by
    // TelaoWordcloudSwitcher so the telão sees this client's track().
    const pres = rt.channel(`presence:event:${eventId}`, {
      config: { presence: { key: '' } },
    }) as unknown as PresenceChannelLike;
    setChannel(ch);
    setPresenceChannel(pres);
    return () => {
      ch?.unsubscribe();
      pres?.unsubscribe();
    };
  }, [eventId]);

  const { active, config } = useWordcloudActive(eventId, {
    initialActive: initialWordcloudActive,
    initialConfig: initialWordcloudConfig,
    channel,
  });

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
      return <WordCloudInput slug={slug} config={config} />;
    }
    // auto
    if (active) return <WordCloudInput slug={slug} config={config} />;
    if (!submissionsOpen) {
      return (
        <div className="text-center py-8">
          <p className="text-2xl font-display text-primary mb-2">⏸️</p>
          <p className="text-ink/60">Submissões encerradas</p>
        </div>
      );
    }
    return <SubmissionForm slug={slug} />;
  }, [active, slug, config, submissionsOpen, forceMode]);

  return view;
}
