'use client';

import type { SubmissionStatus } from '@audience/shared-types';
import { useState, useTransition } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import {
  approveSubmission,
  rejectSubmission,
  reshowSubmission,
  retrySubmission,
} from '@/server-actions/moderation';

type Props = {
  id: string;
  name: string;
  comment: string;
  status: SubmissionStatus;
  createdAt: string;
  errorMessage: string | null;
  displayCount?: number;
};

export function SubmissionCard({ id, name, comment, status, createdAt, errorMessage, displayCount = 0 }: Props) {
  const [pending, start] = useTransition();
  const [reshowFeedback, setReshowFeedback] = useState<string | null>(null);

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="font-medium text-ink truncate">{name}</span>
            <Badge status={status} />
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
          <Button
            variant="accent"
            size="sm"
            loading={pending}
            onClick={() => {
              console.log('[reshow] click', { id });
              start(async () => {
                const r = await reshowSubmission(id);
                console.log('[reshow] result', r);
                setReshowFeedback(r.ok ? '✓ Reexibida no telão' : `✗ ${r.error}`);
                setTimeout(() => setReshowFeedback(null), 4000);
              });
            }}
          >
            ↻ Mostrar novamente
          </Button>
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
