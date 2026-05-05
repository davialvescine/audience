'use client';

import type { SubmissionStatus } from '@audience/shared-types';
import { useState, useTransition } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  approveSubmission,
  pinSubmission,
  rejectSubmission,
  reshowSubmission,
  retrySubmission,
  unpinSubmission,
} from '@/server-actions/moderation';

type Props = {
  id: string;
  name: string;
  comment: string;
  status: SubmissionStatus;
  createdAt: string;
  errorMessage: string | null;
  displayCount?: number;
  isPinned?: boolean;
  eventId?: string;
  onPinChange?: (pinnedId: string | null) => void;
};

export function SubmissionCard({
  id,
  name,
  comment,
  status,
  createdAt,
  errorMessage,
  displayCount = 0,
  isPinned = false,
  eventId,
  onPinChange,
}: Props) {
  const [pending, start] = useTransition();
  const [reshowFeedback, setReshowFeedback] = useState<string | null>(null);
  const pinnedLocal = isPinned;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-ink truncate">{name}</span>
            <Badge status={status} />
            {pinnedLocal ? (
              <span className="text-[10px] uppercase tracking-wide bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                📌 Fixada
              </span>
            ) : null}
            {displayCount > 0 ? (
              <span className="text-[10px] uppercase tracking-wide bg-success/15 text-success px-1.5 py-0.5 rounded">
                Exibida {displayCount}x
              </span>
            ) : null}
          </div>
          <p className="text-ink/80 break-words">{comment}</p>
          <p className="mt-2 text-xs text-ink/55" suppressHydrationWarning>
            {new Date(createdAt).toLocaleTimeString('pt-BR')}
          </p>
          {errorMessage ? <p className="mt-1 text-xs text-danger">Erro: {errorMessage}</p> : null}
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        {status === 'pending' ? (
          <>
            <Button
              variant="accent"
              loading={pending}
              onClick={() => start(() => approveSubmission(id).then(() => undefined))}
            >
              Aprovar
            </Button>
            <Button
              variant="ghost"
              loading={pending}
              onClick={() => start(() => rejectSubmission(id).then(() => undefined))}
            >
              Rejeitar
            </Button>
          </>
        ) : null}
        {status === 'sent' ? (
          <>
            <Button
              variant="accent"
              size="sm"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const r = await reshowSubmission(id);
                  setReshowFeedback(r.ok ? '✓ Reexibida no telão' : `✗ ${r.error}`);
                  setTimeout(() => setReshowFeedback(null), 4000);
                })
              }
            >
              ↻ Mostrar novamente
            </Button>
            {pinnedLocal ? (
              <Button
                variant="ghost"
                size="sm"
                loading={pending}
                onClick={() => {
                  if (!eventId) return;
                  start(async () => {
                    const r = await unpinSubmission(eventId);
                    if (r.ok) onPinChange?.(null);
                    setReshowFeedback(r.ok ? '✓ Solta' : `✗ ${r.error}`);
                    setTimeout(() => setReshowFeedback(null), 4000);
                  });
                }}
              >
                📌 Soltar do telão
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                loading={pending}
                onClick={() =>
                  start(async () => {
                    const r = await pinSubmission(id);
                    if (r.ok) onPinChange?.(id);
                    setReshowFeedback(r.ok ? '✓ Fixada no telão' : `✗ ${r.error}`);
                    setTimeout(() => setReshowFeedback(null), 4000);
                  })
                }
              >
                📌 Fixar no telão
              </Button>
            )}
          </>
        ) : null}
        {status === 'failed' ? (
          <Button
            loading={pending}
            onClick={() => start(() => retrySubmission(id).then(() => undefined))}
          >
            Tentar novamente
          </Button>
        ) : null}
      </div>
      {reshowFeedback ? (
        <p className={`mt-2 text-xs ${reshowFeedback.startsWith('✓') ? 'text-success' : 'text-danger'}`}>
          {reshowFeedback}
        </p>
      ) : null}
    </Card>
  );
}
