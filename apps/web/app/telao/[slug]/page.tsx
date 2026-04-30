import { notFound } from 'next/navigation';

import { PipLauncher } from '@/components/telao/PipLauncher';
import { TelaoClient } from '@/components/telao/TelaoClient';
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

  const config: TelaoConfig = {
    ...DEFAULT_TELAO_CONFIG,
    ...((event.config as Partial<TelaoConfig>) ?? {}),
  };

  const isPreview = preview === '1';
  const isPip = mode === 'chrome_pip';

  const telao = (
    <TelaoClient
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
  if (isPreview) return telao;
  if (isPip || !mode) return <PipLauncher>{telao}</PipLauncher>;
  return telao;
}

// Force transparent background — overrides root layout
export const metadata = {
  title: 'Telão',
};
