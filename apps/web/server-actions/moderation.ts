'use server';

import * as Sentry from '@sentry/nextjs';
import { revalidatePath } from 'next/cache';

import { buildH2RPayload } from '@/lib/h2r/buildPayload';
import { requireUser } from '@/lib/auth/requireUser';
import { getSupabaseServerClient } from '@/lib/supabase/server';

type Result = { ok: true; status: 'sent' | 'queued' } | { ok: false; error: string };

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

const FLUSH_BATCH_LIMIT = 20; // hard cap per call to avoid serverless timeouts
// Soft time budget per flush call. Vercel Pro lambdas timeout at 60s;
// leaving 10s of headroom keeps response time predictable. The loop
// breaks early when this is exceeded and the caller re-clicks flush.
const FLUSH_TIME_BUDGET_MS = 50_000;

type DeliveryRow = {
  submission_id: string;
  event_name: string;
  display_name: string;
  comment: string;
  webhook_url: string | null;
};

async function deliverToH2R(
  supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  data: DeliveryRow,
  options: { autoMarkSent?: boolean } = {},
): Promise<'sent' | 'queued' | 'failed'> {
  // Sem webhook H2R: padrao e deixar em 'approved' (operador dispara
  // manualmente via "Fixar no telão"). Mas no flush em batch passa
  // autoMarkSent=true pra disparar a fila respeitando o intervalo.
  if (!data.webhook_url) {
    if (options.autoMarkSent) {
      await supabase.rpc('mark_submission_sent', { p_submission_id: data.submission_id });
      return 'sent';
    }
    return 'queued';
  }

  const payload = buildH2RPayload({
    submissionId: data.submission_id,
    eventName: data.event_name,
    name: data.display_name,
    comment: data.comment,
    timestampMs: Date.now(),
  });

  try {
    const res = await fetch(data.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      await supabase.rpc('mark_submission_sent', { p_submission_id: data.submission_id });
      return 'sent';
    }
    Sentry.captureMessage(`H2R webhook non-OK status: ${res.status}`, {
      level: 'warning',
      tags: { area: 'h2r', kind: 'http_status' },
      extra: { submission_id: data.submission_id, status: res.status },
    });
    await supabase.rpc('mark_submission_failed', {
      p_submission_id: data.submission_id,
      p_error: `H2R retornou ${res.status}`,
    });
    return 'failed';
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes('timeout') ||
      msg.includes('fetch failed') ||
      msg.includes('ECONNREFUSED') ||
      msg.includes('ENOTFOUND') ||
      msg.includes('UND_ERR') ||
      msg.includes('TypeError')
    ) {
      // H2R unreachable — keep as approved (queued) so user can flush later when bridge reconnects.
      return 'queued';
    }
    Sentry.captureException(err, {
      tags: { area: 'h2r', kind: 'delivery_exception' },
      extra: { submission_id: data.submission_id },
    });
    await supabase.rpc('mark_submission_failed', {
      p_submission_id: data.submission_id,
      p_error: msg,
    });
    return 'failed';
  }
}

export async function approveSubmission(submissionId: string): Promise<Result> {
  await requireUser();
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .rpc('claim_submission_for_send', { p_submission_id: submissionId })
    .single();

  if (error) return { ok: false, error: 'Falha ao aprovar.' };
  if (!data) return { ok: true, status: 'sent' };

  Sentry.setTag('event_slug', data.event_slug);

  // Lê a flag auto_send_on_approve do evento. Quando ligada, eventos sem
  // webhook H2R pulam o estado 'approved' (queued) e marcam direto como
  // 'sent' — mensagem aparece no telão na hora.
  const { data: ev } = await supabase
    .from('events')
    .select('auto_send_on_approve')
    .eq('slug', data.event_slug)
    .maybeSingle();
  const autoSend = (ev as { auto_send_on_approve?: boolean } | null)?.auto_send_on_approve === true;

  const outcome = await deliverToH2R(supabase, data, { autoMarkSent: autoSend });
  revalidatePath(`/admin/events/${data.event_slug}`);

  if (outcome === 'failed') {
    return { ok: false, error: 'H2R rejeitou a mensagem. Tente novamente.' };
  }
  return { ok: true, status: outcome === 'sent' ? 'sent' : 'queued' };
}

