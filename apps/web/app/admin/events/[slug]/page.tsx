import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminShell } from '@/components/audience/AdminShell';
import { ModerationQueue } from '@/components/audience/ModerationQueue';
import { Button } from '@/components/ui/Button';
import { requireUser } from '@/lib/auth/requireUser';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export default async function EventModerationPage({
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

  const { data: subs } = await supabase
    .from('submissions')
    .select('id, name, comment, status, created_at, error_message')
    .eq('event_id', event.id)
    .order('created_at', { ascending: false })
    .limit(100);

  return (
    <AdminShell userEmail={user.email ?? ''}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-display">{event.name}</h1>
          <p className="text-sm text-ink/60">/e/{event.slug}</p>
        </div>
        <Link href={`/admin/events/${slug}/settings`}>
          <Button variant="ghost">Configurações</Button>
        </Link>
      </div>
      <ModerationQueue eventId={event.id} initial={subs ?? []} />
    </AdminShell>
  );
}
