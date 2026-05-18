'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerClient } from '@/lib/supabase/server';

type ErrorCode =
  | 'event_not_found'
  | 'slide_not_in_event'
  | 'slide_not_active'
  | 'wrong_slide_type'
  | 'invalid_option'
  | 'invalid_fingerprint'
  | 'submissions_closed'
  | 'slide_not_found'
  | 'forbidden'
  | 'unknown';

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: ErrorCode };

function mapError(message: string): ErrorCode {
  if (message.includes('event_not_found')) return 'event_not_found';
  if (message.includes('slide_not_in_event')) return 'slide_not_in_event';
  if (message.includes('slide_not_active')) return 'slide_not_active';
  if (message.includes('wrong_slide_type')) return 'wrong_slide_type';
  if (message.includes('invalid_option')) return 'invalid_option';
  if (message.includes('invalid_fingerprint')) return 'invalid_fingerprint';
  if (message.includes('submissions_closed')) return 'submissions_closed';
  if (message.includes('slide_not_found')) return 'slide_not_found';
  if (message.includes('forbidden')) return 'forbidden';
  return 'unknown';
}

export async function submitPollVote(
  slug: string,
  slideId: string,
  optionIndex: number,
  participantFp: string,
): Promise<Result<null>> {
  const sb = await getSupabaseServerClient();
  const { error } = await sb.rpc('submit_poll_vote', {
    p_slug: slug,
    p_slide_id: slideId,
    p_option_index: optionIndex,
    p_participant_fp: participantFp,
  });
  if (error) return { ok: false, error: mapError(error.message) };
  return { ok: true };
}

export async function resetPollSlide(slideId: string): Promise<Result<null>> {
  const sb = await getSupabaseServerClient();
  const { error } = await sb.rpc('reset_poll_slide', { p_slide_id: slideId });
  if (error) return { ok: false, error: mapError(error.message) };
  revalidatePath('/admin/events/[slug]', 'page');
  revalidatePath('/telao/[slug]', 'page');
  return { ok: true };
}
