import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { signInWithEmail, signInWithPassword } from '@/server-actions/auth';

const errorMessages: Record<string, string> = {
  missing: 'Preencha email e senha.',
  invalid: 'Email ou senha incorretos.',
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/admin/events');

  const sp = await searchParams;
  const sent = sp.sent === '1';
  const errorMsg = sp.error ? errorMessages[sp.error] : null;

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface px-4">
      <Card className="w-full max-w-sm">
        <h1 className="text-2xl font-display mb-1">Entrar no Audience</h1>
        <p className="text-sm text-ink/60 mb-6">Use seu email e senha.</p>

        {sent ? (
          <div role="status" className="mb-4 p-3 rounded-md bg-success/10 text-success text-sm">
            Link mágico enviado! Verifique seu email.
          </div>
        ) : null}
        {errorMsg ? (
          <div role="alert" className="mb-4 p-3 rounded-md bg-danger/10 text-danger text-sm">
            {errorMsg}
          </div>
        ) : null}

        <form action={signInWithPassword} className="space-y-4">
          <Input label="Email" id="email" name="email" type="email" required autoComplete="email" />
          <Input
            label="Senha"
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
          />
          <Button type="submit" className="w-full">
            Entrar
          </Button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <div className="flex-1 h-px bg-ink/10" />
          <span className="text-xs text-ink/40">ou</span>
          <div className="flex-1 h-px bg-ink/10" />
        </div>

        <form action={signInWithEmail}>
          <p className="text-sm text-ink/60 mb-3">Esqueceu a senha? Receba um link mágico:</p>
          <div className="flex gap-2">
            <Input
              label=""
              id="magic-email"
              name="email"
              type="email"
              required
              placeholder="seu@email.com"
              className="flex-1"
            />
            <Button type="submit" variant="ghost" className="self-end">
              Enviar link
            </Button>
          </div>
        </form>

        <p className="mt-6 text-xs text-ink/40 text-center">
          Acesso por convite apenas. Peça pro admin te convidar.
        </p>
      </Card>
    </main>
  );
}
