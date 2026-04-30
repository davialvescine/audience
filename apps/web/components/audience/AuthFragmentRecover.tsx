'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Card } from '@/components/ui/Card';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

type Status = 'checking' | 'no-tokens' | 'recovering' | 'failed';

type Props = {
  invalidTitle: string;
  invalidMessage: string;
};

/**
 * Fallback for legacy implicit-flow links that put tokens in the URL fragment
 * (#access_token=...&refresh_token=...). Server Components can't read fragments,
 * so when getUser() returns null we render this client component which:
 *   1. parses window.location.hash for tokens
 *   2. calls setSession to persist them via the SSR cookie store
 *   3. router.refresh() so the parent Server Component re-renders authenticated
 */
export function AuthFragmentRecover({ invalidTitle, invalidMessage }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>('checking');

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) {
      setStatus('no-tokens');
      return;
    }
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    if (!accessToken || !refreshToken) {
      setStatus('no-tokens');
      return;
    }

    setStatus('recovering');
    // Strip the fragment so reloads don't re-process it.
    window.history.replaceState({}, '', window.location.pathname + window.location.search);

    const supabase = getSupabaseBrowserClient();
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          setStatus('failed');
        } else {
          router.refresh();
        }
      });
  }, [router]);

  if (status === 'checking' || status === 'recovering') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-surface px-4">
        <Card className="w-full max-w-sm text-center">
          <p className="text-sm text-ink/60">Validando link...</p>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-surface px-4">
      <Card className="w-full max-w-sm text-center">
        <h1 className="text-2xl font-display mb-2">{invalidTitle}</h1>
        <p className="text-sm text-ink/60">{invalidMessage}</p>
      </Card>
    </main>
  );
}
