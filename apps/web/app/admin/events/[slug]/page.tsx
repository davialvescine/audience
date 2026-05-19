import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { AdminShell } from '@/components/audience/AdminShell';
import { CommentsTab } from '@/components/audience/CommentsTab';
import { EventMembers } from '@/components/audience/EventMembers';
import { EventSettings } from '@/components/audience/EventSettings';
import { FlushQueueButton } from '@/components/audience/FlushQueueButton';
import { H2RStatusBadge } from '@/components/audience/H2RStatusBadge';
import { ModeratorLinks } from '@/components/audience/ModeratorLinks';
import { QueueControls } from '@/components/audience/QueueControls';
import { ModerationQueue } from '@/components/audience/ModerationQueue';
import { SlidesTab } from '@/components/audience/SlidesTab';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import { requireUser } from '@/lib/auth/requireUser';
import type { Slide } from '@/lib/slides/types';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { TelaoDisplayMode } from '@/lib/telao/config';

// Sempre fresh: evento e global, multiplos moderadores. Cada GET puxa
// DB pra refletir mudancas que outro moderador fez (polling de 2s
// nas listas + force-dynamic na pagina = state coerente entre tabs).
export const dynamic = 'force-dynamic';
export const revalidate = 0;

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
    .select(
      'id, name, slug, h2r_paired_at, h2r_last_heartbeat, submissions_open, dispatch_interval_seconds, enabled_display_modes, owner_id, pinned_submission_id, auto_send_on_approve',
    )
    .eq('slug', slug)
    .single();
  if (!event) notFound();

  const { data: wcRow } = await supabase
    .from('events')
    .select('active_slide_id')
    .eq('id', event.id)
    .maybeSingle();
  const activeSlideId = wcRow?.active_slide_id ?? null;

  const { data: slidesRaw } = await supabase.rpc('list_slides', { p_event_id: event.id });
  const slides = (slidesRaw ?? []) as Slide[];

  const isOwner = event.owner_id === user.id;

  const { data: members } = await supabase.rpc('list_event_members', {
    p_event_id: event.id,
  });

  const { data: platformUsers } = isOwner
    ? await supabase.rpc('list_platform_users')
    : { data: [] as Array<{ user_id: string; email: string }> };

  const { data: subs } = await supabase
    .from('submissions')
    .select('id, name, comment, status, created_at, error_message, display_count')
    .eq('event_id', event.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const { data: modTokens } = await supabase
    .from('moderator_tokens')
    .select('id, token, display_name, expires_at, revoked_at, last_used_at, created_at')
    .eq('event_id', event.id)
    .order('created_at', { ascending: false });

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
  const moderationContent = (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="text-center">
          <p className="text-3xl font-display font-bold text-ink">{counts.pending}</p>
          <p className="text-xs text-ink/60 uppercase tracking-wide">Aguardando</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-display font-bold text-accent">{counts.queued}</p>
          <p className="text-xs text-ink/60 uppercase tracking-wide">Na fila</p>
        </Card>
        <Card className="text-center">
          <p className="text-3xl font-display font-bold text-success">{counts.sent}</p>
          <p className="text-xs text-ink/60 uppercase tracking-wide">Exibidas</p>
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
      <QueueControls
        eventId={event.id}
        initialSubmissionsOpen={event.submissions_open}
        pendingCount={counts.pending}
      />
      {/* Link pra moderador externo — visível ANTES da fila pra owner
          conseguir compartilhar com voluntários sem rolar a página toda.
          Collapsed por default via <details>, expande quando preciso. */}
      <ModeratorLinks
        eventId={event.id}
        baseUrl={`${proto}://${host}`}
        existing={modTokens ?? []}
      />
      <ModerationQueue
        eventId={event.id}
        initial={subs ?? []}
        pinnedSubmissionId={event.pinned_submission_id}
        initialAutoSendOnApprove={
          (event as { auto_send_on_approve?: boolean }).auto_send_on_approve === true
        }
      />
    </div>
  );

  const tabs = [
    {
      id: 'comments',
      label: `Comentários${counts.pending > 0 ? ` (${counts.pending})` : ''}`,
      content: (
        <CommentsTab moderation={moderationContent} pendingCount={counts.pending} />
      ),
    },
    {
      id: 'slides',
      label: activeSlideId ? 'Slides ●' : 'Slides',
      content: (
        <SlidesTab
          eventId={event.id}
          slug={event.slug}
          publicUrl={publicUrl}
          telaoUrl={`${proto}://${host}/telao/${event.slug}`}
          initialSlides={slides}
          initialActiveSlideId={activeSlideId}
        />
      ),
    },
    {
      id: 'settings',
      label: 'Configurações',
      content: (
        <div className="space-y-4">
          <EventSettings eventId={event.id} initialName={event.name} />
          <EventMembers
            eventId={event.id}
            currentUserId={user.id}
            initialMembers={
              (members ?? []) as Array<{
                user_id: string;
                email: string;
                added_at: string;
                is_owner: boolean;
              }>
            }
            platformUsers={(platformUsers ?? []) as Array<{ user_id: string; email: string }>}
            isOwner={isOwner}
          />
          <Card>
            <p className="text-xs text-ink/50">
              Dica: link de moderador externo ficou na aba <strong>Comentários</strong>.
              Configurações de exibição/H2R ficam no painel de cada slide.
            </p>
          </Card>
        </div>
      ),
    },
  ];

  const enabledModes = (event.enabled_display_modes as TelaoDisplayMode[] | null) ?? [];
  const showH2RBadge = enabledModes.includes('h2r');

  return (
    <AdminShell userEmail={user.email ?? ''}>
      <div className="mb-6">
        <h1 className="text-3xl font-display text-ink">{event.name}</h1>
        <div className="mt-2 flex items-center gap-3 text-sm">
          {showH2RBadge ? (
            <>
              <H2RStatusBadge
                pairedAt={event.h2r_paired_at}
                lastHeartbeat={event.h2r_last_heartbeat}
              />
              <span className="text-ink/40">•</span>
            </>
          ) : null}
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
