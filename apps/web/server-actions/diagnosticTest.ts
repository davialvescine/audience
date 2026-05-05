'use server';

import { requireUser } from '@/lib/auth/requireUser';
import { getSupabaseServerClient } from '@/lib/supabase/server';

type Result = { ok: true; submissionId: string } | { ok: false; error: string };

// Insere uma submission ja com status='sent' marcada como teste
// diagnostico. /telao polling pega em ate 3s e mostra. Operador
// confirma visualmente que o pipeline tela → audiencia → telão funciona.
//
// Caller (admin) deve chamar deleteDiagnosticTest(id) ~15s depois pra
// limpar do DB.
export async function dispatchDiagnosticTest(eventId: string): Promise<Result> {
  await requireUser();
  const supabase = await getSupabaseServerClient();
  const now = new Date();
  const time = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const { data, error } = await supabase
    .from('submissions')
    .insert({
      event_id: eventId,
      name: 'TESTE DE DIAGNÓSTICO',
      comment: `Telão funcionando — ${time}`,
      status: 'sent',
      sent_at: now.toISOString(),
      approved_at: now.toISOString(),
    })
    .select('id')
    .single();
  if (error || !data) return { ok: false, error: 'Falha ao disparar teste.' };
  return { ok: true, submissionId: data.id };
}

export async function deleteDiagnosticTest(submissionId: string): Promise<{ ok: boolean }> {
  await requireUser();
  const supabase = await getSupabaseServerClient();
  await supabase.from('submissions').delete().eq('id', submissionId);
  return { ok: true };
}
