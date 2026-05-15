import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminShell } from '@/components/audience/AdminShell';
import { EventMembers } from '@/components/audience/EventMembers';
import { EventSettings } from '@/components/audience/EventSettings';
import { FlushQueueButton } from '@/components/audience/FlushQueueButton';
import { H2RStatusBadge } from '@/components/audience/H2RStatusBadge';
import { ModeratorLinks } from '@/components/audience/ModeratorLinks';
import { QueueControls } from '@/components/audience/QueueControls';
import { ModerationQueue } from '@/components/audience/ModerationQueue';
import { ShareCard } from '@/components/audience/ShareCard';
import { SlidesTab } from '@/components/audience/SlidesTab';
import { TelaoTab } from '@/components/audience/TelaoTab';
import { WordcloudTab } from '@/components/audience/WordcloudTab';
import { Card } from '@/components/ui/Card';
import { Tabs } from '@/components/ui/Tabs';
import type { WordcloudConfig } from '@/hooks/useWordcloudActive';
import { requireUser } from '@/lib/auth/requireUser';
import type { Slide } from '@/lib/slides/types';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { DEFAULT_TELAO_CONFIG, type TelaoConfig, type TelaoDisplayMode } from '@/lib/telao/config';

const DEFAULT_WORDCLOUD_CONFIG: WordcloudConfig = {
  question: 'Em uma palavra, o que você espera deste evento?',
  maxWordsPerSubmission: 1,
  filterStopwords: true,
  filterProfanity: true,
  palette: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3', '#A8E6CF'],
  showTotal: true,
};

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
      'id, name, slug, h2r_paired_at, h2r_last_heartbeat, submissions_open, dispatch_interval_seconds, telao_config, telao_configs, enabled_display_modes, owner_id, pinned_submission_id',
    )
    .eq('slug', slug)
    .single();
  if (!event) notFound();

  const { data: wcRow } = await supabase
    .from('events')
    .select('wordcloud_active, wordcloud_config, active_slide_id')
    .eq('id', event.id)
    .maybeSingle();
  const wordcloudActive = wcRow?.wordcloud_active ?? false;
  const wordcloudConfig =
    (wcRow?.wordcloud_config as WordcloudConfig | null) ?? DEFAULT_WORDCLOUD_CONFIG;
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
  const tabs = [
    {
      id: 'moderation',
      label: `Moderação${counts.pending > 0 ? ` (${counts.pending})` : ''}`,
      content: (
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
          <ModerationQueue
            eventId={event.id}
            initial={subs ?? []}
            pinnedSubmissionId={event.pinned_submission_id}
          />
        </div>
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
      id: 'wordcloud',
      label: wordcloudActive ? 'Nuvem (legado) ●' : 'Nuvem (legado)',
      content: (
        <WordcloudTab
          eventId={event.id}
          slug={event.slug}
          initialActive={wordcloudActive}
          initialConfig={wordcloudConfig}
          publicUrl={publicUrl}
          telaoUrl={`${proto}://${host}/telao/${event.slug}`}
        />
      ),
    },
    {
      id: 'telao',
      label: 'Telão',
      content: (
        <TelaoTab
          eventId={event.id}
          slug={event.slug}
          initialConfig={{
            ...DEFAULT_TELAO_CONFIG,
            ...((event.telao_config as Partial<TelaoConfig>) ?? {}),
          }}
          initialModes={(event.enabled_display_modes as TelaoDisplayMode[] | null) ?? ['h2r']}
          initialOverrides={
            (event.telao_configs as Partial<Record<TelaoDisplayMode, TelaoConfig>> | null) ?? {}
          }
          publicTelaoUrl={`${proto}://${host}/telao/${event.slug}`}
          h2r={{
            alreadyPaired: Boolean(event.h2r_paired_at),
            lastHeartbeat: event.h2r_last_heartbeat,
            dispatchIntervalSeconds: event.dispatch_interval_seconds ?? 3,
          }}
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
            <Link href="/admin/users" className="inline-block text-sm text-primary hover:underline">
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
          <ModeratorLinks
            eventId={event.id}
            baseUrl={`${proto}://${host}`}
            existing={modTokens ?? []}
          />
          <Card>
            <p className="text-xs text-ink/50">
              Dica: configurações de exibição e disparos pra H2R ficam na aba <strong>Telão</strong>
              .
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
