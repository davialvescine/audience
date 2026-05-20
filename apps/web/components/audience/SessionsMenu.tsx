'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import {
  archiveSession,
  createSession,
  deleteSession,
  listSessions,
  renameSession,
  resetSession,
  setActiveSession,
  type SessionListItem,
} from '@/server-actions/sessions';

type Props = {
  eventId: string;
  /** Trigger style — pílula compacta no toolbar do SlidesTab. */
  triggerClassName?: string;
};

/**
 * Menu de Sessões — botão no toolbar abre um modal com:
 * - Lista de sessões do evento (ativa em destaque).
 * - Criar nova sessão.
 * - Renomear, ativar, arquivar, deletar, zerar.
 *
 * Sessão = container que isola dados gerados pela audiência (comentários,
 * palavras, votos, respostas). Slides ficam fora — são compartilhados
 * entre sessões do mesmo evento.
 */
export function SessionsMenu({ eventId, triggerClassName }: Props) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const r = await listSessions(eventId);
    setLoading(false);
    if (r.ok) {
      setSessions(r.data);
      setError(null);
    } else {
      setError(r.error);
    }
  }, [eventId]);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const active = sessions.find((s) => s.is_active);

  const onCreate = () => {
    const name = window.prompt('Nome da nova sessão (ex: "Palestra Dr. Fulano", "Domingo manhã"):');
    if (!name) return;
    start(async () => {
      const r = await createSession(eventId, name);
      if (!r.ok) {
        window.alert(r.error);
        return;
      }
      await refresh();
    });
  };

  const onRename = (s: SessionListItem) => {
    const name = window.prompt('Renomear sessão:', s.name);
    if (!name || name === s.name) return;
    start(async () => {
      const r = await renameSession(s.id, name);
      if (!r.ok) {
        window.alert(r.error);
        return;
      }
      await refresh();
    });
  };

  const onActivate = (s: SessionListItem) => {
    if (s.is_active) return;
    const totalData = s.submissions_count + s.words_count + s.votes_count + s.responses_count;
    const msg =
      totalData === 0
        ? `Ativar sessão "${s.name}"?\n\nA sessão atual será preservada — você pode voltar pra ela depois.`
        : `Ativar sessão "${s.name}"?\n\nA audiência vai ver os dados desta sessão (${totalData} item(s)). A sessão atual será preservada.`;
    if (!window.confirm(msg)) return;
    start(async () => {
      const r = await setActiveSession(eventId, s.id);
      if (!r.ok) {
        window.alert(r.error);
        return;
      }
      await refresh();
    });
  };

  const onArchive = (s: SessionListItem) => {
    if (s.is_active) {
      window.alert('Não dá pra arquivar a sessão ativa. Ative outra primeiro.');
      return;
    }
    if (!window.confirm(`Arquivar "${s.name}"?\n\nFica oculta mas os dados são preservados.`)) return;
    start(async () => {
      const r = await archiveSession(s.id);
      if (!r.ok) {
        window.alert(r.error);
        return;
      }
      await refresh();
    });
  };

  const onReset = (s: SessionListItem) => {
    const total = s.submissions_count + s.words_count + s.votes_count + s.responses_count;
    if (total === 0) {
      window.alert('Essa sessão já está vazia.');
      return;
    }
    const c1 = window.confirm(
      `Zerar TODOS os dados da sessão "${s.name}"?\n\n• ${s.submissions_count} comentário(s)\n• ${s.words_count} palavra(s)\n• ${s.votes_count} voto(s)\n• ${s.responses_count} resposta(s) aberta(s)\n\nNão pode ser desfeito.`,
    );
    if (!c1) return;
    if (!window.confirm('Tem certeza? Última chance.')) return;
    start(async () => {
      const r = await resetSession(s.id);
      if (!r.ok) {
        window.alert(r.error);
        return;
      }
      const t =
        r.data.submissions_deleted +
        r.data.words_deleted +
        r.data.votes_deleted +
        r.data.responses_deleted;
      window.alert(t === 0 ? 'Nada pra zerar.' : `✓ Zerado: ${t} item(s).`);
      await refresh();
    });
  };

  const onDelete = (s: SessionListItem) => {
    if (sessions.length <= 1) {
      window.alert('Não dá pra apagar a única sessão do evento.');
      return;
    }
    const total = s.submissions_count + s.words_count + s.votes_count + s.responses_count;
    if (
      !window.confirm(
        `APAGAR sessão "${s.name}" PERMANENTEMENTE?\n\nIsso apaga a sessão E todos os ${total} dados dela. Não pode ser desfeito.`,
      )
    )
      return;
    if (!window.confirm('Tem certeza ABSOLUTA?')) return;
    start(async () => {
      const r = await deleteSession(s.id);
      if (!r.ok) {
        window.alert(r.error);
        return;
      }
      await refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          'inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-sm font-medium text-ink hover:bg-ink/[0.06] transition'
        }
        title="Gerenciar sessões — isolar dados por palestra/dia"
      >
        📅 <span>Sessão: {active?.name ?? '—'}</span>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div className="bg-paper rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-ink/10 flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg text-ink">Sessões</h2>
                <p className="text-xs text-ink/55 mt-0.5">
                  Cada sessão isola comentários/palavras/votos/respostas. Slides são compartilhados.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-8 w-8 rounded-full hover:bg-ink/[0.06] text-ink/70 flex items-center justify-center"
                aria-label="Fechar"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto flex-1 space-y-2">
              {error ? (
                <div className="p-3 rounded-md bg-danger/10 text-danger text-sm">{error}</div>
              ) : null}
              {loading && sessions.length === 0 ? (
                <p className="text-sm text-ink/55 text-center py-8">Carregando…</p>
              ) : sessions.length === 0 ? (
                <p className="text-sm text-ink/55 text-center py-8">Sem sessões ainda.</p>
              ) : (
                sessions.map((s) => {
                  const total =
                    s.submissions_count + s.words_count + s.votes_count + s.responses_count;
                  return (
                    <div
                      key={s.id}
                      className={`rounded-lg border p-3 ${
                        s.is_active
                          ? 'border-success/40 bg-success/[0.05]'
                          : 'border-ink/10 bg-paper'
                      }`}
                    >
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="font-semibold text-ink truncate flex-1">{s.name}</span>
                        {s.is_active ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-bold">
                            ● ATIVA
                          </span>
                        ) : null}
                        {s.archived_at ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-ink/10 text-ink/55">
                            arquivada
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-ink/55 mb-2.5">
                        {s.submissions_count} comentário(s) · {s.words_count} palavra(s) ·{' '}
                        {s.votes_count} voto(s) · {s.responses_count} resposta(s)
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {!s.is_active ? (
                          <button
                            type="button"
                            onClick={() => onActivate(s)}
                            disabled={pending}
                            className="text-xs h-7 px-3 rounded-md bg-primary text-paper hover:bg-primary-deep font-semibold disabled:opacity-50"
                          >
                            ▶ Ativar
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => onRename(s)}
                          disabled={pending}
                          className="text-xs h-7 px-3 rounded-md bg-ink/[0.06] text-ink hover:bg-ink/[0.1] disabled:opacity-50"
                        >
                          ✎ Renomear
                        </button>
                        {total > 0 ? (
                          <button
                            type="button"
                            onClick={() => onReset(s)}
                            disabled={pending}
                            className="text-xs h-7 px-3 rounded-md text-ink/65 hover:text-danger hover:bg-danger/[0.06] disabled:opacity-50"
                          >
                            🗑 Zerar dados
                          </button>
                        ) : null}
                        {!s.is_active ? (
                          <button
                            type="button"
                            onClick={() => onArchive(s)}
                            disabled={pending}
                            className="text-xs h-7 px-3 rounded-md text-ink/65 hover:bg-ink/[0.06] disabled:opacity-50"
                          >
                            📦 Arquivar
                          </button>
                        ) : null}
                        {sessions.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => onDelete(s)}
                            disabled={pending}
                            className="text-xs h-7 px-3 rounded-md text-danger/80 hover:text-danger hover:bg-danger/[0.08] disabled:opacity-50 ml-auto"
                          >
                            Apagar
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-4 py-3 border-t border-ink/10 flex justify-between items-center bg-ink/[0.02]">
              <p className="text-[11px] text-ink/55">
                Trocar de sessão preserva dados — você pode voltar pra qualquer uma depois.
              </p>
              <button
                type="button"
                onClick={onCreate}
                disabled={pending}
                className="text-sm h-9 px-4 rounded-full bg-accent text-ink font-bold hover:brightness-95 transition disabled:opacity-50"
              >
                + Nova sessão
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
