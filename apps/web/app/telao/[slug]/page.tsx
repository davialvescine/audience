import { notFound } from 'next/navigation';

import { PipLauncher } from '@/components/telao/PipLauncher';
import { TelaoClient } from '@/components/telao/TelaoClient';
import { TelaoStage } from '@/components/telao/TelaoStage';
import { TelaoWordcloudSwitcher } from '@/components/telao/TelaoWordcloudSwitcher';
import type { WordcloudConfig } from '@/hooks/useWordcloudActive';
import { DEFAULT_TELAO_CONFIG, type TelaoConfig } from '@/lib/telao/config';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import type { WordEntry } from '@/lib/wordcloud/types';

const DEFAULT_WORDCLOUD_CONFIG: WordcloudConfig = {
  question: 'Em uma palavra, o que você espera deste evento?',
  maxWordsPerSubmission: 1,
  filterStopwords: true,
  filterProfanity: true,
  palette: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3', '#A8E6CF'],
  showTotal: true,
};

type Params = { slug: string };
type SearchParams = { preview?: string; mode?: string };

export default async function TelaoPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const { preview, mode } = await searchParams;
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase.rpc('get_telao_config', { p_slug: slug });
  const event = data?.[0];
  if (!event) notFound();

  // Per-mode override: se ?mode=X estiver no URL e telao_configs[X] estiver
  // setado, usa esse config. Senão herda do telao_config global.
  const overrides = (event.configs as Record<string, Partial<TelaoConfig>> | null) ?? {};
  const modeOverride = mode && overrides[mode] ? overrides[mode] : undefined;
  const config: TelaoConfig = {
    ...DEFAULT_TELAO_CONFIG,
    ...((event.config as Partial<TelaoConfig>) ?? {}),
    ...(modeOverride ?? {}),
  };

  const isPreview = preview === '1';
  const isPip = mode === 'chrome_pip';

  // Pega o intervalo do evento pra passar pro client (sequencial usa).
  const { data: ev } = await supabase
    .from('events')
    .select('dispatch_interval_seconds')
    .eq('id', event.event_id)
    .single();

  const { data: wcRow } = await supabase
    .from('events')
    .select('wordcloud_active, wordcloud_config')
    .eq('id', event.event_id)
    .maybeSingle();
  const wordcloudActive = wcRow?.wordcloud_active ?? false;
  const wordcloudConfig =
    (wcRow?.wordcloud_config as WordcloudConfig | null) ?? DEFAULT_WORDCLOUD_CONFIG;

  let initialEntries: WordEntry[] = [];
  if (wordcloudActive) {
    const { data: wcState } = await supabase.rpc('get_wordcloud_state', { p_slug: slug });
    initialEntries = (wcState ?? []).map((r) => ({ text: r.word, count: Number(r.count) }));
  }

  // Background pintado apenas fora dos modos transparentes (OBS/PiP/H2R).
  const showWordcloudBackground = !mode || mode === 'fullscreen' || mode === 'desktop_app';

  const telao = (
    <TelaoWordcloudSwitcher
      eventId={event.event_id}
      initialWordcloudActive={wordcloudActive}
      initialWordcloudConfig={wordcloudConfig}
      initialWordcloudEntries={initialEntries}
      showBackground={showWordcloudBackground}
    >
      <TelaoClient
        slug={slug}
        eventId={event.event_id}
        eventName={event.event_name}
        config={config}
        intervalSeconds={ev?.dispatch_interval_seconds ?? 3}
        preview={isPreview}
      />
    </TelaoWordcloudSwitcher>
  );

  // Only wrap with PipLauncher when:
  // - mode=chrome_pip explicitly requested (URL came from "Janela Flutuante" in admin), OR
  // - no mode at all (direct visit) AND not in preview iframe
  // Browser Source URLs use ?mode=browser_source — no PiP overlay then.
  // In preview mode the iframe is already sized to 1920x1080, so we skip
  // TelaoStage (which would double-scale).
  if (isPreview) return telao;
  const staged = <TelaoStage>{telao}</TelaoStage>;
  if (isPip || !mode) return <PipLauncher>{staged}</PipLauncher>;
  return staged;
}

// Force transparent background — overrides root layout
export const metadata = {
  title: 'Telão',
};

// Sempre fresh: o /telao tem que pegar a config mais recente em todo
// request. Sem isso, Next/Vercel cacheia o HTML SSR e operadores precisam
// limpar cache pra ver mudanças que já estão no DB. revalidatePath em
// updateTelaoConfig ajuda mas não cobre todas as rotas (PiP iframe etc).
export const dynamic = 'force-dynamic';
export const revalidate = 0;
