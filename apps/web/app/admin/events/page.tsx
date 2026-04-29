import Link from 'next/link';

import { AdminShell } from '@/components/audience/AdminShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { requireUser } from '@/lib/auth/requireUser';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export default async function AdminEventsPage() {
  const user = await requireUser();
  const supabase = await getSupabaseServerClient();
  const { data: events } = await supabase
    .from('events')
    .select('id, slug, name, h2r_paired_at, h2r_last_heartbeat')
    .order('created_at', { ascending: false });

  return (
    <AdminShell userEmail={user.email ?? ''}>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display">Eventos</h1>
        <Link href="/admin/events/new">
          <Button>+ Novo evento</Button>
        </Link>
      </div>
      {events && events.length > 0 ? (
        <div className="grid gap-4">
          {events.map((e) => (
            <Card key={e.id}>
              <Link href={`/admin/events/${e.slug}`} className="block">
                <h2 className="font-display text-lg text-ink">{e.name}</h2>
                <p className="text-sm text-ink/60">/e/{e.slug}</p>
                {e.h2r_paired_at ? (
                  <p className="mt-2 text-xs text-success">✓ H2R conectado</p>
                ) : (
                  <p className="mt-2 text-xs text-ink/40">⚠ H2R não conectado</p>
                )}
              </Link>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nenhum evento ainda"
          description="Crie o primeiro pra começar a receber comentários."
          action={
            <Link href="/admin/events/new">
              <Button>+ Novo evento</Button>
            </Link>
          }
        />
      )}
    </AdminShell>
  );
}
