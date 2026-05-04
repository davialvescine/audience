'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { requireUser } from '@/lib/auth/requireUser';
import { getSupabaseServerClient } from '@/lib/supabase/server';

const schema = z.object({
  eventId: z.string().uuid(),
  name: z.string().trim().min(2, 'Nome muito curto').max(100, 'Nome muito longo'),
});

type Result = { ok: true } | { ok: false; error: string };

export async function renameEvent(eventId: string, name: string): Promise<Result> {
  const user = await requireUser();
  const parsed = schema.safeParse({ eventId, name });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }

  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('events')
    .update({ name: parsed.data.name })
    .eq('id', parsed.data.eventId)
    .eq('owner_id', user.id)
    .select('slug')
    .single();

  if (error || !data) return { ok: false, error: 'Não foi possível renomear.' };
  revalidatePath(`/admin/events/${data.slug}`);
  return { ok: true };
}
