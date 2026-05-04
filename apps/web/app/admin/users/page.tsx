import { AdminShell } from '@/components/audience/AdminShell';
import { InviteUserForm } from '@/components/audience/InviteUserForm';
import { ResendInviteButton } from '@/components/audience/ResendInviteButton';
import { UsersList } from '@/components/audience/UsersList';
import { Card } from '@/components/ui/Card';
import { requireUser } from '@/lib/auth/requireUser';
import { getSupabaseServiceClient } from '@/lib/supabase/service';

export default async function AdminUsersPage() {
  const user = await requireUser();
  const supabase = getSupabaseServiceClient();

  const { data: usersData } = await supabase.auth.admin.listUsers();
  const users = (usersData?.users ?? []).map((u) => ({
    id: u.id,
    email: u.email ?? '(sem email)',
    last_sign_in_at: u.last_sign_in_at,
    created_at: u.created_at,
  }));

  const { data: invites } = await supabase
    .from('invitations')
    .select('id, email, expires_at, accepted_at, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  return (
    <AdminShell userEmail={user.email ?? ''}>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-display mb-2">Usuários</h1>
        <p className="text-ink/60 mb-8">
          Convide pessoas pra moderar eventos com você. Quem é convidado recebe um email pra criar a senha.
        </p>

        <Card className="mb-6">
          <h2 className="text-xl font-display mb-4">Convidar novo usuário</h2>
          <InviteUserForm />
        </Card>

        <Card className="mb-6">
          <h2 className="text-xl font-display mb-4">
            Pessoas com acesso ({users.length})
          </h2>
          <UsersList users={users} />
        </Card>

        {invites && invites.length > 0 ? (
          <Card>
            <h2 className="text-xl font-display mb-4">Convites recentes</h2>
            <ul className="divide-y divide-ink/10 dark:divide-ink/15">
              {invites.map((i) => {
                const expired = new Date(i.expires_at) < new Date();
                const canResend = !i.accepted_at;
                return (
                  <li key={i.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-ink truncate">{i.email}</p>
                      <p className="text-xs text-ink/60" suppressHydrationWarning>
                        {new Date(i.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {canResend ? <ResendInviteButton email={i.email} /> : null}
                      {i.accepted_at ? (
                        <span className="text-xs text-success bg-success/15 dark:bg-success/20 px-2 py-1 rounded-sm">
                          Aceito
                        </span>
                      ) : expired ? (
                        <span className="text-xs text-ink/60 bg-ink/5 dark:bg-ink/10 px-2 py-1 rounded-sm">
                          Expirado
                        </span>
                      ) : (
                        <span className="text-xs text-secondary bg-secondary/15 dark:bg-secondary/20 px-2 py-1 rounded-sm">
                          Pendente
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : null}
      </div>
    </AdminShell>
  );
}
