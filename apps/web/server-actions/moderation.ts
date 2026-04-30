'use server';

import { revalidatePath } from 'next/cache';

import { buildH2RPayload } from '@/lib/h2r/buildPayload';
import { requireUser } from '@/lib/auth/requireUser';
import { getSupabaseServerClient } from '@/lib/supabase/server';

type Result =
  | { ok: true; status: 'sent' | 'queued' }
  | { ok: false; error: string };

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

const FLUSH_BATCH_LIMIT = 20; // hard cap per call to avoid serverless timeouts

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
): Promise<'sent' | 'queued' | 'failed'> {
  // No H2R webhook configured → other display modes (Browser Source, Chrome PiP, Desktop App)
  // pick the message up via Supabase Realtime as soon as status flips to 'sent'.
  // Mark as sent immediately so the /telao subscription fires.
  if (!data.webhook_url) {
    await supabase.rpc('mark_submission_sent', { p_submission_id: data.submission_id });
    return 'sent';
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

  const outcome = await deliverToH2R(supabase, data);
  revalidatePath(`/admin/events/${data.event_slug}`);

  if (outcome === 'failed') {
    return { ok: false, error: 'H2R rejeitou a mensagem. Tente novamente.' };
  }
  return { ok: true, status: outcome === 'sent' ? 'sent' : 'queued' };
}

export async function rejectSubmission(submissionId: string): Promise<Result> {
  await requireUser();
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc('reject_submission', { p_submission_id: submissionId });
  if (error) return { ok: false, error: 'Falha ao rejeitar.' };
  return { ok: true, status: 'sent' };
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

  for (let i = 0; i < (rows?.length ?? 0); i += 1) {
    const row = rows![i]!;
    const outcome = await deliverToH2R(supabase, {
      submission_id: row.id,
      event_name: event.name,
      display_name: row.name,
      comment: row.comment,
      webhook_url: event.h2r_webhook_url,
    });
    if (outcome === 'sent') sent += 1;
    else if (outcome === 'queued') queued += 1;
    else failed += 1;

    // Pause between consecutive sends (don't sleep after the last one)
    if (i < (rows?.length ?? 0) - 1 && outcome === 'sent') {
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

export async function updateDispatchInterval(
  eventId: string,
  seconds: number,
): Promise<Result> {
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
