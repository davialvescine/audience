'use server';

import { revalidatePath } from 'next/cache';

import type { WordcloudConfig } from '@/hooks/useWordcloudActive';
import { getSupabaseServerClient } from '@/lib/supabase/server';

type Result =
  | { ok: true }
  | { ok: false; error: 'forbidden' | 'event_not_found' | 'unknown' };

function mapError(message: string | undefined): Result {
  const msg = message ?? '';
  if (msg.includes('forbidden')) return { ok: false, error: 'forbidden' };
  if (msg.includes('event_not_found')) return { ok: false, error: 'event_not_found' };
  return { ok: false, error: 'unknown' };
}

export async function setWordcloudActive(eventId: string, active: boolean): Promise<Result> {
  const sb = await getSupabaseServerClient();
  const { error } = await sb.rpc('set_wordcloud_active', {
    p_event_id: eventId,
    p_active: active,
  });
  if (error) return mapError(error.message);
  revalidatePath('/admin/events/[slug]', 'page');
  return { ok: true };
}

export async function updateWordcloudConfig(
  eventId: string,
  config: WordcloudConfig,
): Promise<Result> {
  const sb = await getSupabaseServerClient();
  const { error } = await sb.rpc('update_wordcloud_config', {
    p_event_id: eventId,
    p_config: config,
  });
  if (error) return mapError(error.message);
  revalidatePath('/admin/events/[slug]', 'page');
  return { ok: true };
}

export async function resetWordcloud(eventId: string): Promise<Result> {
  const sb = await getSupabaseServerClient();
  const { error } = await sb.rpc('reset_wordcloud', { p_event_id: eventId });
  if (error) return mapError(error.message);
  revalidatePath('/admin/events/[slug]', 'page');
  return { ok: true };
}
