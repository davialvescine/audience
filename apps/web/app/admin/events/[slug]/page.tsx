import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminShell } from '@/components/audience/AdminShell';
import { ModerationQueue } from '@/components/audience/ModerationQueue';
import { ShareCard } from '@/components/audience/ShareCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
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
    .select('id, name, slug, h2r_paired_at, h2r_last_heartbeat, submissions_open')
    .eq('slug', slug)
    .single();
  if (!event) notFound();

  const { data: subs } = await supabase
    .from('submissions')
    .select('id, name, comment, status, created_at, error_message')
    .eq('event_id', event.id)
    .order('created_at', { ascending: false })
    .limit(100);

  // Build absolute public URL using request host
  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3000';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  const publicUrl = `${proto}://${host}/e/${event.slug}`;

  // Counters
  const counts = {
    pending: subs?.filter((s) => s.status === 'pending').length ?? 0,
    sent: subs?.filter((s) => s.status === 'sent').length ?? 0,
    failed: subs?.filter((s) => s.status === 'failed').length ?? 0,
  };
  const isOnline =
    event.h2r_paired_at &&
    event.h2r_last_heartbeat &&
    Date.now() - new Date(event.h2r_last_heartbeat).getTime() < 90_000;

  return (
    <AdminShell userEmail={user.email ?? ''}>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-display text-ink">{event.name}</h1>
          <div className="mt-2 flex items-center gap-2 text-sm">
            {isOnline ? (
              <span className="inline-flex items-center gap-1.5 text-success font-medium">
                <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                H2R conectado
              </span>
            ) : event.h2r_paired_at ? (
              <span className="text-danger font-medium">⚠ H2R offline</span>
            ) : (
              <span className="text-ink/50">Não conectado ao H2R</span>
            )}
          </div>
        </div>
        <Link href={`/admin/events/${slug}/settings`}>
          <Button variant="ghost">Configurações</Button>
        </Link>
      </div>

      <div className="space-y-4 mb-6">
        <ShareCard publicUrl={publicUrl} />

        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center">
            <p className="text-3xl font-display font-bold text-ink">{counts.pending}</p>
            <p className="text-xs text-ink/60 uppercase tracking-wide">Pendentes</p>
          </Card>
          <Card className="text-center">
            <p className="text-3xl font-display font-bold text-success">{counts.sent}</p>
            <p className="text-xs text-ink/60 uppercase tracking-wide">No telão</p>
          </Card>
          <Card className="text-center">
            <p className="text-3xl font-display font-bold text-danger">{counts.failed}</p>
            <p className="text-xs text-ink/60 uppercase tracking-wide">Falhas</p>
          </Card>
        </div>
      </div>

      <ModerationQueue eventId={event.id} initial={subs ?? []} />
    </AdminShell>
  );
}
