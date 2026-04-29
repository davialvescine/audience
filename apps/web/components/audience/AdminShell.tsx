import Link from 'next/link';
import type { ReactNode } from 'react';

import { signOut } from '@/server-actions/auth';

type Props = { children: ReactNode; userEmail: string };

export function AdminShell({ children, userEmail }: Props) {
  return (
    <div className="min-h-screen bg-surface">
      <header className="bg-paper border-b border-ink/10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/admin/events" className="font-display text-lg text-primary">
            Audience
          </Link>
          <form action={signOut} className="flex items-center gap-3">
            <span className="text-sm text-ink/60">{userEmail}</span>
            <button type="submit" className="text-sm text-ink/70 hover:text-danger">
              Sair
            </button>
          </form>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
