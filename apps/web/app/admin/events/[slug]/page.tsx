import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminShell } from '@/components/audience/AdminShell';
import { DispatchIntervalForm } from '@/components/audience/DispatchIntervalForm';
import { FlushQueueButton } from '@/components/audience/FlushQueueButton';
import { ModerationQueue } from '@/components/audience/ModerationQueue';
import { PairingCodeDisplay } from '@/components/audience/PairingCodeDisplay';
import { ShareCard } from '@/components/audience/ShareCard';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
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
    .select('id, name, slug, h2r_paired_at, h2r_last_heartbeat, submissions_open, dispatch_interval_seconds')
    .eq('slug', slug)
    .single();
  if (!event) notFound();

  const { data: subs } = await supabase
    .from('submissions')
    .select('id, name, comment, status, created_at, error_message')
    .eq('event_id', event.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3000';
  const proto = reqHeaders.get('x-forwarded-proto') ?? 'http';
  const publicUrl = `${proto}://${host}/e/${event.slug}`;

  const counts = {
    pending: subs?.filter((s) => s.status === 'pending').length ?? 0,
    queued: subs?.filter((s) => s.status === 'approved').length ?? 0,
    sent: subs?.filter((s) => s.status === 'sent').length ?? 0,
    failed: subs?.filter((s) => s.status === 'failed').length ?? 0,
  };
  const isOnline =
    event.h2r_paired_at &&
    event.h2r_last_heartbeat &&
    Date.now() - new Date(event.h2r_last_heartbeat).getTime() < 90_000;

  const tabs = [
    {
      id: 'moderation',
      label: `Moderação${counts.pending > 0 ? ` (${counts.pending})` : ''}`,
      content: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="text-center">
              <p className="text-3xl font-display font-bold text-ink">{counts.pending}</p>
              <p className="text-xs text-ink/60 uppercase tracking-wide">Pendentes</p>
            </Card>
            <Card className="text-center">
              <p className="text-3xl font-display font-bold text-accent">{counts.queued}</p>
              <p className="text-xs text-ink/60 uppercase tracking-wide">Na fila</p>
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
          <FlushQueueButton
            eventId={event.id}
            queuedCount={counts.queued}
            intervalSeconds={event.dispatch_interval_seconds ?? 3}
          />
          <ModerationQueue eventId={event.id} initial={subs ?? []} />
        </div>
      ),
    },
    {
      id: 'h2r',
      label: 'Conexão H2R',
      content: (
        <PairingCodeDisplay
          eventId={event.id}
          alreadyPaired={Boolean(event.h2r_paired_at)}
          lastHeartbeat={event.h2r_last_heartbeat}
        />
      ),
    },
    {
      id: 'share',
      label: 'Compartilhar',
      content: (
        <div className="space-y-4">
          <ShareCard publicUrl={publicUrl} />
          <Card>
            <h3 className="font-display text-lg mb-2">Como divulgar</h3>
            <ul className="space-y-2 text-sm text-ink/70">
              <li>• Cola o link no chat do evento, banner ou stories</li>
              <li>• Imprime o QR code e coloca no púlpito ou mesas</li>
              <li>• Mostra o QR no telão durante intervalos</li>
              <li>• Compartilha o link no WhatsApp do grupo</li>
            </ul>
          </Card>
          <Card>
            <h3 className="font-display text-lg mb-2">Convidar moderadores</h3>
            <p className="text-sm text-ink/70 mb-3">
              Quer mais alguém moderando junto com você? Convide pela página de usuários.
            </p>
            <Link
              href="/admin/users"
              className="inline-block text-sm text-primary hover:underline"
            >
              Ir pra Usuários →
            </Link>
          </Card>
        </div>
      ),
    },
    {
      id: 'settings',
      label: 'Configurações',
      content: (
        <div className="space-y-4">
          <Card>
            <h3 className="font-display text-lg mb-4">Disparos pra H2R</h3>
            <DispatchIntervalForm
              eventId={event.id}
              current={event.dispatch_interval_seconds ?? 3}
            />
          </Card>
          <Card>
            <h3 className="font-display text-lg mb-2">Outras configurações</h3>
            <p className="text-sm text-ink/60">
              Em breve: pausar submissões, renomear, deletar evento.
            </p>
          </Card>
        </div>
      ),
    },
  ];

  return (
    <AdminShell userEmail={user.email ?? ''}>
      <div className="mb-6">
        <h1 className="text-3xl font-display text-ink">{event.name}</h1>
        <div className="mt-2 flex items-center gap-3 text-sm">
          {isOnline ? (
            <span className="inline-flex items-center gap-1.5 text-success font-medium">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              H2R conectado
            </span>
          ) : event.h2r_paired_at ? (
            <span className="text-danger font-medium">⚠ H2R offline</span>
          ) : (
            <span className="text-ink/60">Não conectado ao H2R</span>
          )}
          <span className="text-ink/40">•</span>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener"
            className="text-primary hover:underline font-mono text-xs"
          >
            /e/{event.slug} ↗
          </a>
        </div>
      </div>

      <Tabs tabs={tabs} />
    </AdminShell>
  );
}
