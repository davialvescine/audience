'use client';

import type { SubmissionStatus } from '@audience/shared-types';
import { useEffect, useState, useTransition } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

type Item = {
  id: string;
  name: string;
  comment: string;
  status: SubmissionStatus;
  created_at: string;
  error_message: string | null;
};

type Props = {
  token: string;
  eventName: string;
  moderatorName: string | null;
  initial: Item[];
};

export function ModeratorClient({ token, eventName, moderatorName, initial }: Props) {
  const [items, setItems] = useState<Item[]>(initial);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Polling — same idea as /telao receiver. Realtime postgres_changes
  // would need the moderator JWT and full RLS plumbing; polling is
  // simpler and cheap enough for moderation.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const fetchItems = async () => {
      const { data, error } = await supabase.rpc('get_submissions_via_token', {
        p_token: token,
      });
      if (error) {
        setError(error.message);
        return;
      }
      if (data) setItems(data as Item[]);
    };
    const t = setInterval(() => {
      void fetchItems();
    }, 2500);
    return () => clearInterval(t);
  }, [token]);

  const moderate = (id: string, action: 'approve' | 'reject') => {
    start(async () => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc('moderate_with_token', {
        p_token: token,
        p_submission_id: id,
        p_action: action,
      });
      if (error) {
        setError(error.message);
        return;
      }
      // Optimistic local update — polling will reconcile in <3s
      setItems((prev) =>
        prev.map((it) =>
          it.id === id
            ? { ...it, status: action === 'approve' ? 'approved' : 'rejected' }
            : it,
        ),
      );
    });
  };

  const visible = items.filter((it) => filter === 'all' || it.status === 'pending');
  const pendingCount = items.filter((it) => it.status === 'pending').length;

  return (
    <div className="min-h-screen bg-surface text-ink">
      <header className="sticky top-0 z-10 bg-paper border-b border-ink/10 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs text-ink/55 uppercase tracking-wide">Moderar</p>
          <h1 className="font-display text-xl text-ink truncate">{eventName}</h1>
          {moderatorName ? (
            <p className="text-xs text-ink/60 mt-0.5">Olá, {moderatorName}</p>
          ) : null}
          <div className="mt-3 flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setFilter('pending')}
              className={`px-3 h-8 rounded-md border transition ${
                filter === 'pending'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-ink/15 text-ink/60'
              }`}
            >
              Pendentes ({pendingCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 h-8 rounded-md border transition ${
                filter === 'all'
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-ink/15 text-ink/60'
              }`}
            >
              Tudo ({items.length})
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {error ? (
          <div className="p-3 rounded-md bg-danger/10 text-danger text-sm">
            {error}
          </div>
        ) : null}
        {visible.length === 0 ? (
          <div className="text-center py-12 text-ink/55">
            <p className="text-base">Nenhuma mensagem {filter === 'pending' ? 'pendente' : ''}.</p>
            <p className="text-xs mt-1">A página atualiza sozinha a cada 3s.</p>
          </div>
        ) : (
          visible.map((it) => (
            <div key={it.id} className="rounded-lg bg-paper border border-ink/10 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-ink truncate">{it.name}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    it.status === 'pending'
                      ? 'bg-warning/15 text-warning'
                      : it.status === 'approved'
                        ? 'bg-accent/15 text-accent'
                        : it.status === 'sent'
                          ? 'bg-success/15 text-success'
                          : it.status === 'rejected'
                            ? 'bg-ink/10 text-ink/60'
                            : 'bg-danger/15 text-danger'
                  }`}
                >
                  {it.status}
                </span>
              </div>
              <p className="text-ink/85 break-words">{it.comment}</p>
              {it.status === 'pending' ? (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => moderate(it.id, 'approve')}
                    disabled={pending}
                    className="flex-1 h-11 rounded-md bg-accent text-paper font-medium disabled:opacity-50"
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    onClick={() => moderate(it.id, 'reject')}
                    disabled={pending}
                    className="flex-1 h-11 rounded-md border border-ink/15 text-ink/70 disabled:opacity-50"
                  >
                    Rejeitar
                  </button>
                </div>
              ) : null}
            </div>
          ))
        )}
      </main>

      <footer className="text-center text-xs text-ink/40 pb-6">
        Audience · Moderador via link
      </footer>
    </div>
  );
}
