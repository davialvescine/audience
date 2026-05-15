import Link from 'next/link';

import { AdminShell } from '@/components/audience/AdminShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { requireUser } from '@/lib/auth/requireUser';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function AdminEventsPage() {
  const user = await requireUser();
  const supabase = await getSupabaseServerClient();
  const { data: events } = await supabase
    .from('events')
    .select('id, slug, name, h2r_paired_at, h2r_last_heartbeat, submissions_open, created_at')
    .order('created_at', { ascending: false });

  return (
    <AdminShell userEmail={user.email ?? ''}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display text-ink">Eventos</h1>
          <p className="text-ink/60 mt-1">
            {events?.length ?? 0} evento{(events?.length ?? 0) === 1 ? '' : 's'}
          </p>
        </div>
        <Link href="/admin/events/new">
          <Button size="lg">+ Novo evento</Button>
        </Link>
      </div>

      {events && events.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {events.map((e) => {
            const isOnline =
              e.h2r_paired_at &&
              e.h2r_last_heartbeat &&
              Date.now() - new Date(e.h2r_last_heartbeat).getTime() < 90_000;
            return (
              <Link key={e.id} href={`/admin/events/${e.slug}`} className="block group">
                <Card className="h-full transition hover:shadow-md hover:border-accent/50 dark:hover:border-accent/40">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h2 className="font-display text-xl text-ink group-hover:text-primary transition">
                      {e.name}
                    </h2>
                    {isOnline ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-success bg-success/15 dark:bg-success/20 px-2 py-1 rounded-sm whitespace-nowrap">
                        <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
                        Ao vivo
                      </span>
                    ) : e.h2r_paired_at ? (
                      <span className="text-xs text-danger bg-danger/15 dark:bg-danger/20 px-2 py-1 rounded-sm whitespace-nowrap">
                        Offline
                      </span>
                    ) : (
                      <span className="text-xs text-ink/60 bg-ink/5 dark:bg-ink/10 px-2 py-1 rounded-sm whitespace-nowrap">
                        Não conectado
                      </span>
                    )}
                  </div>
                  <p className="font-mono text-xs text-ink/70 mb-2">/e/{e.slug}</p>
                  <p className="text-xs text-ink/50">
                    {e.submissions_open ? 'Aberto pra submissões' : 'Submissões pausadas'}
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20 dark:from-primary/10 dark:to-accent/10 dark:border-primary/30">
          <EmptyState
            title="Nenhum evento ainda"
            description="Crie seu primeiro evento — leva uns 30 segundos."
            action={
              <Link href="/admin/events/new">
                <Button size="lg">Criar primeiro evento</Button>
              </Link>
            }
          />
        </Card>
      )}
    </AdminShell>
  );
}
