'use client';

import type { SubmissionStatus } from '@audience/shared-types';
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
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
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
      {items.map((i) => (
        <SubmissionCard
          key={i.id}
          id={i.id}
          name={i.name}
          comment={i.comment}
          status={i.status}
          createdAt={i.created_at}
          errorMessage={i.error_message}
        />
      ))}
    </div>
  );
}
