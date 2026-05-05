'use client';

import type { SubmissionStatus } from '@audience/shared-types';
import { useState, useTransition } from 'react';

import {
  approveSubmission,
  dispatchToTelao,
  pinSubmission,
  rejectSubmission,
  removeFromTelao,
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

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const sec = Math.round(diffMs / 1000);
  if (sec < 60) return 'agora';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  const d = Math.round(hr / 24);
  return `${d}d`;
}

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
  const [feedback, setFeedback] = useState<string | null>(null);
  const pinnedLocal = isPinned;

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 3000);
  };

  return (
    <div
      className={`group rounded-md border bg-paper px-3 py-2.5 transition hover:border-ink/25 ${
        pinnedLocal ? 'border-primary/40' : 'border-ink/10'
      }`}
    >
      <div className="flex items-baseline gap-2 mb-0.5">
        <span className="text-sm font-medium text-ink truncate">{name}</span>
        <span className="text-[10px] text-ink/40 tabular-nums" suppressHydrationWarning>
          {relativeTime(createdAt)}
        </span>
        {pinnedLocal ? (
          <span className="text-[10px] text-primary ml-auto">📌</span>
        ) : displayCount > 0 ? (
          <span className="text-[10px] text-ink/45 ml-auto">×{displayCount}</span>
        ) : null}
      </div>
      <p className="text-sm text-ink/85 break-words leading-snug">{comment}</p>
      {errorMessage ? (
        <p className="mt-1.5 text-[11px] text-danger">⚠ {errorMessage}</p>
      ) : null}

      <div className="mt-2.5 flex gap-1.5 flex-wrap">
        {status === 'pending' ? (
          <>
            <ActionButton
              variant="primary"
              disabled={pending}
              onClick={() => start(() => approveSubmission(id).then(() => undefined))}
            >
              Aprovar
            </ActionButton>
            <ActionButton
              variant="subtle"
              disabled={pending}
              onClick={() => start(() => rejectSubmission(id).then(() => undefined))}
            >
              Rejeitar
            </ActionButton>
          </>
        ) : null}
        {status === 'approved' ? (
          <>
            <ActionButton
              variant="primary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await pinSubmission(id);
                  if (r.ok) onPinChange?.(id);
                  showFeedback(r.ok ? 'Fixada no telão' : r.error);
                })
              }
            >
              📌 Mostrar no telão
            </ActionButton>
            <ActionButton
              variant="subtle"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await dispatchToTelao(id);
                  showFeedback(r.ok ? `Exibindo (auto)` : r.error);
                })
              }
            >
              ↻ Exibir auto
            </ActionButton>
            <ActionButton
              variant="subtle"
              disabled={pending}
              onClick={() => start(() => rejectSubmission(id).then(() => undefined))}
            >
              ✕
            </ActionButton>
          </>
        ) : null}
        {status === 'sent' ? (
          <>
            {!pinnedLocal ? (
              <ActionButton
                variant="subtle"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await removeFromTelao(id);
                    showFeedback(r.ok ? 'Tirada do telão' : r.error);
                  })
                }
              >
                ⏹ Tirar
              </ActionButton>
            ) : null}
            {pinnedLocal ? (
              <ActionButton
                variant="primary"
                disabled={pending}
                onClick={() => {
                  if (!eventId) return;
                  start(async () => {
                    const r = await unpinSubmission(eventId);
                    if (r.ok) onPinChange?.(null);
                    showFeedback(r.ok ? 'Solta' : r.error);
                  });
                }}
              >
                📌 Soltar
              </ActionButton>
            ) : (
              <ActionButton
                variant="subtle"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const r = await pinSubmission(id);
                    if (r.ok) onPinChange?.(id);
                    showFeedback(r.ok ? 'Fixada' : r.error);
                  })
                }
              >
                📌 Fixar
              </ActionButton>
            )}
          </>
        ) : null}
        {status === 'failed' ? (
          <ActionButton
            variant="primary"
            disabled={pending}
            onClick={() => start(() => retrySubmission(id).then(() => undefined))}
          >
            Tentar novamente
          </ActionButton>
        ) : null}
      </div>
      {feedback ? (
        <p className="mt-1.5 text-[11px] text-ink/55">{feedback}</p>
      ) : null}
    </div>
  );
}

function ActionButton({
  variant,
  disabled,
  onClick,
  children,
}: {
  variant: 'primary' | 'subtle';
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const cls =
    variant === 'primary'
      ? 'bg-primary text-paper hover:bg-primary/90'
      : 'bg-transparent text-ink/65 hover:bg-ink/5';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`text-xs h-7 px-2.5 rounded-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${cls}`}
    >
      {children}
    </button>
  );
}
