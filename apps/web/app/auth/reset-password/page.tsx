import { ResetPasswordForm } from '@/components/audience/ResetPasswordForm';
import { Card } from '@/components/ui/Card';
import { getSupabaseServerClient } from '@/lib/supabase/server';

type SearchParams = Promise<{ code?: string; token_hash?: string; type?: string }>;

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const supabase = await getSupabaseServerClient();

  if (params.code) {
    await supabase.auth.exchangeCodeForSession(params.code);
  }
  if (!params.code && params.token_hash && params.type) {
    await supabase.auth.verifyOtp({
      token_hash: params.token_hash,
      type: params.type as 'recovery',
    });
  }

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
