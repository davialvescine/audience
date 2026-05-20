'use server';

import { revalidatePath } from 'next/cache';

import { requireUser } from '@/lib/auth/requireUser';
import { getSupabaseServerClient } from '@/lib/supabase/server';

type Ok<T> = { ok: true; data: T };
type Err = { ok: false; error: string };
type Result<T> = Ok<T> | Err;

export type SessionListItem = {
  id: string;
  name: string;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  is_active: boolean;
  submissions_count: number;
  words_count: number;
  votes_count: number;
  responses_count: number;
};

export async function listSessions(eventId: string): Promise<Result<SessionListItem[]>> {
  await requireUser();
  const sb = await getSupabaseServerClient();
  const { data, error } = await sb.rpc('list_sessions', { p_event_id: eventId });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    data: (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      sort_order: row.sort_order,
      archived_at: row.archived_at,
      created_at: row.created_at,
      is_active: row.is_active,
      submissions_count: Number(row.submissions_count ?? 0),
      words_count: Number(row.words_count ?? 0),
      votes_count: Number(row.votes_count ?? 0),
      responses_count: Number(row.responses_count ?? 0),
    })),
  };
}

async function revalidateEvent(sb: Awaited<ReturnType<typeof getSupabaseServerClient>>, eventId: string) {
  const { data } = await sb.from('events').select('slug').eq('id', eventId).maybeSingle();
  if (data?.slug) revalidatePath(`/admin/events/${data.slug}`);
}

export async function createSession(eventId: string, name: string): Promise<Result<{ id: string }>> {
  await requireUser();
  const sb = await getSupabaseServerClient();
  const { data, error } = await sb.rpc('create_session', { p_event_id: eventId, p_name: name });
  if (error || !data) return { ok: false, error: error?.message ?? 'Falha ao criar sessão.' };
  await revalidateEvent(sb, eventId);
  return { ok: true, data: { id: data as string } };
}

export async function renameSession(sessionId: string, name: string): Promise<Result<null>> {
  await requireUser();
  const sb = await getSupabaseServerClient();
  const { error } = await sb.rpc('rename_session', { p_session_id: sessionId, p_name: name });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function archiveSession(sessionId: string): Promise<Result<null>> {
  await requireUser();
  const sb = await getSupabaseServerClient();
  const { error } = await sb.rpc('archive_session', { p_session_id: sessionId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function deleteSession(sessionId: string): Promise<Result<null>> {
  await requireUser();
  const sb = await getSupabaseServerClient();
  const { error } = await sb.rpc('delete_session', { p_session_id: sessionId });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

export async function setActiveSession(eventId: string, sessionId: string): Promise<Result<null>> {
  await requireUser();
  const sb = await getSupabaseServerClient();
  const { error } = await sb.rpc('set_active_session', {
    p_event_id: eventId,
    p_session_id: sessionId,
  });
  if (error) return { ok: false, error: error.message };
  await revalidateEvent(sb, eventId);
  return { ok: true, data: null };
}

export async function resetSession(sessionId: string): Promise<
  Result<{
    submissions_deleted: number;
    words_deleted: number;
    votes_deleted: number;
    responses_deleted: number;
  }>
> {
  await requireUser();
  const sb = await getSupabaseServerClient();
  const { data, error } = await sb.rpc('reset_session', { p_session_id: sessionId });
  if (error) return { ok: false, error: error.message };
  const row = (data ?? [])[0] ?? {
    submissions_deleted: 0,
    words_deleted: 0,
    votes_deleted: 0,
    responses_deleted: 0,
  };
  return {
    ok: true,
    data: {
      submissions_deleted: Number(row.submissions_deleted ?? 0),
      words_deleted: Number(row.words_deleted ?? 0),
      votes_deleted: Number(row.votes_deleted ?? 0),
      responses_deleted: Number(row.responses_deleted ?? 0),
    },
  };
}
