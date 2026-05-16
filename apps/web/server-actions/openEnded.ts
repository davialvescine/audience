'use server';

import { getSupabaseServerClient } from '@/lib/supabase/server';

type ErrorCode =
  | 'event_not_found'
  | 'no_active_slide'
  | 'wrong_slide_type'
  | 'text_invalid_length'
  | 'fp_invalid'
  | 'limit_reached'
  | 'unauthorized'
  | 'slide_not_found'
  | 'unknown';

type Result<T = void> = { ok: true; data?: T } | { ok: false; error: ErrorCode };

function mapError(message: string): ErrorCode {
  if (message.includes('event_not_found')) return 'event_not_found';
  if (message.includes('no_active_slide')) return 'no_active_slide';
  if (message.includes('wrong_slide_type')) return 'wrong_slide_type';
  if (message.includes('text_invalid_length')) return 'text_invalid_length';
  if (message.includes('fp_invalid')) return 'fp_invalid';
  if (message.includes('limit_reached')) return 'limit_reached';
  if (message.includes('unauthorized')) return 'unauthorized';
  if (message.includes('slide_not_found')) return 'slide_not_found';
  return 'unknown';
}

export async function submitOpenEnded(
  slug: string,
  text: string,
  authorName: string | null,
  fp: string,
): Promise<Result<{ responseId: string }>> {
  const sb = await getSupabaseServerClient();
  const { data, error } = await (sb.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>)('submit_open_ended', {
    p_slug: slug,
    p_text: text,
    p_author_name: authorName,
    p_fp: fp,
  });
  if (error) return { ok: false, error: mapError(error.message ?? '') };
  const payload = (data ?? {}) as { response_id?: string };
  return { ok: true, data: { responseId: payload.response_id ?? '' } };
}

export async function toggleOpenEndedVote(
  responseId: string,
  fp: string,
): Promise<Result<{ voted: boolean }>> {
  const sb = await getSupabaseServerClient();
  const { data, error } = await (sb.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>)('toggle_open_ended_vote', {
    p_response_id: responseId,
    p_fp: fp,
  });
  if (error) return { ok: false, error: mapError(error.message ?? '') };
  const payload = (data ?? {}) as { voted?: boolean };
  return { ok: true, data: { voted: payload.voted === true } };
}

export async function resetOpenEndedSlide(slideId: string): Promise<Result> {
  const sb = await getSupabaseServerClient();
  const { error } = await (sb.rpc as unknown as (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>)('reset_open_ended_slide', {
    p_slide_id: slideId,
  });
  if (error) return { ok: false, error: mapError(error.message ?? '') };
  return { ok: true };
}
