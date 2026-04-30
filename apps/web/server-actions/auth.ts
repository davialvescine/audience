'use server';

import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseServiceClient } from '@/lib/supabase/service';

export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!email || !password) {
    redirect('/admin?error=missing');
  }
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    redirect('/admin?error=invalid');
  }
  redirect('/admin/events');
}

export async function requestPasswordReset(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) return;
  // Use the service client (non-PKCE) so the email link contains a regular OTP
  // token_hash, not the pkce_-prefixed kind. PKCE tokens require a verifier
  // stored in the originating browser's cookies — useless when the recovery
  // email is opened in a different device or browser.
  const supabase = getSupabaseServiceClient();
  await supabase.auth.resetPasswordForEmail(email);
  redirect('/admin?sent=1&mode=forgot');
}

export async function signOut() {
  const supabase = await getSupabaseServerClient();
  await supabase.auth.signOut();
  redirect('/admin');
}
