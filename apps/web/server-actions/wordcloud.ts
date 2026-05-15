'use server';

import { revalidatePath } from 'next/cache';

import type { WordcloudConfig } from '@/hooks/useWordcloudActive';
import { getSupabaseServerClient } from '@/lib/supabase/server';

type Result =
  | { ok: true }
  | { ok: false; error: 'forbidden' | 'event_not_found' | 'unknown' };

async function callRpc(name: string, args: Record<string, unknown>): Promise<Result> {
  const sb = await getSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb as any).rpc(name, args);
  if (error) {
    const msg = error.message ?? '';
    if (msg.includes('forbidden')) return { ok: false, error: 'forbidden' };
    if (msg.includes('event_not_found')) return { ok: false, error: 'event_not_found' };
    return { ok: false, error: 'unknown' };
  }
  return { ok: true };
}

export async function setWordcloudActive(eventId: string, active: boolean): Promise<Result> {
  const r = await callRpc('set_wordcloud_active', { p_event_id: eventId, p_active: active });
  if (r.ok) revalidatePath('/admin/events/[slug]', 'page');
  return r;
}

export async function updateWordcloudConfig(
  eventId: string,
  config: WordcloudConfig,
): Promise<Result> {
  const r = await callRpc('update_wordcloud_config', {
    p_event_id: eventId,
    p_config: config,
  });
  if (r.ok) revalidatePath('/admin/events/[slug]', 'page');
  return r;
}

export async function resetWordcloud(eventId: string): Promise<Result> {
  const r = await callRpc('reset_wordcloud', { p_event_id: eventId });
  if (r.ok) revalidatePath('/admin/events/[slug]', 'page');
  return r;
}
