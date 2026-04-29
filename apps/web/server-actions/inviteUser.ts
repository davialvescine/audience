'use server';

import { randomBytes } from 'node:crypto';

import { requireUser } from '@/lib/auth/requireUser';
import { getSupabaseServiceClient } from '@/lib/supabase/service';

type Result = { ok: true } | { ok: false; error: string };

export async function inviteUser(email: string): Promise<Result> {
  const inviter = await requireUser();
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes('@')) {
    return { ok: false, error: 'Email inválido.' };
  }

  const supabase = getSupabaseServiceClient();
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  // Insert invitation record (audit trail)
  const { error: insertErr } = await supabase.from('invitations').insert({
    email: trimmed,
    token,
    invited_by: inviter.id,
    expires_at: expiresAt,
  });
  if (insertErr) return { ok: false, error: 'Não foi possível criar convite.' };

  // Send invite via Supabase Admin API
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const { error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(trimmed, {
    redirectTo: `${origin}/auth/accept-invite`,
  });

  if (inviteErr) {
    if (inviteErr.message.toLowerCase().includes('already')) {
      return { ok: false, error: 'Esse email já tem conta no sistema.' };
    }
    return { ok: false, error: `Falha ao enviar convite: ${inviteErr.message}` };
  }

  return { ok: true };
}
