'use client';

import type { SubmissionStatus } from '@audience/shared-types';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

import { SubmissionCard } from './SubmissionCard';

import { EmptyState } from '@/components/ui/EmptyState';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

type Item = {
  id: string;
  name: string;
  comment: string;
  status: SubmissionStatus;
  created_at: string;
  error_message: string | null;
};

type Props = { eventId: string; initial: Item[] };

export function ModerationQueue({ eventId, initial }: Props) {
  const [items, setItems] = useState(initial);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`event:${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'submissions', filter: `event_id=eq.${eventId}` },
        (payload) => {
          // eslint-disable-next-line no-console
          console.debug('[moderation] RT', payload.eventType, (payload.new as Item)?.id);
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
        // eslint-disable-next-line no-console
        console.debug('[moderation] RT status', status);
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
      void supabase.removeChannel(channel);
      clearInterval(t);
    };
  }, [eventId]);

  if (items.length === 0) {
    return (
      <EmptyState
        title="Sem submissões ainda"
        description="Quando o público enviar, aparece aqui em tempo real."
      />
    );
  }

  return (
    <div className="grid gap-3">
      <AnimatePresence initial={false}>
        {items.map((i) => (
          <motion.div
            key={i.id}
            layout
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.2 } }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <SubmissionCard
              id={i.id}
              name={i.name}
              comment={i.comment}
              status={i.status}
              createdAt={i.created_at}
              errorMessage={i.error_message}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
