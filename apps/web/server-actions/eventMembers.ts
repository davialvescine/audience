'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireUser } from '@/lib/auth/requireUser';
import { getSupabaseServerClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: string };

const addSchema = z.object({
  eventId: z.string().uuid(),
  email: z.string().email().trim().toLowerCase(),
});

export async function addEventMember(eventId: string, email: string): Promise<Result> {
  await requireUser();
  const parsed = addSchema.safeParse({ eventId, email });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Inválido' };
  }
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc('add_event_member', {
    p_event_id: parsed.data.eventId,
    p_email: parsed.data.email,
  });
  if (error) {
    console.error('[addEventMember]', {
      eventId: parsed.data.eventId,
      email: parsed.data.email,
      err: { message: error.message, code: error.code, details: error.details, hint: error.hint },
    });
    if (error.message.includes('user_not_found')) {
      return { ok: false, error: 'Esse email não tem cadastro. Convide ele primeiro em /admin/users.' };
    }
    if (error.message.includes('forbidden')) {
      return { ok: false, error: 'Só o dono do evento pode adicionar membros.' };
    }
    return { ok: false, error: `Falha ao adicionar: ${error.message}` };
  }
  const { data: ev } = await supabase
    .from('events')
    .select('slug')
    .eq('id', eventId)
    .single();
  if (ev) revalidatePath(`/admin/events/${ev.slug}`);
  return { ok: true };
}

export async function removeEventMember(eventId: string, userId: string): Promise<Result> {
  await requireUser();
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc('remove_event_member', {
    p_event_id: eventId,
    p_user_id: userId,
  });
  if (error) {
    if (error.message.includes('cannot_remove_owner')) {
      return { ok: false, error: 'Não dá pra remover o dono.' };
    }
    return { ok: false, error: 'Falha ao remover.' };
  }
  const { data: ev } = await supabase
    .from('events')
    .select('slug')
    .eq('id', eventId)
    .single();
  if (ev) revalidatePath(`/admin/events/${ev.slug}`);
  return { ok: true };
}
