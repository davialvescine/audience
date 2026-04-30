import { redirect } from 'next/navigation';

import { AcceptInviteForm } from '@/components/audience/AcceptInviteForm';
import { AuthFragmentRecover } from '@/components/audience/AuthFragmentRecover';
import { Card } from '@/components/ui/Card';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export default async function AcceptInvitePage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <AuthFragmentRecover
        invalidTitle="Convite inválido"
        invalidMessage="Esse link expirou ou já foi usado. Peça pro admin reenviar o convite."
      />
    );
  }

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
