import { ResetPasswordForm } from '@/components/audience/ResetPasswordForm';
import { Card } from '@/components/ui/Card';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export default async function ResetPasswordPage() {
  // Session is established by /auth/callback (Route Handler can write cookies).
  // This page just reads the session and renders the form.
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-surface px-4">
        <Card className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-display mb-2">Link inválido</h1>
          <p className="text-sm text-ink/60">
            Esse link expirou ou já foi usado. Volte ao login e peça um novo email de recuperação.
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface px-4">
      <Card className="w-full max-w-sm">
        <h1 className="text-2xl font-display mb-2">Nova senha</h1>
        <p className="text-sm text-ink/60 mb-6">Defina sua nova senha pra acessar o painel.</p>
        <ResetPasswordForm />
      </Card>
    </main>
  );
}
