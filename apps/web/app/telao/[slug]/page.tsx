import { notFound } from 'next/navigation';

import { ActiveSlideWatcher } from '@/components/telao/ActiveSlideWatcher';
import { FullscreenAuto } from '@/components/telao/FullscreenAuto';
import { PipLauncher } from '@/components/telao/PipLauncher';
import { TelaoClient } from '@/components/telao/TelaoClient';
import { TelaoCommentsSwitcher } from '@/components/telao/TelaoCommentsSwitcher';
import { TelaoOpenEndedSwitcher } from '@/components/telao/TelaoOpenEndedSwitcher';
import { TelaoStage } from '@/components/telao/TelaoStage';
import { TelaoWordcloudSwitcher } from '@/components/telao/TelaoWordcloudSwitcher';
import type { OpenEndedResponse } from '@/hooks/useOpenEndedResponses';
import type { WordcloudConfig } from '@/hooks/useWordcloudActive';
import {
  DEFAULT_COMMENTS_CONFIG,
  DEFAULT_OPEN_ENDED_CONFIG,
  type CommentsConfig,
  type OpenEndedConfig,
} from '@/lib/slides/types';
import { DEFAULT_TELAO_CONFIG, type TelaoConfig } from '@/lib/telao/config';
import { getSupabaseServerClient } from '@/lib/supabase/server';
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

  // Checa se o usuário logado é owner ou event_member — só ele vê a
  // OperatorToolbar (toggles de QR / ocultar respostas / fullscreen).
  // Anônimos que abrem o link do telão veem o slide sem controles.
  const ssr = await getSupabaseServerClient();
  const { data: { user } } = await ssr.auth.getUser();
  let isOperator = false;
  if (user) {
    const { data: ownerRow } = await supabase
      .from('events')
      .select('owner_id')
      .eq('id', event.event_id)
      .maybeSingle();
    if (ownerRow?.owner_id === user.id) {
      isOperator = true;
    } else {
      const { data: member } = await supabase
        .from('event_members')
        .select('user_id')
        .eq('event_id', event.event_id)
        .eq('user_id', user.id)
        .maybeSingle();
      isOperator = !!member;
    }
  }

  // Pega o intervalo do evento pra passar pro client (sequencial usa).
  const { data: ev } = await supabase
    .from('events')
    .select('dispatch_interval_seconds')
    .eq('id', event.event_id)
    .single();

  const { data: wcRow } = await supabase
    .from('events')
    .select('wordcloud_active, wordcloud_config, active_slide_id')
    .eq('id', event.event_id)
    .maybeSingle();
  const wordcloudActive = wcRow?.wordcloud_active ?? false;
  const wordcloudConfig =
    (wcRow?.wordcloud_config as WordcloudConfig | null) ?? DEFAULT_WORDCLOUD_CONFIG;
  const activeSlideId = (wcRow?.active_slide_id as string | null) ?? null;

  // Fetch active slide config (sistema novo multi-slide). Tem precedência
  // sobre wordcloud_config legacy quando existe e é do tipo wordcloud.
  let activeSlideConfig: WordcloudConfig | null = null;
  let activeSlideType: 'wordcloud' | 'open_ended' | 'comments' | null = null;
  let activeOpenEndedConfig: OpenEndedConfig | null = null;
  let activeCommentsConfig: CommentsConfig | null = null;
  if (activeSlideId) {
    const { data: slideRow } = await supabase
      .from('slides')
      .select('type, config')
      .eq('id', activeSlideId)
      .maybeSingle();
    if (slideRow?.type === 'wordcloud') {
      activeSlideConfig = (slideRow.config as WordcloudConfig) ?? null;
      activeSlideType = 'wordcloud';
    } else if (slideRow?.type === 'open_ended') {
      activeOpenEndedConfig = { ...DEFAULT_OPEN_ENDED_CONFIG, ...((slideRow.config as Partial<OpenEndedConfig>) ?? {}) };
      activeSlideType = 'open_ended';
    } else if (slideRow?.type === 'comments') {
      activeCommentsConfig = { ...DEFAULT_COMMENTS_CONFIG, ...((slideRow.config as Partial<CommentsConfig>) ?? {}) };
      activeSlideType = 'comments';
    }
  }

  // Para open_ended, busca respostas iniciais do slide ativo.
  let initialOpenEndedResponses: OpenEndedResponse[] = [];
  if (activeSlideType === 'open_ended' && activeSlideId) {
    type RpcRow = { id: string; text: string; author_name: string | null; vote_count: number; created_at: string };
    const { data: rows } = (await (supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: RpcRow[] | null; error: { message: string } | null }>)('get_open_ended_state', {
      p_slug: slug,
      p_slide_id: activeSlideId,
    })) as { data: RpcRow[] | null };
    initialOpenEndedResponses = (rows ?? []).map((r) => ({
      id: r.id,
      text: r.text,
      authorName: r.author_name,
      voteCount: Number(r.vote_count),
      createdAt: r.created_at,
    }));
  }

  // Telão fica em modo nuvem quando: legacy `wordcloud_active=true` OU tem
  // slide ativo do tipo wordcloud (sistema novo).
  const cloudMode = wordcloudActive || activeSlideConfig !== null;

  let initialEntries: WordEntry[] = [];
  if (cloudMode) {
    // Filtra pelo slide ativo — cada slide tem suas próprias palavras.
    // Sem slide ativo (legacy), omite p_slide_id pra retornar agregado.
    const rpcArgs: { p_slug: string; p_slide_id?: string } = { p_slug: slug };
    if (activeSlideId) rpcArgs.p_slide_id = activeSlideId;
    const { data: wcState } = await supabase.rpc('get_wordcloud_state', rpcArgs);
    initialEntries = (wcState ?? []).map((r) => ({ text: r.word, count: Number(r.count) }));
  }

  // Background pintado apenas fora dos modos transparentes (OBS/PiP/H2R).
  const showWordcloudBackground = !mode || mode === 'fullscreen' || mode === 'desktop_app';

  // URL pública pra audiência — mostrada no top-bar do telão fullscreen.
  // Reconstruída a partir do mesmo host do request.
  const joinUrl = `https://audience-opal.vercel.app/e/${slug}`;

  // Preview da aba Telão (no admin) = sempre o card de comentário, ignora
  // slide ativo da nuvem — a configuração visual dessa aba é específica
  // do card de comentário.
  const telaoClient = (
    <TelaoClient
      slug={slug}
      eventId={event.event_id}
      eventName={event.event_name}
      config={config}
      intervalSeconds={ev?.dispatch_interval_seconds ?? 3}
      preview={isPreview}
    />
  );

  let telao: React.ReactNode;
  if (isPreview) {
    telao = telaoClient;
  } else if (activeSlideType === 'comments' && activeCommentsConfig && activeSlideId) {
    telao = (
      <TelaoCommentsSwitcher
        slug={slug}
        eventId={event.event_id}
        eventName={event.event_name}
        initialActiveSlideId={activeSlideId}
        initialConfig={activeCommentsConfig}
        intervalSeconds={ev?.dispatch_interval_seconds ?? 3}
        showBackground={showWordcloudBackground}
      />
    );
  } else if (activeSlideType === 'open_ended' && activeOpenEndedConfig && activeSlideId) {
    telao = (
      <TelaoOpenEndedSwitcher
        eventId={event.event_id}
        slideId={activeSlideId}
        initialConfig={activeOpenEndedConfig}
        initialResponses={initialOpenEndedResponses}
        showBackground={showWordcloudBackground}
        joinUrl={showWordcloudBackground ? joinUrl : undefined}
        isOperator={isOperator}
      />
    );
  } else {
    telao = (
      <TelaoWordcloudSwitcher
        eventId={event.event_id}
        eventSlug={slug}
        initialWordcloudActive={cloudMode}
        initialWordcloudConfig={activeSlideConfig ?? wordcloudConfig}
        initialActiveSlideId={activeSlideId}
        initialWordcloudEntries={initialEntries}
        showBackground={showWordcloudBackground}
        joinUrl={showWordcloudBackground ? joinUrl : undefined}
        isOperator={isOperator}
      >
        {telaoClient}
      </TelaoWordcloudSwitcher>
    );
  }

  // Só envelopa com PipLauncher quando explicitamente requested via ?mode=chrome_pip.
  // Antes envelopava também quando !mode (visita direta), mas isso sobrepunha
  // o overlay "Janela flutuante" em cima do slide no fluxo normal de slides.
  if (isPreview) return telao;
  const staged = (
    <>
      <FullscreenAuto />
      <ActiveSlideWatcher
        eventId={event.event_id}
        initialActiveSlideId={activeSlideId}
        initialActiveType={activeSlideType}
      />
      <TelaoStage>{telao}</TelaoStage>
    </>
  );
  if (isPip) return <PipLauncher>{staged}</PipLauncher>;
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
