import { AdminShell } from '@/components/audience/AdminShell';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { requireUser } from '@/lib/auth/requireUser';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { createEvent } from '@/server-actions/createEvent';

const errorMessages: Record<string, string> = {
  'slug-taken': 'Esse slug já está em uso. Escolha outro.',
  invalid: 'Dados inválidos. Verifique os campos.',
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
      <h1 className="text-2xl font-display mb-6">Novo evento</h1>
      <Card>
        {errorMessage ? (
          <div role="alert" className="mb-4 p-3 rounded-md bg-danger/10 text-danger text-sm">
            {errorMessage}
          </div>
        ) : null}
        <form action={createEvent} className="space-y-4">
          <Input label="Nome do evento" id="name" name="name" required maxLength={100} />
          <Input
            label="Slug da URL"
            id="slug"
            name="slug"
            required
            pattern="[a-z0-9-]+"
            helper="Aparece em audience.app/e/<slug>. Apenas minúsculas, números e hífens."
          />
          <label htmlFor="themeId" className="block">
            <span className="text-sm font-medium text-ink">Tema visual</span>
            <select
              id="themeId"
              name="themeId"
              required
              className="mt-1 block w-full h-11 px-3 rounded-md border border-ink/20 bg-paper text-ink"
              defaultValue={themes?.[0]?.id}
            >
              {themes?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <Button type="submit" className="w-full">
            Criar evento
          </Button>
        </form>
      </Card>
    </AdminShell>
  );
}
