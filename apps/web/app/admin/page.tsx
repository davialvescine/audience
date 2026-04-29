import { redirect } from 'next/navigation';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { signInWithEmail } from '@/server-actions/auth';

type SearchParams = { sent?: string };

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/admin/events');

  const sp = await searchParams;
  const sent = sp.sent === '1';

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface px-4">
      <Card className="w-full max-w-sm">
        <h1 className="text-2xl font-display mb-6">Entrar no Audience</h1>
        {sent ? (
          <div role="status" className="mb-4 p-3 rounded-md bg-success/10 text-success text-sm">
            Link enviado! Verifique seu e-mail.
          </div>
        ) : null}
        <form action={signInWithEmail} className="space-y-4">
          <Input label="Seu e-mail" id="email" name="email" type="email" required />
          <Button type="submit" className="w-full">
            Enviar link mágico
          </Button>
        </form>
      </Card>
    </main>
  );
}
