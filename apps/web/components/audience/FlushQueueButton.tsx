'use client';

import { motion } from 'framer-motion';
import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/Button';
import { flushApprovedForEvent } from '@/server-actions/moderation';

type Props = { eventId: string; queuedCount: number; intervalSeconds: number };

export function FlushQueueButton({ eventId, queuedCount, intervalSeconds }: Props) {
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  if (queuedCount === 0) return null;

  const estimatedSeconds = queuedCount * intervalSeconds;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-lg bg-accent/15 dark:bg-accent/20 border border-accent/30"
    >
      <div className="text-sm">
        <p className="font-medium text-ink">
          {queuedCount} mensagem{queuedCount === 1 ? '' : 's'} aprovada
          {queuedCount === 1 ? '' : 's'} aguardando envio
        </p>
        <p className="text-ink/60 text-xs mt-0.5">
          Disparo espaçado a cada {intervalSeconds}s · ~{estimatedSeconds}s no total
        </p>
      </div>
      <div className="flex items-center gap-3">
        {feedback ? <span className="text-xs text-ink/70">{feedback}</span> : null}
        <Button
          variant="accent"
          size="sm"
          loading={pending}
          onClick={() =>
            start(async () => {
              setFeedback('Disparando...');
              const r = await flushApprovedForEvent(eventId);
              const parts: string[] = [];
              if (r.sent > 0) parts.push(`${r.sent} no telão`);
              if (r.queued > 0) parts.push('bridge offline');
              if (r.failed > 0) parts.push(`${r.failed} falharam`);
              if (r.total_remaining > 0) parts.push(`${r.total_remaining} restantes`);
              setFeedback(parts.join(' · ') || 'Concluído');
              setTimeout(() => setFeedback(null), 5000);
            })
          }
        >
          Disparar fila
        </Button>
      </div>
    </motion.div>
  );
}
