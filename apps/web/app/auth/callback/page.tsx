import type { Route } from 'next';
import { redirect } from 'next/navigation';

import { AuthFragmentRecover } from '@/components/audience/AuthFragmentRecover';
import { getSupabaseServerClient } from '@/lib/supabase/server';

type SearchParams = Promise<{ next?: string; type?: string }>;

const ALLOWED_NEXT: ReadonlySet<Route> = new Set([
  '/auth/accept-invite',
  '/auth/reset-password',
  '/admin/events',
] as Route[]);

/**
 * Legacy callback for emails sent before the TokenHash template fix.
 * Old links arrive here with the session in the URL fragment (#access_token=...).
 * AuthFragmentRecover (client-side) parses the fragment, calls setSession, then
 * router.refresh() — at which point getUser() succeeds and we redirect to the
 * appropriate flow.
 */
export default async function AuthCallbackPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const candidate = params.next as Route | undefined;
    if (candidate && ALLOWED_NEXT.has(candidate)) redirect(candidate);
    if (params.type === 'recovery') redirect('/auth/reset-password');
    if (user.user_metadata?.password_set !== true) redirect('/auth/accept-invite');
    redirect('/admin/events');
  }

  return (
    <AuthFragmentRecover
      invalidTitle="Link inválido"
      invalidMessage="Esse link expirou ou já foi usado. Volte ao login pra pedir um novo."
    />
  );
}
