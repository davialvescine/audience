import { redirect } from 'next/navigation';

import { AcceptInviteForm } from '@/components/audience/AcceptInviteForm';
import { Card } from '@/components/ui/Card';
import { getSupabaseServerClient } from '@/lib/supabase/server';

type SearchParams = Promise<{
  code?: string;
  token_hash?: string;
  type?: string;
  error?: string;
  error_description?: string;
}>;

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const supabase = await getSupabaseServerClient();

  // PKCE flow — invite link sends ?code=...
  if (params.code) {
    await supabase.auth.exchangeCodeForSession(params.code);
  }

  // OTP flow fallback — older tokens may use ?token_hash=&type=invite
  if (!params.code && params.token_hash && params.type) {
    await supabase.auth.verifyOtp({
      token_hash: params.token_hash,
      type: params.type as 'invite' | 'recovery' | 'email',
    });
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-surface px-4">
        <Card className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-display mb-2">Convite inválido</h1>
          <p className="text-sm text-ink/60">
            Esse link expirou ou já foi usado. Peça pro admin reenviar o convite.
          </p>
        </Card>
      </main>
    );
  }

  // Already set their password — straight to dashboard.
  if (user.user_metadata?.password_set === true) {
    redirect('/admin/events');
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface px-4">
      <Card className="w-full max-w-sm">
        <h1 className="text-2xl font-display mb-2">Defina sua senha</h1>
        <p className="text-sm text-ink/60 mb-6">
          Você foi convidado pro Audience. Crie uma senha pra acessar o painel.
        </p>
        <AcceptInviteForm />
      </Card>
    </main>
  );
}
