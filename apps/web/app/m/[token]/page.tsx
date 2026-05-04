import { notFound } from 'next/navigation';

import { ModeratorClient } from '@/components/audience/ModeratorClient';
import { getSupabaseServiceClient } from '@/lib/supabase/service';

type Params = { token: string };

export const dynamic = 'force-dynamic';

export default async function ModeratorPage({ params }: { params: Promise<Params> }) {
  const { token } = await params;
  const supabase = getSupabaseServiceClient();

  // Resolve token → event metadata. Anything invalid → 404.
  const { data: row } = await supabase
    .from('moderator_tokens')
    .select('event_id, expires_at, revoked_at, display_name, events!inner(slug, name)')
    .eq('token', token)
    .maybeSingle();

  if (!row || row.revoked_at || new Date(row.expires_at) < new Date()) {
    notFound();
  }

  const event = (row as unknown as { events: { slug: string; name: string } }).events;

  // Initial submissions list (server-side, via SD bypass)
  const { data: subs } = await supabase
    .from('submissions')
    .select('id, name, comment, status, created_at, error_message')
    .eq('event_id', row.event_id)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <ModeratorClient
      token={token}
      eventName={event.name}
      moderatorName={row.display_name}
      initial={subs ?? []}
    />
  );
}

export const metadata = {
  title: 'Moderar — Audience',
};
