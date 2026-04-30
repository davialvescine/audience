import { NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@/lib/supabase/server';

const ALLOWED_NEXT = new Set(['/auth/accept-invite', '/auth/reset-password', '/admin/events']);

type OtpType = 'invite' | 'recovery' | 'magiclink' | 'email' | 'signup';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as OtpType | null;
  const next = url.searchParams.get('next');

  if (!tokenHash || !type) {
    return NextResponse.redirect(new URL('/auth/expired', url));
  }

  // verifyOtp consumes the email-link token AND persists the session via the
  // server cookie store (Route Handlers can write cookies, unlike Server
  // Components). This is the path that actually establishes the auth state
  // before the user lands on /auth/accept-invite or /auth/reset-password.
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error) {
    return NextResponse.redirect(new URL('/auth/expired', url));
  }

  // Honour the explicit destination if it's a known auth target.
  if (next && ALLOWED_NEXT.has(next)) {
    return NextResponse.redirect(new URL(next, url));
  }

  // Sensible defaults per type.
  if (type === 'recovery') {
    return NextResponse.redirect(new URL('/auth/reset-password', url));
  }
  if (type === 'invite' || type === 'signup') {
    return NextResponse.redirect(new URL('/auth/accept-invite', url));
  }
  return NextResponse.redirect(new URL('/admin/events', url));
}
