import { notFound } from 'next/navigation';

import { PipLauncher } from '@/components/telao/PipLauncher';
import { TelaoClient } from '@/components/telao/TelaoClient';
import { TelaoStage } from '@/components/telao/TelaoStage';
import { DEFAULT_TELAO_CONFIG, type TelaoConfig } from '@/lib/telao/config';
import { getSupabaseServiceClient } from '@/lib/supabase/service';

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

  const telao = (
    <TelaoClient
      slug={slug}
      eventId={event.event_id}
      eventName={event.event_name}
      config={config}
      preview={isPreview}
    />
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