export async function setAutoSendOnApprove(
  eventId: string,
  value: boolean,
): Promise<Result> {
  await requireUser();
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('events')
    .update({ auto_send_on_approve: value } as never)
    .eq('id', eventId)
    .select('slug')
    .maybeSingle();
  if (error || !data) return { ok: false, error: 'Falha ao salvar preferência.' };
  revalidatePath(`/admin/events/${data.slug}`);
  return { ok: true, status: 'sent' };
}

export async function rejectSubmission(submissionId: string): Promise<Result> {
  await requireUser();
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc('reject_submission', { p_submission_id: submissionId });
  if (error) return { ok: false, error: 'Falha ao rejeitar.' };
  return { ok: true, status: 'sent' };
}

// Reverts a moderation action by flipping the row back to 'pending'.
// Reversible from approved/rejected/sent. RLS (submissions_owner_all)
// enforces ownership.
export async function undoModerationAction(submissionId: string): Promise<Result> {
  await requireUser();
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('submissions')
    .update({
      status: 'pending',
      error_message: null,
      approved_at: null,
      sent_at: null,
    })
    .eq('id', submissionId)
    .in('status', ['approved', 'rejected', 'sent'])
    .select('id')
    .maybeSingle();
  if (error) return { ok: false, error: 'Falha ao desfazer.' };
  if (!data) return { ok: false, error: 'Não dá pra desfazer essa ação.' };
  return { ok: true, status: 'sent' };
}

// Dispatch manual: pega uma mensagem 'approved' e marca como sent.
// Eventos sem webhook H2R dependem deste botao pra mostrar no telao.
export async function dispatchToTelao(submissionId: string): Promise<Result> {
  await requireUser();
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc('mark_submission_sent', {
    p_submission_id: submissionId,
  });
  if (error) return { ok: false, error: 'Falha ao mostrar.' };
  return { ok: true, status: 'sent' };
}

// Tira a mensagem do telao. Status continua 'sent' (mensagem ja foi
// exibida — preserva o historico/contador). Acao real: desfixa se for
// a fixada do evento; pra mensagens em rotacao automatica e no-op.
export async function removeFromTelao(submissionId: string): Promise<Result> {
  await requireUser();
  const supabase = await getSupabaseServerClient();
  const { data: row } = await supabase
    .from('submissions')
    .select('event_id')
    .eq('id', submissionId)
    .single();
  if (!row) return { ok: false, error: 'Mensagem nao encontrada.' };
  await supabase
    .from('events')
    .update({ pinned_submission_id: null })
    .eq('id', row.event_id)
    .eq('pinned_submission_id', submissionId);
  return { ok: true, status: 'sent' };
}

// Pin: fixa mensagem no telao por tempo indeterminado. Operador clica
// "Soltar" pra liberar. Uma fixada por evento.
export async function pinSubmission(submissionId: string): Promise<Result> {
  await requireUser();
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc('pin_submission', { p_submission_id: submissionId });
  if (error) return { ok: false, error: 'Falha ao fixar.' };
  const { data: ev } = await supabase
    .from('submissions')
    .select('event_id, events!inner(slug)')
    .eq('id', submissionId)
    .maybeSingle();
  const slug = (ev as unknown as { events?: { slug: string } } | null)?.events?.slug;
  if (slug) revalidatePath(`/admin/events/${slug}`);
  return { ok: true, status: 'sent' };
}

export async function unpinSubmission(eventId: string): Promise<Result> {
  await requireUser();
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc('unpin_submission', { p_event_id: eventId });
  if (error) return { ok: false, error: 'Falha ao soltar.' };
  const { data: ev } = await supabase.from('events').select('slug').eq('id', eventId).maybeSingle();
  if (ev) revalidatePath(`/admin/events/${ev.slug}`);
  return { ok: true, status: 'sent' };
}

// Reshow: pega uma mensagem que ja foi enviada e dispara de novo (volta
// pra pending, depois aprova → reenvia pro telao).
export async function reshowSubmission(submissionId: string): Promise<Result> {
  await requireUser();
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('submissions')
    .update({ status: 'pending', error_message: null, approved_at: null, sent_at: null })
    .eq('id', submissionId)
    .eq('status', 'sent')
    .select('id, event_id')
    .maybeSingle();
  if (error) return { ok: false, error: 'Falha ao reexibir.' };
  if (!data) return { ok: false, error: 'Mensagem não pode ser reexibida.' };
  return approveSubmission(submissionId);
}

export async function retrySubmission(submissionId: string): Promise<Result> {
  await requireUser();
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc('reset_submission_for_retry', {
    p_submission_id: submissionId,
  });
  if (error) return { ok: false, error: 'Falha ao reiniciar.' };
  return approveSubmission(submissionId);
}

