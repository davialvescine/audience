import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminShell } from '@/components/audience/AdminShell';
import { PairingCodeDisplay } from '@/components/audience/PairingCodeDisplay';
import { ShareCard } from '@/components/audience/ShareCard';
import { Button } from '@/components/ui/Button';
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

  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3000';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  const publicUrl = `${proto}://${host}/e/${event.slug}`;

  return (
    <AdminShell userEmail={user.email ?? ''}>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display text-ink">{event.name}</h1>
          <p className="text-sm text-ink/60 mt-1">Configurações</p>
        </div>
        <Link href={`/admin/events/${slug}`}>
          <Button variant="ghost">← Voltar pra moderação</Button>
        </Link>
      </div>

      <div className="space-y-4">
        <ShareCard publicUrl={publicUrl} />
        <PairingCodeDisplay
          eventId={event.id}
          alreadyPaired={Boolean(event.h2r_paired_at)}
          lastHeartbeat={event.h2r_last_heartbeat}
        />
      </div>
    </AdminShell>
  );
}
