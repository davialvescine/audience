'use server';

import { getSupabaseServerClient } from '@/lib/supabase/server';

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

  const extFromName = file.name.includes('.')
    ? file.name.split('.').pop()!.toLowerCase().slice(0, 5)
    : 'png';
  const safeExt = /^[a-z0-9]+$/.test(extFromName) ? extFromName : 'png';
  const path = `${eventId}/wc-bg-${Date.now()}.${safeExt}`;

  const sb = await getSupabaseServerClient();
  const buffer = new Uint8Array(await file.arrayBuffer());
  const { error } = await sb.storage
    .from('event-assets')
    .upload(path, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
  if (error) {
    if (error.message.toLowerCase().includes('row-level security')) {
      return { ok: false, error: 'forbidden' };
    }
    return { ok: false, error: error.message };
  }

  const { data } = sb.storage.from('event-assets').getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}
