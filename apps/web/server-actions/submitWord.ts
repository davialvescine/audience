'use server';

import { headers } from 'next/headers';

import { hashIp } from '@/lib/security/ipHash';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { validateWord } from '@/lib/wordcloud/validateWord';

type ErrorCode =
  | 'rate_limited'
  | 'wordcloud_inactive'
  | 'event_not_found'
  | 'profanity'
  | 'too_long'
  | 'unknown';

type Result = { ok: true } | { ok: true; skipped: true } | { ok: false; error: ErrorCode };

export async function submitWord(slug: string, formData: FormData): Promise<Result> {
  const raw = formData.get('word');
  const v = validateWord(raw);
  if (!v.ok) {
    if (v.reason === 'empty' || v.reason === 'stopword') {
      return { ok: true, skipped: true };
    }
    if (v.reason === 'too_long') return { ok: false, error: 'too_long' };
    return { ok: false, error: 'profanity' };
  }

  const reqHeaders = await headers();
  const ip = reqHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ipHash = hashIp(ip);

  const sb = await getSupabaseServerClient();
  const { error } = await sb.rpc('submit_word', {
    p_slug: slug,
    p_word: v.word,
    p_ip_hash: ipHash,
  });

  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('rate_limited')) return { ok: false, error: 'rate_limited' };
    if (msg.includes('wordcloud_inactive')) return { ok: false, error: 'wordcloud_inactive' };
    if (msg.includes('event_not_found')) return { ok: false, error: 'event_not_found' };
    return { ok: false, error: 'unknown' };
  }

  return { ok: true };
}
