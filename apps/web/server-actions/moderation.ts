'use server';

import { revalidatePath } from 'next/cache';

import { buildH2RPayload } from '@/lib/h2r/buildPayload';
import { requireUser } from '@/lib/auth/requireUser';
import { getSupabaseServerClient } from '@/lib/supabase/server';

type Result = { ok: true } | { ok: false; error: string };

export async function approveSubmission(submissionId: string): Promise<Result> {
  await requireUser();
  const supabase = await getSupabaseServerClient();

  const { data, error } = await supabase
    .rpc('claim_submission_for_send', { p_submission_id: submissionId })
    .single();

  if (error) return { ok: false, error: 'Falha ao aprovar.' };
  if (!data) return { ok: true };

  if (!data.webhook_url) {
    await supabase.rpc('mark_submission_failed', {
      p_submission_id: submissionId,
      p_error: 'h2r_not_configured',
    });
    revalidatePath(`/admin/events/${data.event_slug}`);
    return { ok: false, error: 'H2R não está conectado para este evento.' };
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
    if (!res.ok) throw new Error(`status ${res.status}`);
  } catch (err) {
    await supabase.rpc('mark_submission_failed', {
      p_submission_id: submissionId,
      p_error: err instanceof Error ? err.message : String(err),
    });
    revalidatePath(`/admin/events/${data.event_slug}`);
    return { ok: false, error: 'Falha ao enviar pra H2R. Tente novamente.' };
  }

  await supabase.rpc('mark_submission_sent', { p_submission_id: submissionId });
  revalidatePath(`/admin/events/${data.event_slug}`);
  return { ok: true };
}

export async function rejectSubmission(submissionId: string): Promise<Result> {
  await requireUser();
  const supabase = await getSupabaseServerClient();
  const { error } = await supabase.rpc('reject_submission', { p_submission_id: submissionId });
  if (error) return { ok: false, error: 'Falha ao rejeitar.' };
  return { ok: true };
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
