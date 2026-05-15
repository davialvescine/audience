import { Card } from '@/components/ui/Card';
import { confirmAuthLink } from '@/server-actions/confirmAuthLink';

type SearchParams = Promise<{
  token_hash?: string;
  type?: string;
  next?: string;
}>;

/**
 * Two-step confirmation: GET only renders a button; the token is consumed by
 * a POST (Server Action). This prevents corporate email scanners (Microsoft
 * Defender Safe Links, Proofpoint, etc.) from burning the one-time token
 * during automatic pre-fetch checks before the user clicks.
 */
export default async function AuthConfirmPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const tokenHash = params.token_hash ?? '';
  const type = params.type ?? '';
  const next = params.next ?? '';

  const subject = type === 'recovery' ? 'Redefinir senha' : 'Confirmar acesso';
  const description =
    type === 'recovery'
      ? 'Clica em continuar pra criar uma senha nova.'
      : 'Clica em continuar pra entrar no sistema.';

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface px-4">
      <Card className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-display mb-2">{subject}</h1>
        <p className="text-sm text-ink/60 mb-6">{description}</p>
        <form action={confirmAuthLink}>
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="type" value={type} />
          <input type="hidden" name="next" value={next} />
          <button
            type="submit"
            className="inline-block bg-primary text-paper px-6 py-3 rounded-lg text-sm font-medium hover:opacity-90 w-full"
          >
            Continuar
          </button>
        </form>
      </Card>
    </main>
  );
}
