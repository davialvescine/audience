import Link from 'next/link';

import { Card } from '@/components/ui/Card';

export default function AuthExpiredPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-surface px-4">
      <Card className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-display mb-2">Link expirou</h1>
        <p className="text-sm text-ink/70 mb-6">
          Esse link de email não é mais válido. Pode ter expirado, sido usado, ou ser de uma versão
          anterior do sistema.
        </p>
        <Link
          href={{ pathname: '/admin', query: { mode: 'forgot' } }}
          className="inline-block bg-primary text-paper px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90"
        >
          Pedir novo email
        </Link>
      </Card>
    </main>
  );
}