/**
 * Flush approved-but-not-yet-sent submissions for an event to H2R, paced by the event's
 * dispatch_interval_seconds. Capped at FLUSH_BATCH_LIMIT per call.
 */
export async function flushApprovedForEvent(eventId: string): Promise<{
  ok: true;
  sent: number;
  queued: number;
  failed: number;
  total_remaining: number;
}> {
  await requireUser();
  const supabase = await getSupabaseServerClient();

  // Load event with its dispatch interval
  const { data: event } = await supabase
    .from('events')
    .select('slug, name, h2r_webhook_url, dispatch_interval_seconds')
    .eq('id', eventId)
    .single();
  if (!event) return { ok: true, sent: 0, queued: 0, failed: 0, total_remaining: 0 };

  Sentry.setTag('event_slug', event.slug);

  // Count total queued (for "remaining" indicator)
  const { count: totalQueued } = await supabase
    .from('submissions')
    .select('id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .eq('status', 'approved');

  // Load up to N approved rows (oldest first)
  const { data: rows } = await supabase
    .from('submissions')
    .select('id, name, comment')
    .eq('event_id', eventId)
    .eq('status', 'approved')
    .order('approved_at', { ascending: true })
    .limit(FLUSH_BATCH_LIMIT);

  const intervalMs = (event.dispatch_interval_seconds ?? 3) * 1000;

  let sent = 0;
  let queued = 0;
  let failed = 0;
  const startedAt = Date.now();

  for (let i = 0; i < (rows?.length ?? 0); i += 1) {
    // Stop early if we're close to the serverless timeout. The unflushed
    // rows stay 'approved' and a follow-up flush call picks them up.
    if (Date.now() - startedAt > FLUSH_TIME_BUDGET_MS) break;

    const row = rows![i]!;
    const outcome = await deliverToH2R(
      supabase,
      {
        submission_id: row.id,
        event_name: event.name,
        display_name: row.name,
        comment: row.comment,
        webhook_url: event.h2r_webhook_url,
      },
      { autoMarkSent: true },
    );
    if (outcome === 'sent') sent += 1;
    else if (outcome === 'queued') queued += 1;
    else failed += 1;

    // Pause between consecutive sends (don't sleep after the last one
    // OR if the remaining time budget can't fit another full interval).
    const isLast = i === (rows?.length ?? 0) - 1;
    const enoughBudget = Date.now() - startedAt + intervalMs < FLUSH_TIME_BUDGET_MS;
    if (!isLast && outcome === 'sent' && enoughBudget) {
      await sleep(intervalMs);
    }

    // If H2R is offline ('queued'), stop the batch — no point in keeping going
    if (outcome === 'queued') break;
  }

  revalidatePath(`/admin/events/${event.slug}`);

  const processed = sent + failed;
  const remaining = (totalQueued ?? 0) - processed;
  return { ok: true, sent, queued, failed, total_remaining: Math.max(0, remaining) };
}

export async function updateDispatchInterval(eventId: string, seconds: number): Promise<Result> {
  await requireUser();
  const clamped = Math.max(1, Math.min(60, Math.round(seconds)));
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('events')
    .update({ dispatch_interval_seconds: clamped })
    .eq('id', eventId)
    .select('slug')
    .single();
  if (error || !data) return { ok: false, error: 'Falha ao atualizar intervalo.' };
  revalidatePath(`/admin/events/${data.slug}`);
  return { ok: true, status: 'sent' };
}

/**
 * Apaga TODOS os comentários (submissions) de um evento. Operação
 * destrutiva — UI confirma duplo antes de chamar. Owner-only.
 */
export async function resetEventSubmissions(
  eventId: string,
): Promise<{ ok: true; deleted: number } | { ok: false; error: string }> {
  await requireUser();
  const supabase = await getSupabaseServerClient();
  const { data, error } = await (supabase.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: { deleted: number } | null; error: { message: string } | null }>)(
    'reset_event_submissions',
    { p_event_id: eventId },
  );
  if (error) return { ok: false, error: error.message ?? 'Falha ao zerar.' };
  const { data: ev } = await supabase
    .from('events')
    .select('slug')
    .eq('id', eventId)
    .maybeSingle();
  if (ev?.slug) revalidatePath(`/admin/events/${ev.slug}`);
  return { ok: true, deleted: data?.deleted ?? 0 };
}
