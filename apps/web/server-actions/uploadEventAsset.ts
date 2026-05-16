'use server';

import { getSupabaseServerClient } from '@/lib/supabase/server';
import { getSupabaseServiceClient } from '@/lib/supabase/service';

type Result = { ok: true; url: string } | { ok: false; error: string };

const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const MAX_BYTES = 8 * 1024 * 1024; // 8 MB

export async function uploadEventAsset(
  eventId: string,
  formData: FormData,
): Promise<Result> {
  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'no_file' };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: 'too_large' };
  }
  if (file.type && !ALLOWED_MIME.includes(file.type)) {
    return { ok: false, error: 'unsupported_type' };
  }

  // Verifica que o user logado tem acesso ao evento (owner ou member)
  // antes de subir. Usamos o user client pra que auth.uid() seja válido.
  const userClient = await getSupabaseServerClient();
  const { data: userData } = await userClient.auth.getUser();
  if (!userData.user) {
    return { ok: false, error: 'not_authenticated' };
  }
  const userId = userData.user.id;
  const { data: ev } = await userClient
    .from('events')
    .select('id, owner_id')
    .eq('id', eventId)
    .maybeSingle();
  if (!ev) return { ok: false, error: 'event_not_found' };
  if (ev.owner_id !== userId) {
    const { data: member } = await userClient
      .from('event_members')
      .select('user_id')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();
    if (!member) return { ok: false, error: 'forbidden' };
  }

  // Permissão OK → usa service client pra bypassar RLS de Storage (mais
  // confiável que policies storage.objects em produção).
  const extFromName = file.name.includes('.')
    ? file.name.split('.').pop()!.toLowerCase().slice(0, 5)
    : 'png';
  const safeExt = /^[a-z0-9]+$/.test(extFromName) ? extFromName : 'png';
  const path = `${eventId}/wc-bg-${Date.now()}.${safeExt}`;

  const service = getSupabaseServiceClient();
  const buffer = new Uint8Array(await file.arrayBuffer());
  const { error } = await service.storage
    .from('event-assets')
    .upload(path, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (error) {
    // eslint-disable-next-line no-console
    console.error('uploadEventAsset storage error:', error);
    return { ok: false, error: error.message || 'storage_upload_failed' };
  }

  const { data } = service.storage.from('event-assets').getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}
