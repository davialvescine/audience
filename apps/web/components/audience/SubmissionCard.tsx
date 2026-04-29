'use client';

import type { SubmissionStatus } from '@audience/shared-types';
import { useTransition } from 'react';

import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { approveSubmission, rejectSubmission, retrySubmission } from '@/server-actions/moderation';

type Props = {
  id: string;
  name: string;
  comment: string;
  status: SubmissionStatus;
  createdAt: string;
  errorMessage: string | null;
};

export function SubmissionCard({ id, name, comment, status, createdAt, errorMessage }: Props) {
  const [pending, start] = useTransition();
  const isFinal = status === 'sent' || status === 'rejected';

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-ink truncate">{name}</span>
            <Badge status={status} />
          </div>
          <p className="text-ink/80 break-words">{comment}</p>
          <p className="mt-2 text-xs text-ink/40">
            {new Date(createdAt).toLocaleTimeString('pt-BR')}
          </p>
          {errorMessage ? <p className="mt-1 text-xs text-danger">Erro: {errorMessage}</p> : null}
        </div>
      </div>
      {!isFinal ? (
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
          {status === 'failed' ? (
            <Button
              loading={pending}
              onClick={() => start(() => retrySubmission(id).then(() => undefined))}
            >
              Tentar novamente
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}
