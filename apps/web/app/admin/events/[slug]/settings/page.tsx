import { notFound } from 'next/navigation';

import { AdminShell } from '@/components/audience/AdminShell';
import { PairingCodeDisplay } from '@/components/audience/PairingCodeDisplay';
import { requireUser } from '@/lib/auth/requireUser';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export default async function EventSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser();
  const { slug } = await params;
  const supabase = await getSupabaseServerClient();
  const { data: event } = await supabase
    .from('events')
    .select('id, name, slug, h2r_paired_at, h2r_last_heartbeat')
    .eq('slug', slug)
    .single();
  if (!event) notFound();

  return (
    <AdminShell userEmail={user.email ?? ''}>
      <h1 className="text-2xl font-display mb-2">Configurações — {event.name}</h1>
      <p className="text-ink/60 mb-6">URL pública: /e/{event.slug}</p>
      <PairingCodeDisplay
        eventId={event.id}
        alreadyPaired={Boolean(event.h2r_paired_at)}
        lastHeartbeat={event.h2r_last_heartbeat}
      />
    </AdminShell>
  );
}
