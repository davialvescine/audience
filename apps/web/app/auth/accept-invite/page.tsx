import { AcceptInviteForm } from '@/components/audience/AcceptInviteForm';
import { Card } from '@/components/ui/Card';

export default function AcceptInvitePage() {
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
