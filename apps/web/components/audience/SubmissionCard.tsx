'use client';

import type { SubmissionStatus } from '@audience/shared-types';
import { useState, useTransition } from 'react';

import {
  approveSubmission,
  dispatchToTelao,
  editSubmission,
  pinSubmission,
  rejectSubmission,
  removeFromTelao,
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
  const [isEditing, setIsEditing] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draftComment, setDraftComment] = useState(comment);
  const canEdit = status === 'pending' || status === 'approved';

  const startEdit = () => {
    setDraftName(name);
    setDraftComment(comment);
    setIsEditing(true);
  };
  const cancelEdit = () => {
    setIsEditing(false);
    setDraftName(name);
    setDraftComment(comment);
  };
  const saveEdit = () => {
    start(async () => {
      const r = await editSubmission(id, { name: draftName, comment: draftComment });
      if (r.ok) {
        setIsEditing(false);
        showFeedback('Editado');
      } else {
        showFeedback(r.error);
      }
    });
  };

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2500);
  };

  // Bordas/fundos por estado:
  // - fixada: roxo/primary
  // - exibida (sent): verde
  // - aprovada aguardando: amarelo
  // - rejeitada: cinza riscado
  // - falhou: vermelho
  // - pendente: neutro
  const cardCls = isPinned
    ? 'border-primary/50 bg-primary/[0.05]'
    : status === 'sent'
      ? 'border-success/40 bg-success/[0.05]'
      : status === 'approved'
        ? 'border-amber-400/50 bg-amber-50/60 dark:bg-amber-500/[0.05]'
        : status === 'rejected'
          ? 'border-danger/40 bg-danger/[0.06]'
          : status === 'failed'
            ? 'border-danger/40 bg-danger/[0.05]'
            : 'border-ink/10 bg-paper';

  return (
    <div
      className={`group rounded-md border px-3 py-2.5 transition hover:border-ink/30 ${cardCls}`}
    >
      <div className="flex items-baseline gap-2 mb-0.5">
        {isEditing ? (
          <input
            type="text"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            maxLength={60}
            placeholder="Nome (vazio = Anônimo)"
            className="text-sm font-medium text-ink bg-paper border border-ink/20 rounded px-1.5 py-0.5 flex-1 focus:border-primary focus:outline-none"
          />
        ) : (
          <span className="text-sm font-medium text-ink truncate">{name}</span>
        )}
        <span className="text-[10px] text-ink/40 tabular-nums" suppressHydrationWarning>
          {relativeTime(createdAt)}
        </span>
        <div className="ml-auto flex items-center gap-1.5 text-[10px]">
          {isPinned ? <span className="text-primary font-medium">📌 fixada</span> : null}
          {!isPinned && status === 'sent' ? (
            <span className="text-success font-medium">exibida</span>
          ) : null}
          {!isPinned && status === 'approved' ? (
            <span className="text-amber-600 dark:text-amber-400 font-medium">aguardando</span>
          ) : null}
          {displayCount > 0 ? <span className="text-ink/45">×{displayCount}</span> : null}
        </div>
      </div>
      {isEditing ? (
        <textarea
          value={draftComment}
          onChange={(e) => setDraftComment(e.target.value)}
          maxLength={150}
          rows={3}
          className="w-full text-sm text-ink/85 bg-paper border border-ink/20 rounded px-2 py-1.5 leading-snug focus:border-primary focus:outline-none"
        />
      ) : (
        <p className="text-sm text-ink/85 break-words leading-snug">{comment}</p>
      )}
      {errorMessage ? <p className="mt-1.5 text-[11px] text-danger">⚠ {errorMessage}</p> : null}

      <div className="mt-2.5 flex gap-1.5 flex-wrap">
        {isEditing ? (
          <>
            <Btn kind="primary" disabled={pending || draftComment.trim().length === 0} onClick={saveEdit}>
              Salvar
            </Btn>
            <Btn kind="ghost" disabled={pending} onClick={cancelEdit}>
              Cancelar
            </Btn>
          </>
        ) : null}

        {!isEditing && status === 'pending' ? (
          <>
            <Btn
              kind="primary"
              disabled={pending}
              onClick={() => start(() => approveSubmission(id).then(() => undefined))}
            >
              Aprovar
            </Btn>
            <Btn
              kind="ghost"
              disabled={pending}
              onClick={() => start(() => rejectSubmission(id).then(() => undefined))}
            >
              Rejeitar
            </Btn>
          </>
        ) : null}

        {!isEditing && (status === 'approved' || status === 'sent') ? (
          <>
            <Btn
              kind="secondary"
              disabled={pending}
              title="Exibir com tempo automático (entra, fica e sai sozinho)"
              onClick={() =>
                start(async () => {
                  // Se ja tava sent, volta pra approved primeiro pra re-disparar.
                  if (status === 'sent') {
                    await removeFromTelao(id);
                    if (isPinned) onPinChange?.(null);
                  }
                  const r = await dispatchToTelao(id);
                  showFeedback(r.ok ? 'Exibindo (auto)' : r.error);
                })
              }
            >
              ▶ Exibir
            </Btn>
            <Btn
              kind="primary"
              disabled={pending || (status === 'sent' && isPinned)}
              title={isPinned ? 'Já está fixada' : "Fixa no telão e fica até clicar 'Tirar do telão'"}
              onClick={() =>
                start(async () => {
                  const r = await pinSubmission(id);
                  if (r.ok) onPinChange?.(id);
                  showFeedback(r.ok ? 'Fixada no telão' : r.error);
                })
              }
            >
              Fixar no telão
            </Btn>
            <Btn
              kind="secondary"
              disabled={pending || !isPinned}
              title={
                isPinned
                  ? 'Solta a fixada (volta a rotação automática)'
                  : 'Disponível só quando fixada'
              }
              onClick={() =>
                start(async () => {
                  const r = await removeFromTelao(id);
                  if (r.ok) onPinChange?.(null);
                  showFeedback(r.ok ? 'Tirada do telão' : r.error);
                })
              }
            >
              Tirar do telão
            </Btn>
            {status === 'approved' ? (
              <Btn
                kind="ghost"
                disabled={pending}
                onClick={() => start(() => rejectSubmission(id).then(() => undefined))}
              >
                ✕
              </Btn>
            ) : null}
          </>
        ) : null}

        {!isEditing && canEdit ? (
          <Btn
            kind="ghost"
            disabled={pending}
            title="Editar nome e comentário"
            onClick={startEdit}
          >
            ✎ Editar
          </Btn>
        ) : null}

        {!isEditing && status === 'failed' ? (
          <Btn
            kind="primary"
            disabled={pending}
            onClick={() => start(() => retrySubmission(id).then(() => undefined))}
          >
            Tentar novamente
          </Btn>
        ) : null}
      </div>
      {feedback ? <p className="mt-1.5 text-[11px] text-ink/55">{feedback}</p> : null}
    </div>
  );
}

function Btn({
  kind,
  disabled,
  onClick,
  children,
  title,
}: {
  kind: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  const cls = {
    primary: 'bg-primary text-paper hover:bg-primary/90 shadow-sm',
    secondary: 'bg-ink/[0.06] text-ink hover:bg-ink/[0.1]',
    ghost: 'bg-transparent text-ink/55 hover:bg-ink/5 hover:text-ink',
  }[kind];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`text-xs h-7 px-3 rounded-md font-medium transition disabled:opacity-50 disabled:cursor-not-allowed ${cls}`}
    >
      {children}
    </button>
  );
}
