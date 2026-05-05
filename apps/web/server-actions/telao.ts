'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/lib/auth/requireUser';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { type TelaoConfig, type TelaoDisplayMode } from '@/lib/telao/config';

type Result = { ok: true } | { ok: false; error: string };

export async function updateTelaoConfig(eventId: string, config: TelaoConfig): Promise<Result> {
  await requireUser();
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('events')
    .update({ telao_config: config })
    .eq('id', eventId)
    .select('slug')
    .single();
  if (error || !data) return { ok: false, error: 'Falha ao salvar configuração.' };
  revalidatePath(`/admin/events/${data.slug}`);
  revalidatePath(`/telao/${data.slug}`);
  return { ok: true };
}

// Salva ou remove um override por modo de exibição. Quando config=null,
// remove o override e o modo passa a herdar do telao_config global.
export async function setTelaoConfigOverride(
  eventId: string,
  mode: TelaoDisplayMode,
  config: TelaoConfig | null,
): Promise<Result> {
  await requireUser();
  const supabase = await getSupabaseServerClient();
  // Read current overrides map
  const { data: current, error: readErr } = await supabase
    .from('events')
    .select('slug, telao_configs')
    .eq('id', eventId)
    .single();
  if (readErr || !current) return { ok: false, error: 'Evento não encontrado.' };

  const map = (current.telao_configs as Record<string, TelaoConfig> | null) ?? {};
  const next = { ...map };
  if (config === null) {
    delete next[mode];
  } else {
    next[mode] = config;
  }

  const { error } = await supabase
    .from('events')
    .update({ telao_configs: next })
    .eq('id', eventId);
  if (error) return { ok: false, error: 'Falha ao salvar override.' };

  revalidatePath(`/admin/events/${current.slug}`);
  revalidatePath(`/telao/${current.slug}`);
  return { ok: true };
}

export async function updateDisplayModes(
  eventId: string,
  modes: TelaoDisplayMode[],
): Promise<Result> {
  await requireUser();
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase
    .from('events')
    .update({ enabled_display_modes: modes.length > 0 ? modes : ['h2r'] })
    .eq('id', eventId)
    .select('slug')
    .single();
  if (error || !data) return { ok: false, error: 'Falha ao atualizar modos.' };
  revalidatePath(`/admin/events/${data.slug}`);
  return { ok: true };
}
