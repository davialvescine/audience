import { AdminShell } from '@/components/audience/AdminShell';
import { requireUser } from '@/lib/auth/requireUser';

type Params = { slug: string };

export default async function EventSettingsPage({ params }: { params: Promise<Params> }) {
  const user = await requireUser();
  const { slug } = await params;

  return (
    <AdminShell userEmail={user.email ?? ''}>
      <h1 className="text-2xl font-display mb-6">Configurações: {slug}</h1>
      <p className="text-ink/60">Em breve.</p>
    </AdminShell>
  );
}
