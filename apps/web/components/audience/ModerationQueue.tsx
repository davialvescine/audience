'use client';

import type { SubmissionStatus } from '@audience/shared-types';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';

import { detectNewPending } from './detectNewPending';
import { filterSubmissions, type SubmissionFilter } from './filterSubmissions';
import { RealtimeStatusBadge } from './RealtimeStatusBadge';
import { SubmissionCard } from './SubmissionCard';

import { EmptyState } from '@/components/ui/EmptyState';
import { getSupabaseBrowserClient, getSupabaseRealtimeClient } from '@/lib/supabase/browser';
import { approveSubmission, rejectSubmission, undoModerationAction } from '@/server-actions/moderation';

type Item = {
  id: string;
  name: string;
  comment: string;
  status: SubmissionStatus;
  created_at: string;
  error_message: string | null;
  display_count?: number;
};

type Props = { eventId: string; initial: Item[]; pinnedSubmissionId?: string | null };

export function ModerationQueue({ eventId, initial, pinnedSubmissionId }: Props) {
  const [items, setItems] = useState(initial);
  const [pinnedId, setPinnedId] = useState<string | null>(pinnedSubmissionId ?? null);
  const [rtStatus, setRtStatus] = useState<'connecting' | 'connected' | 'error'>('connecting');
  const [tab, setTab] = useState<SubmissionFilter['tab']>('all');
  const [query, setQuery] = useState('');

  const counts = useMemo(
    () => ({
      all: items.length,
      pending: items.filter((i) => i.status === 'pending').length,
      sent: items.filter((i) => i.status === 'sent').length,
      rejected: items.filter((i) => i.status === 'rejected').length,
      failed: items.filter((i) => i.status === 'failed').length,
    }),
    [items],
  );

  const visible = useMemo(() => filterSubmissions(items, { tab, query }), [items, tab, query]);

  // Keyboard navigation cursor (J/K) — index into `visible`
  const [cursor, setCursor] = useState(0);
  useEffect(() => {
    // Clamp cursor when visible list shrinks/changes
    if (cursor >= visible.length) setCursor(Math.max(0, visible.length - 1));
  }, [visible.length, cursor]);

  // Undo toast — last action with a 5s window
  const [undo, setUndo] = useState<
    | { id: string; action: 'approved' | 'rejected'; expiresAt: number }
    | null
  >(null);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), Math.max(0, undo.expiresAt - Date.now()));
    return () => clearTimeout(t);
  }, [undo]);

  // Keyboard handler: J/K navigate, A approve, R reject, U undo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip when typing in an input/textarea
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === 'j' || e.key === 'J' || e.key === 'ArrowDown') {
        e.preventDefault();
        setCursor((c) => Math.min(visible.length - 1, c + 1));
        return;
      }
      if (e.key === 'k' || e.key === 'K' || e.key === 'ArrowUp') {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
        return;
      }
      const item = visible[cursor];
      if (!item) return;

      if ((e.key === 'a' || e.key === 'A') && item.status === 'pending') {
        e.preventDefault();
        void approveSubmission(item.id).then((res) => {
          if (res.ok) setUndo({ id: item.id, action: 'approved', expiresAt: Date.now() + 5000 });
        });
      } else if ((e.key === 'r' || e.key === 'R') && item.status === 'pending') {
        e.preventDefault();
        void rejectSubmission(item.id).then((res) => {
          if (res.ok) setUndo({ id: item.id, action: 'rejected', expiresAt: Date.now() + 5000 });
        });
      } else if (e.key === 'u' || e.key === 'U') {
        if (!undo) return;
        e.preventDefault();
        void undoModerationAction(undo.id).then(() => setUndo(null));
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cursor, visible, undo]);

  // Beep + title update on new pending items
  const seenIdsRef = useRef<string[]>(initial.filter((i) => i.status === 'pending').map((i) => i.id));
  const [soundOn, setSoundOn] = useState<boolean>(() => {
    if (typeof localStorage === 'undefined') return false;
    return localStorage.getItem('moderation-sound') === '1';
  });

  useEffect(() => {
    const newCount = detectNewPending(seenIdsRef.current, items);
    if (newCount > 0 && soundOn) {
      try {
        // Tiny synthesized beep — no asset required.
        type WindowWithWebkit = Window & typeof globalThis & {
          webkitAudioContext?: typeof AudioContext;
        };
        const w = window as WindowWithWebkit;
        const Ctor = window.AudioContext ?? w.webkitAudioContext;
        if (!Ctor) return;
        const ctx = new Ctor();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.value = 0.08;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } catch {
        // ignore — autoplay restrictions, user hasn't interacted yet, etc.
      }
    }
    // Update seen set with current pending ids
    seenIdsRef.current = items.filter((i) => i.status === 'pending').map((i) => i.id);
  }, [items, soundOn]);

  // Keep tab title reflecting pending count so operator notices new items
  // even when the tab is in background.
  useEffect(() => {
    const original = document.title;
    const pending = items.filter((i) => i.status === 'pending').length;
    document.title = pending > 0 ? `(${pending}) ${original.replace(/^\(\d+\)\s*/, '')}` : original.replace(/^\(\d+\)\s*/, '');
    return () => {
      document.title = original.replace(/^\(\d+\)\s*/, '');
    };
  }, [items]);

  const toggleSound = () => {
    setSoundOn((on) => {
      const next = !on;
      try {
        localStorage.setItem('moderation-sound', next ? '1' : '0');
      } catch {
        // ignore
      }
      return next;
    });
  };

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    // Realtime client separado (sem @supabase/ssr cookie wrapper) —
    // workaround pra "transport failure" no WS em prod com Vercel.
    const rt = getSupabaseRealtimeClient();
    let channel: ReturnType<typeof rt.channel> | null = null;

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        void rt.realtime.setAuth(session.access_token);
      }
      channel = rt
        .channel(`event:${eventId}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'submissions', filter: `event_id=eq.${eventId}` },
          (payload) => {
            setItems((prev) => {
              if (payload.eventType === 'INSERT') return [payload.new as Item, ...prev];
              if (payload.eventType === 'UPDATE')
                return prev.map((i) => (i.id === (payload.new as Item).id ? (payload.new as Item) : i));
              if (payload.eventType === 'DELETE')
                return prev.filter((i) => i.id !== (payload.old as { id: string }).id);
              return prev;
            });
          },
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') setRtStatus('connected');
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED')
            setRtStatus('error');
          else setRtStatus('connecting');
        });
    });

    // Polling fallback — refetches every 2s and merges. If Realtime delivers,
    // this is a no-op (same data). If Realtime is blocked, we still get fresh state.
    const refresh = async () => {
      const { data } = await supabase
        .from('submissions')
        .select('id, name, comment, status, created_at, error_message')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })
        .limit(100);
      if (!data) return;
      setItems((prev) => {
        if (prev.length !== data.length) return data as Item[];
        for (let i = 0; i < data.length; i += 1) {
          const a = prev[i];
          const b = data[i] as Item;
          if (!a || a.id !== b.id || a.status !== b.status || a.error_message !== b.error_message) {
            return data as Item[];
          }
        }
        return prev;
      });
    };
    const t = setInterval(() => { void refresh(); }, 2000);

    return () => {
      if (channel) void rt.removeChannel(channel);
      clearInterval(t);
    };
  }, [eventId]);

  if (items.length === 0) {
    return (
      <div className="space-y-3">
        <div className="flex justify-end">
          <RealtimeStatusBadge status={rtStatus} />
        </div>
        <EmptyState
          title="Sem submissões ainda"
          description="Quando o público enviar, aparece aqui em tempo real."
        />
      </div>
    );
  }

  const tabs: Array<{ id: SubmissionFilter['tab']; label: string; count: number }> = [
    { id: 'all', label: 'Tudo', count: counts.all },
    { id: 'pending', label: 'Aguardando', count: counts.pending },
    { id: 'sent', label: 'Exibidas', count: counts.sent },
    { id: 'failed', label: 'Falhas', count: counts.failed },
    { id: 'rejected', label: 'Rejeitado', count: counts.rejected },
  ];

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3 h-8 rounded-md text-xs border transition inline-flex items-center gap-1.5 ${
                tab === t.id
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-ink/15 text-ink/60 hover:border-ink/30'
              }`}
            >
              <span>{t.label}</span>
              <span className={`text-[10px] px-1.5 rounded-full ${tab === t.id ? 'bg-primary/20' : 'bg-ink/10'}`}>
                {t.count}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleSound}
            className={`text-xs h-8 px-2.5 rounded-md border transition ${
              soundOn
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-ink/15 text-ink/60 hover:border-ink/30'
            }`}
            title={soundOn ? 'Som ligado — beep em cada nova mensagem pendente' : 'Som desligado'}
          >
            {soundOn ? '🔔 Som' : '🔕 Som'}
          </button>
          <RealtimeStatusBadge status={rtStatus} />
        </div>
      </div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar por nome ou comentário…"
        className="h-9 px-3 rounded-md border border-ink/15 bg-transparent text-sm text-ink focus:border-primary focus:outline-none"
      />
      {visible.length === 0 ? (
        <EmptyState
          title="Nenhum resultado"
          description={query ? 'Limpa a busca ou troca a aba pra ver outros itens.' : 'Sem itens nessa categoria.'}
        />
      ) : (
        <AnimatePresence initial={false}>
          {visible.map((i, idx) => (
            <motion.div
              key={i.id}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
              className={
                idx === cursor
                  ? 'ring-2 ring-primary/60 rounded-xl transition'
                  : 'transition'
              }
              onClick={() => setCursor(idx)}
            >
              <SubmissionCard
                id={i.id}
                name={i.name}
                comment={i.comment}
                status={i.status}
                createdAt={i.created_at}
                errorMessage={i.error_message}
                displayCount={i.display_count ?? 0}
                isPinned={i.id === pinnedId}
                eventId={eventId}
                onPinChange={setPinnedId}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      )}

      {/* Atalhos hint + Undo toast (canto inferior, bem discreto) */}
      <div className="text-[11px] text-ink/45 mt-2">
        Atalhos: <kbd className="px-1 rounded bg-ink/10">J</kbd>/<kbd className="px-1 rounded bg-ink/10">K</kbd> navegar ·{' '}
        <kbd className="px-1 rounded bg-ink/10">A</kbd> aprovar ·{' '}
        <kbd className="px-1 rounded bg-ink/10">R</kbd> rejeitar ·{' '}
        <kbd className="px-1 rounded bg-ink/10">U</kbd> desfazer
      </div>
      {undo ? (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
          <div className="flex items-center gap-3 bg-ink text-paper px-4 py-2.5 rounded-lg shadow-lg">
            <span className="text-sm">
              {undo.action === 'approved' ? 'Aprovado' : 'Rejeitado'}
            </span>
            <button
              type="button"
              onClick={() => {
                void undoModerationAction(undo.id).then(() => setUndo(null));
              }}
              className="text-sm font-medium text-accent hover:underline"
            >
              Desfazer (U)
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
