'use server';

import { headers } from 'next/headers';

import { hashIp } from '@/lib/security/ipHash';
import { getSupabaseServerClient } from '@/lib/supabase/server';
import { submissionSchema } from '@/lib/validators/submission';

type Result = { ok: true; submissionId: string } | { ok: false; error: string };

export async function submitComment(slug: string, formData: FormData): Promise<Result> {
  const parsed = submissionSchema.safeParse({
    name: formData.get('name'),
    comment: formData.get('comment'),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Dados inválidos' };
  }

  const reqHeaders = await headers();
  const ip = reqHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  const ipHash = hashIp(ip);

  const supabase = await getSupabaseServerClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc('submit_comment', {
    p_slug: slug,
    p_name: parsed.data.name,
    p_comment: parsed.data.comment,
    p_ip_hash: ipHash,
  }) as Awaited<ReturnType<typeof supabase.rpc>>;

  if (error) {
    const code = error.message;
    if (code.includes('rate_limited')) return { ok: false, error: 'Muitas mensagens em pouco tempo. Aguarde um instante.' };
    if (code.includes('submissions_closed')) return { ok: false, error: 'Submissões encerradas para este evento.' };
    if (code.includes('event_not_found')) return { ok: false, error: 'Evento não encontrado.' };
    return { ok: false, error: 'Não foi possível enviar. Tente novamente.' };
  }

  return { ok: true, submissionId: data as string };
}
