'use server';

import { randomBytes } from 'node:crypto';

import { requireUser } from '@/lib/auth/requireUser';
import { getSupabaseServiceClient } from '@/lib/supabase/service';

type Result = { ok: true } | { ok: false; error: string };

export async function resendInvite(email: string): Promise<Result> {
  await requireUser();
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes('@')) {
    return { ok: false, error: 'Email inválido.' };
  }

  const supabase = getSupabaseServiceClient();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

  // Try a fresh invite first. If the user already exists in auth (common when
  // the original invite link expired before they used it), fall back to a
  // password recovery — both flows funnel into the "set password" screen via
  // the auth callback.
  const { error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(trimmed, {
    redirectTo: `${origin}/auth/callback?next=/auth/accept-invite`,
    data: { password_set: false },
  });

  if (inviteErr && inviteErr.message.toLowerCase().includes('already')) {
    const { error: resetErr } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${origin}/auth/callback?next=/auth/reset-password`,
    });
    if (resetErr) {
      return { ok: false, error: `Falha ao reenviar: ${resetErr.message}` };
    }
  } else if (inviteErr) {
    return { ok: false, error: `Falha ao reenviar: ${inviteErr.message}` };
  }

  // Refresh the audit-trail row so the "Pendente" badge and expiry update.
  const newToken = randomBytes(32).toString('hex');
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await supabase
    .from('invitations')
    .update({ token: newToken, expires_at: newExpiry })
    .eq('email', trimmed)
    .is('accepted_at', null);

  return { ok: true };
}
