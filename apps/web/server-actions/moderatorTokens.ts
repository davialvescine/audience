'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireUser } from '@/lib/auth/requireUser';
import { getSupabaseServerClient } from '@/lib/supabase/server';

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

const generateSchema = z.object({
  eventId: z.string().uuid(),
  displayName: z.string().trim().max(60).optional(),
  ttlHours: z.number().int().min(1).max(720).default(24), // até 30 dias
});

function randomToken(): string {
  // 32 bytes random → base64url, ~43 chars sem padding.
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function generateModeratorToken(input: {
  eventId: string;
  displayName?: string | undefined;
  ttlHours?: number | undefined;
}): Promise<Result<{ token: string; expiresAt: string }>> {
  const user = await requireUser();
  const parsed = generateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Inválido' };
  }
  const supabase = await getSupabaseServerClient();
  const token = randomToken();
  const expiresAt = new Date(Date.now() + parsed.data.ttlHours * 3600 * 1000).toISOString();

  const { data, error } = await supabase
    .from('moderator_tokens')
    .insert({
      event_id: parsed.data.eventId,
      token,
      display_name: parsed.data.displayName ?? null,
      expires_at: expiresAt,
      created_by: user.id,
    })
    .select('token, expires_at, event_id')
    .single();

  if (error || !data) return { ok: false, error: 'Não foi possível gerar.' };

  // Revalidate the event admin page so the new token shows up
  const { data: ev } = await supabase
    .from('events')
    .select('slug')
    .eq('id', parsed.data.eventId)
    .single();
  if (ev) revalidatePath(`/admin/events/${ev.slug}`);

  return { ok: true, data: { token: data.token, expiresAt: data.expires_at } };
}

export async function revokeModeratorToken(tokenId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireUser();
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('moderator_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId)
    .select('event_id')
    .single();
  if (error || !data) return { ok: false, error: 'Não foi possível revogar.' };

  const { data: ev } = await supabase
    .from('events')
    .select('slug')
    .eq('id', data.event_id)
    .single();
  if (ev) revalidatePath(`/admin/events/${ev.slug}`);

  return { ok: true };
}
