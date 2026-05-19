import { unstable_noStore as noStore } from 'next/cache';
import { notFound } from 'next/navigation';

import { ActiveSlideWatcher } from '@/components/telao/ActiveSlideWatcher';
import { FullscreenAuto } from '@/components/telao/FullscreenAuto';
import { PipLauncher } from '@/components/telao/PipLauncher';
import { TelaoClient } from '@/components/telao/TelaoClient';
import { TelaoCommentsSwitcher } from '@/components/telao/TelaoCommentsSwitcher';
import { TelaoOpenEndedSwitcher } from '@/components/telao/TelaoOpenEndedSwitcher';
import { TelaoPollSwitcher } from '@/components/telao/TelaoPollSwitcher';
import { TelaoStage } from '@/components/telao/TelaoStage';
import { TelaoWordcloudSwitcher } from '@/components/telao/TelaoWordcloudSwitcher';
import type { OpenEndedResponse } from '@/hooks/useOpenEndedResponses';
import type { WordcloudConfig } from '@/hooks/useWordcloudActive';
import {
  DEFAULT_COMMENTS_CONFIG,
  DEFAULT_OPEN_ENDED_CONFIG,
  DEFAULT_POLL_CONFIG,
  type CommentsConfig,
  type OpenEndedConfig,
  type PollConfig,
} from '@/lib/slides/types';
import { DEFAULT_TELAO_CONFIG, type TelaoConfig } from '@/lib/telao/config';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import type { WordEntry } from '@/lib/wordcloud/types';

type Params = { slug: string };
type SearchParams = { preview?: string; mode?: string };

export default async function TelaoPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  // noStore() opt-out de qualquer cache (memoização de fetch, route cache,
  // etc). Garante SELECTs sempre frescas do DB — caro ficar adivinhando
  // se o cache do Next 16 está nos enganando.
  noStore();
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
    .select('active_slide_id')
    .eq('id', event.event_id)
    .maybeSingle();
  const activeSlideId = (wcRow?.active_slide_id as string | null) ?? null;

  // Fetch active slide config.
  let activeSlideConfig: WordcloudConfig | null = null;
  let activeSlideType: 'wordcloud' | 'open_ended' | 'comments' | 'poll' | null = null;
  let activeOpenEndedConfig: OpenEndedConfig | null = null;
  let activeCommentsConfig: CommentsConfig | null = null;
  let activePollConfig: PollConfig | null = null;
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
    } else if (slideRow?.type === 'poll') {
      activePollConfig = { ...DEFAULT_POLL_CONFIG, ...((slideRow.config as Partial<PollConfig>) ?? {}) };
      activeSlideType = 'poll';
    }
  }

  // Pra poll, busca contagens iniciais do slide ativo.
  let initialPollCounts: number[] = [];
  if (activeSlideType === 'poll' && activeSlideId && activePollConfig) {
    type PollRow = { option_index: number; vote_count: number | string };
    const { data: pollRows } = (await (supabase.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: PollRow[] | null; error: { message: string } | null }>)(
      'get_poll_state',
      { p_slug: slug, p_slide_id: activeSlideId },
    )) as { data: PollRow[] | null };
    initialPollCounts = Array(activePollConfig.options.length).fill(0);
    for (const r of pollRows ?? []) {
      if (r.option_index >= 0 && r.option_index < initialPollCounts.length) {
        initialPollCounts[r.option_index] = Number(r.vote_count);
      }
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

  // Telão fica em modo nuvem quando tem slide ativo do tipo wordcloud.
  const cloudMode = activeSlideConfig !== null;

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

  let telao: React.ReactNode;
  if (isPreview) {
    // Preview legado (?preview=1): renderiza TelaoClient direto com config
    // global (events.telao_config). Mantido pra compat com URLs antigas
    // de iframe; ninguém deveria estar criando preview novo desse jeito.
    telao = (
      <TelaoClient
        slug={slug}
        eventId={event.event_id}
        eventName={event.event_name}
        config={config}
        intervalSeconds={ev?.dispatch_interval_seconds ?? 3}
        preview
      />
    );
  } else if (activeSlideType === 'comments' && activeCommentsConfig && activeSlideId) {
    telao = (
      <TelaoCommentsSwitcher
        // key força remount quando slide muda — sem isso, state interno do
        // useActiveSlideConfig (que inicializa só na primeira render) fica
        // grudado na config do slide anterior e props novos do SSR são
        // ignorados, vazando config entre slides.
        key={activeSlideId}
        slug={slug}
        eventId={event.event_id}
        eventName={event.event_name}
        initialActiveSlideId={activeSlideId}
        initialConfig={activeCommentsConfig}
        intervalSeconds={ev?.dispatch_interval_seconds ?? 3}
        showBackground={showWordcloudBackground}
        joinUrl={showWordcloudBackground ? joinUrl : undefined}
        isOperator={isOperator}
      />
    );
  } else if (activeSlideType === 'poll' && activePollConfig && activeSlideId) {
    telao = (
      <TelaoPollSwitcher
        key={activeSlideId}
        slug={slug}
        eventId={event.event_id}
        slideId={activeSlideId}
        initialConfig={activePollConfig}
        initialCounts={initialPollCounts}
        showBackground={showWordcloudBackground}
        joinUrl={showWordcloudBackground ? joinUrl : undefined}
        isOperator={isOperator}
      />
    );
  } else if (activeSlideType === 'open_ended' && activeOpenEndedConfig && activeSlideId) {
    telao = (
      <TelaoOpenEndedSwitcher
        key={activeSlideId}
        eventId={event.event_id}
        slideId={activeSlideId}
        initialConfig={activeOpenEndedConfig}
        initialResponses={initialOpenEndedResponses}
        showBackground={showWordcloudBackground}
        joinUrl={showWordcloudBackground ? joinUrl : undefined}
        isOperator={isOperator}
      />
    );
  } else if (activeSlideType === 'wordcloud' && activeSlideId) {
    // Slide do tipo wordcloud explícito.
    telao = (
      <TelaoWordcloudSwitcher
        key={activeSlideId}
        eventId={event.event_id}
        eventSlug={slug}
        initialWordcloudConfig={activeSlideConfig!}
        initialActiveSlideId={activeSlideId}
        initialWordcloudEntries={initialEntries}
        showBackground={showWordcloudBackground}
        joinUrl={showWordcloudBackground ? joinUrl : undefined}
        isOperator={isOperator}
      />
    );
  } else {
    // Sem slide ativo. NÃO cai mais no fallback legado (events.telao_config)
    // que confundia o operador mostrando cores antigas como se fosse um
    // slide. Mostra placeholder limpo — operador deve ativar um slide.
    telao = (
      <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#0A2540' }}>
        <div className="text-center text-paper/70 max-w-2xl px-12">
          <p className="text-5xl font-display mb-4">Nenhum slide ativo</p>
          <p className="text-2xl text-paper/55">
            Selecione um slide no painel pra começar
          </p>
        </div>
      </div>
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
