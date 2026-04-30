import { NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next');
  const type = url.searchParams.get('type');

  if (code) {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // First-time invitee or password recovery → must define a password.
      const passwordSet = data.user.user_metadata?.password_set === true;
      if (type === 'recovery') {
        return NextResponse.redirect(new URL('/auth/reset-password', url));
      }
      if (!passwordSet) {
        return NextResponse.redirect(new URL('/auth/accept-invite', url));
      }
    }
  }

  return NextResponse.redirect(new URL(next ?? '/admin/events', url));
}
