'use server';

import { getSupabaseServiceClient } from '@/lib/supabase/service';

type SlideConfig = Record<string, unknown>;

type SetQrResult =
  | { ok: true }
  | { ok: false; error: string };

type QrStateResult =
  | {
      ok: true;
      isComments: boolean;
      showQr: boolean;
      qrFullscreen: boolean;
    }
  | { ok: false; error: string };

/**
 * Permite o moderador externo (via token) ligar/desligar o QR no telão.
 * Resolve event_id via validate_moderator_token (RPC existente), busca o
 * slide ativo, valida type='comments' e atualiza config.showQr/qrFullscreen.
 *
 * Usa service client (bypassa RLS) porque o token já foi validado e o
 * escopo é limitado ao evento dele.
 */
export async function setQrViaToken(
  token: string,
  patch: { showQr?: boolean; qrFullscreen?: boolean },
): Promise<SetQrResult> {
  const sb = getSupabaseServiceClient();

  const { data: eventId, error: e1 } = await sb.rpc('validate_moderator_token', {
    p_token: token,
  });
  if (e1 || !eventId) return { ok: false, error: 'Token inválido ou expirado.' };

  const { data: ev } = await sb
    .from('events')
    .select('active_slide_id')
    .eq('id', eventId as string)
    .maybeSingle();
  const activeSlideId = (ev as { active_slide_id?: string | null } | null)?.active_slide_id;
  if (!activeSlideId) return { ok: false, error: 'Nenhum slide ativo no evento.' };

  const { data: slide } = await sb
    .from('slides')
    .select('type, config')
    .eq('id', activeSlideId)
    .maybeSingle();
  const slideRow = slide as { type?: string; config?: SlideConfig } | null;
  if (!slideRow) return { ok: false, error: 'Slide não encontrado.' };
  if (slideRow.type !== 'comments') {
    return { ok: false, error: 'Slide ativo não é de comentários.' };
  }

  const newConfig: SlideConfig = {
    ...(slideRow.config ?? {}),
    ...(patch.showQr !== undefined ? { showQr: patch.showQr } : {}),
    ...(patch.qrFullscreen !== undefined ? { qrFullscreen: patch.qrFullscreen } : {}),
  };

  const { error: e2 } = await sb
    .from('slides')
    .update({ config: newConfig as never })
    .eq('id', activeSlideId);
  if (e2) return { ok: false, error: 'Falha ao atualizar slide.' };

  // Touch token (last_used_at) — best effort
  try {
    await (sb.rpc as unknown as (fn: string, args: Record<string, unknown>) => Promise<unknown>)(
      'touch_moderator_token',
      { p_token: token },
    );
  } catch {
    /* noop */
  }

  return { ok: true };
}

/**
 * Lê o estado atual de showQr/qrFullscreen do slide ativo do evento do token.
 * Retorna isComments=false quando o slide ativo não é de comentários (UI
 * usa isso pra esconder o card de Controles).
 */
export async function getActiveSlideQrStateViaToken(token: string): Promise<QrStateResult> {
  const sb = getSupabaseServiceClient();

  const { data: eventId, error: e1 } = await sb.rpc('validate_moderator_token', {
    p_token: token,
  });
  if (e1 || !eventId) return { ok: false, error: 'Token inválido.' };

  const { data: ev } = await sb
    .from('events')
    .select('active_slide_id')
    .eq('id', eventId as string)
    .maybeSingle();
  const activeSlideId = (ev as { active_slide_id?: string | null } | null)?.active_slide_id;
  if (!activeSlideId) return { ok: true, isComments: false, showQr: false, qrFullscreen: false };

  const { data: slide } = await sb
    .from('slides')
    .select('type, config')
    .eq('id', activeSlideId)
    .maybeSingle();
  const slideRow = slide as { type?: string; config?: SlideConfig } | null;
  if (!slideRow || slideRow.type !== 'comments') {
    return { ok: true, isComments: false, showQr: false, qrFullscreen: false };
  }
  const cfg = (slideRow.config ?? {}) as { showQr?: boolean; qrFullscreen?: boolean };
  return {
    ok: true,
    isComments: true,
    showQr: cfg.showQr === true,
    qrFullscreen: cfg.qrFullscreen === true,
  };
}
