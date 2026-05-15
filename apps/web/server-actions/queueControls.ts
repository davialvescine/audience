'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/lib/auth/requireUser';
import { getSupabaseServerClient } from '@/lib/supabase/server';

type Result = { ok: true; count?: number } | { ok: false; error: string };

// Pausa ou retoma o recebimento de novas mensagens da audiencia.
// Quando off, /e/[slug] mostra "submissões encerradas" (ja existe na RPC
// submit_comment, raise 'submissions_closed').
export async function setSubmissionsOpen(eventId: string, open: boolean): Promise<Result> {
  await requireUser();
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('events')
    .update({ submissions_open: open })
    .eq('id', eventId)
    .select('slug')
    .single();
  if (error || !data) return { ok: false, error: 'Falha ao atualizar.' };
  revalidatePath(`/admin/events/${data.slug}`);
  revalidatePath(`/e/${data.slug}`);
  return { ok: true };
}

// Rejeita em bulk todos os submissions com status='pending' do evento.
// Util pra limpar fila acumulada quando a audiencia mandou muito spam ou
// quando o operador quer comecar limpo.
export async function bulkRejectPending(eventId: string): Promise<Result> {
  await requireUser();
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('submissions')
    .update({ status: 'rejected' })
    .eq('event_id', eventId)
    .eq('status', 'pending')
    .select('id');
  if (error) return { ok: false, error: 'Falha ao limpar.' };

  // Revalidate event page
  const { data: ev } = await supabase.from('events').select('slug').eq('id', eventId).single();
  if (ev) revalidatePath(`/admin/events/${ev.slug}`);

  return { ok: true, count: data?.length ?? 0 };
}
