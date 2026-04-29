import { AdminShell } from '@/components/audience/AdminShell';
import { NewEventForm } from '@/components/audience/NewEventForm';
import { Card } from '@/components/ui/Card';
import { requireUser } from '@/lib/auth/requireUser';
import { getSupabaseServerClient } from '@/lib/supabase/server';

const errorMessages: Record<string, string> = {
  invalid: 'Dados inválidos. Verifique os campos.',
  'invalid-name': 'Nome inválido. Use letras, números e espaços.',
  unknown: 'Não foi possível criar o evento. Tente novamente.',
};

export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const supabase = await getSupabaseServerClient();
  const { data: themes } = await supabase.from('themes').select('id, slug, name');
  const sp = await searchParams;
  const errorMessage = sp.error ? errorMessages[sp.error] : null;

  return (
    <AdminShell userEmail={user.email ?? ''}>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-display mb-2">Novo evento</h1>
        <p className="text-ink/60 mb-8">A URL pública será gerada automaticamente do nome.</p>
        <Card>
          {errorMessage ? (
            <div role="alert" className="mb-4 p-3 rounded-md bg-danger/10 text-danger text-sm">
              {errorMessage}
            </div>
          ) : null}
          <NewEventForm themes={themes ?? []} />
        </Card>
      </div>
    </AdminShell>
  );
}
