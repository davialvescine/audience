'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { bulkRejectPending, setSubmissionsOpen } from '@/server-actions/queueControls';

type Props = {
  eventId: string;
  initialSubmissionsOpen: boolean;
  pendingCount: number;
};

export function QueueControls({ eventId, initialSubmissionsOpen, pendingCount }: Props) {
  const [open, setOpen] = useState(initialSubmissionsOpen);
  const [pendingToggle, startToggle] = useTransition();
  const [pendingClear, startClear] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  const togglePause = () => {
    startToggle(async () => {
      const next = !open;
      const res = await setSubmissionsOpen(eventId, next);
      if (res.ok) {
        setOpen(next);
        setFeedback(next ? 'Submissões reabertas.' : 'Submissões pausadas.');
        setTimeout(() => setFeedback(null), 2500);
      } else {
        setFeedback(res.error);
        setTimeout(() => setFeedback(null), 3000);
      }
    });
  };

  const clearPending = () => {
    if (pendingCount === 0) return;
    if (!window.confirm(`Rejeitar ${pendingCount} mensagens pendentes?`)) return;
    startClear(async () => {
      const res = await bulkRejectPending(eventId);
      if (res.ok) {
        setFeedback(`${res.count ?? 0} rejeitadas.`);
        setTimeout(() => setFeedback(null), 2500);
      } else {
        setFeedback(res.error);
        setTimeout(() => setFeedback(null), 3000);
      }
    });
  };

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-ink">
            <strong className="font-medium">{open ? 'Audiência pode enviar' : 'Submissões pausadas'}</strong>
          </p>
          <p className="text-xs text-ink/60 mt-0.5">
            {open
              ? 'Audiência consegue enviar mensagens via /e/<slug>.'
              : 'Audiência vê "Submissões encerradas" e não consegue enviar.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={open ? 'ghost' : 'accent'}
            onClick={togglePause}
            loading={pendingToggle}
          >
            {open ? '⏸ Pausar' : '▶ Retomar'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={clearPending}
            disabled={pendingCount === 0 || pendingClear}
            loading={pendingClear}
            title={pendingCount === 0 ? 'Sem pendentes' : `Rejeitar ${pendingCount} pendentes`}
          >
            🗑 Rejeitar pendentes ({pendingCount})
          </Button>
        </div>
      </div>
      {feedback ? <p className="text-xs text-ink/65 mt-2">{feedback}</p> : null}
    </Card>
  );
}
