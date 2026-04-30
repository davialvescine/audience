'use server';

import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@/lib/supabase/server';

const ALLOWED_NEXT = new Set(['/auth/accept-invite', '/auth/reset-password', '/admin/events']);

type OtpType = 'invite' | 'recovery' | 'magiclink' | 'email' | 'signup';

export async function confirmAuthLink(formData: FormData) {
  const tokenHash = String(formData.get('token_hash') ?? '');
  const type = String(formData.get('type') ?? '') as OtpType;
  const next = String(formData.get('next') ?? '');

  if (!tokenHash || !type) {
    redirect('/auth/expired');
  }

  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  if (error) {
    redirect('/auth/expired');
  }

  if (next && ALLOWED_NEXT.has(next)) {
    redirect(next as '/auth/accept-invite' | '/auth/reset-password' | '/admin/events');
  }
  if (type === 'recovery') redirect('/auth/reset-password');
  if (type === 'invite' || type === 'signup') redirect('/auth/accept-invite');
  redirect('/admin/events');
}
