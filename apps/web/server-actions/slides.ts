'use server';

import { revalidatePath } from 'next/cache';

import { getSupabaseServerClient } from '@/lib/supabase/server';
import type { Slide, SlideType } from '@/lib/slides/types';

type ErrorCode = 'forbidden' | 'slide_not_in_event' | 'event_not_found' | 'unknown';

type Result<T = unknown> = { ok: true; data: T } | { ok: false; error: ErrorCode };

function mapError<T>(message: string | undefined): Result<T> {
  const msg = message ?? '';
  if (msg.includes('forbidden')) return { ok: false, error: 'forbidden' };
  if (msg.includes('slide_not_in_event')) return { ok: false, error: 'slide_not_in_event' };
  if (msg.includes('event_not_found')) return { ok: false, error: 'event_not_found' };
  return { ok: false, error: 'unknown' };
}

export async function createSlide(
  eventId: string,
  type: SlideType,
  config: Record<string, unknown> | undefined = undefined,
): Promise<Result<Slide>> {
  const sb = await getSupabaseServerClient();
  const { data, error } = await sb.rpc('create_slide', {
    p_event_id: eventId,
    p_type: type,
    // Json type from generated DB types isn't compatible with arbitrary record;
    // we know jsonb accepts any nested object at runtime.
    p_config: (config ?? {}) as unknown as never,
  });
  if (error) return mapError(error.message);
  revalidatePath('/admin/events/[slug]', 'page');
  revalidatePath('/telao/[slug]', 'page');
  return { ok: true, data: data as Slide };
}

export async function updateSlide(
  slideId: string,
  config: Record<string, unknown>,
): Promise<Result<Slide>> {
  const sb = await getSupabaseServerClient();
  const { data, error } = await sb.rpc('update_slide', {
    p_slide_id: slideId,
    p_config: config as unknown as never,
  });
  if (error) return mapError(error.message);
  revalidatePath('/admin/events/[slug]', 'page');
  revalidatePath('/telao/[slug]', 'page');
  return { ok: true, data: data as Slide };
}

export async function deleteSlide(slideId: string): Promise<Result<null>> {
  const sb = await getSupabaseServerClient();
  const { error } = await sb.rpc('delete_slide', { p_slide_id: slideId });
  if (error) return mapError(error.message);
  revalidatePath('/admin/events/[slug]', 'page');
  return { ok: true, data: null };
}

export async function reorderSlides(
  eventId: string,
  slideIds: string[],
): Promise<Result<null>> {
  const sb = await getSupabaseServerClient();
  const { error } = await sb.rpc('reorder_slides', {
    p_event_id: eventId,
    p_slide_ids: slideIds,
  });
  if (error) return mapError(error.message);
  revalidatePath('/admin/events/[slug]', 'page');
  return { ok: true, data: null };
}

export async function setActiveSlide(
  eventId: string,
  slideId: string | null,
): Promise<Result<null>> {
  const sb = await getSupabaseServerClient();
  const { error } = await sb.rpc('set_active_slide', {
    p_event_id: eventId,
    // RPC param is nullable; types are generated as required string due to
    // Supabase's generator not modeling that yet. Cast is safe at runtime.
    p_slide_id: slideId as string,
  });
  if (error) return mapError(error.message);
  revalidatePath('/admin/events/[slug]', 'page');
  revalidatePath('/telao/[slug]', 'page');
  return { ok: true, data: null };
}

/**
 * Zera todas as palavras enviadas a um slide específico. Outros slides
 * do mesmo evento não são afetados. Owner ou event_member podem chamar.
 */
export async function resetSlideWords(slideId: string): Promise<Result<null>> {
  const sb = await getSupabaseServerClient();
  // RPC `reset_slide_words` foi adicionada na migration 00400000. Os tipos
  // gerados podem estar desatualizados — cast `as never` é seguro em runtime.
  const { error } = await sb.rpc('reset_slide_words' as never, {
    p_slide_id: slideId,
  } as never);
  if (error) return mapError(error.message);
  revalidatePath('/admin/events/[slug]', 'page');
  return { ok: true, data: null };
}

/**
 * Zera TODOS os dados de teste do evento (palavras, votos, respostas
 * abertas). NÃO mexe nos slides em si nem em submissions (comentários).
 * Útil pra limpar antes do evento real depois de testes.
 */
export async function resetAllEventSlides(
  eventId: string,
): Promise<Result<{ words_deleted: number; votes_deleted: number; responses_deleted: number }>> {
  const sb = await getSupabaseServerClient();
  const { data, error } = await sb.rpc('reset_all_event_slides' as never, {
    p_event_id: eventId,
  } as never);
  if (error) return mapError(error.message);
  revalidatePath('/admin/events/[slug]', 'page');
  revalidatePath('/telao/[slug]', 'page');
  return {
    ok: true,
    data: (data ?? { words_deleted: 0, votes_deleted: 0, responses_deleted: 0 }) as {
      words_deleted: number;
      votes_deleted: number;
      responses_deleted: number;
    },
  };
}
