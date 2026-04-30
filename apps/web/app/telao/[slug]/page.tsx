import { notFound } from 'next/navigation';

import { TelaoClient } from '@/components/telao/TelaoClient';
import { DEFAULT_TELAO_CONFIG, type TelaoConfig } from '@/lib/telao/config';
import { getSupabaseServiceClient } from '@/lib/supabase/service';

type Params = { slug: string };
type SearchParams = { preview?: string };

export default async function TelaoPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const supabase = getSupabaseServiceClient();
  const { data } = await supabase.rpc('get_telao_config', { p_slug: slug });
  const event = data?.[0];
  if (!event) notFound();

  const config: TelaoConfig = {
    ...DEFAULT_TELAO_CONFIG,
    ...((event.config as Partial<TelaoConfig>) ?? {}),
  };

  return (
    <TelaoClient
      eventId={event.event_id}
      eventName={event.event_name}
      config={config}
      preview={preview === '1'}
    />
  );
}

// Force transparent background — overrides root layout
export const metadata = {
  title: 'Telão',
};
