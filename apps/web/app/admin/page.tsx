import Link from 'next/link';
import { redirect } from 'next/navigation';

import { LoginForm } from '@/components/audience/LoginForm';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string; mode?: string }>;
}) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect('/admin/events');

  const sp = await searchParams;

  return (
    <main className="min-h-screen bg-paper text-ink flex flex-col">
      <header className="border-b border-ink/10 dark:border-ink/15">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="font-display text-xl font-bold text-primary">
            Audience
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <LoginForm
            errorParam={sp.error}
            sentParam={sp.sent}
            initialMode={sp.mode === 'forgot' ? 'forgot' : 'password'}
          />
        </div>
      </div>

      <footer className="border-t border-ink/10 dark:border-ink/15 py-6 text-center text-xs text-ink/60">
        União Centro-Oeste Brasileira · Audience
      </footer>
    </main>
  );
}
