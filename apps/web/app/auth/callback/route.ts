import { NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@/lib/supabase/server';

const ALLOWED_NEXT = new Set(['/auth/accept-invite', '/auth/reset-password', '/admin/events']);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  const nextParam = url.searchParams.get('next');

  const supabase = await getSupabaseServerClient();

  // Route Handler runs on the server with a writable cookie store, so the
  // session that exchangeCodeForSession / verifyOtp produces actually persists
  // (unlike a Server Component, where cookie writes are silently dropped).
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  } else if (tokenHash && type) {
    await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as 'invite' | 'recovery' | 'magiclink' | 'email',
    });
  }

  // Explicit `next` wins (only if it's a known auth target — defends against
  // open-redirect via crafted callback URLs).
  if (nextParam && ALLOWED_NEXT.has(nextParam)) {
    return NextResponse.redirect(new URL(nextParam, url));
  }

  // Recovery flow — always lands on the new-password screen.
  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/auth/reset-password', url));
  }

  // Fresh invitee (no password yet) — funnel to accept-invite.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user && user.user_metadata?.password_set !== true) {
    return NextResponse.redirect(new URL('/auth/accept-invite', url));
  }

  return NextResponse.redirect(new URL('/admin/events', url));
}
