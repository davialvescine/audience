'use client';

import type { SubmissionStatus } from '@audience/shared-types';
import { useEffect, useMemo, useState, useTransition } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import {
  getActiveSlideQrStateViaToken,
  setQrViaToken,
} from '@/server-actions/moderatorControls';

type Item = {
  id: string;
  name: string;
  comment: string;
  status: SubmissionStatus;
  created_at: string;
  error_message: string | null;
};

type Props = {
  token: string;
  eventName: string;
  moderatorName: string | null;
  initial: Item[];
};

type Action = 'approve' | 'reject' | 'send' | 'undo' | 'pin' | 'unpin' | 'reshow';

type Filter = 'pending' | 'approved' | 'sent' | 'all';

export function ModeratorClient({ token, eventName, moderatorName, initial }: Props) {
  const [items, setItems] = useState<Item[]>(initial);
  const [filter, setFilter] = useState<Filter>('pending');
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Estado dos toggles de QR — polling a cada 2.5s junto com submissions.
  // isCommentsActive = false → esconde o card de Controles (slide ativo
  // não é de comentários, então QR não faz sentido).
  const [isCommentsActive, setIsCommentsActive] = useState(false);
  const [qrShow, setQrShow] = useState(false);
  const [qrFullscreen, setQrFullscreen] = useState(false);
  const [qrBusy, setQrBusy] = useState(false);

  // Polling. RPCs em paralelo MAS com try/catch isolado — falha de uma
  // (ex.: get_pinned_via_token não criada ainda em algum env) NÃO derruba
  // o resto. Sem isso, "TypeError: Failed to fetch" do pinned vazava pro
  // usuário e a lista de submissions sumia.
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    const fetchItems = async () => {
      try {
        const { data, error } = await supabase.rpc('get_submissions_via_token', {
          p_token: token,
        });
        if (error) {
          setError(error.message);
          return;
        }
        if (data) {
          setItems(data as Item[]);
          setError(null);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro de rede ao buscar mensagens.');
      }
    };

    const fetchPinned = async () => {
      try {
        type RpcFn = (
          fn: string,
          args: Record<string, unknown>,
        ) => Promise<{ data: Array<{ id: string }> | null; error: { message: string } | null }>;
        const { data, error } = await (supabase.rpc as unknown as RpcFn)(
          'get_pinned_via_token',
          { p_token: token },
        );
        if (error) return; // silencioso — pin é nice-to-have
        const row = data?.[0];
        setPinnedId(row?.id ?? null);
      } catch {
        // ignore — RPC pode não existir, network fail, etc. Pin não-crítico.
      }
    };

    const fetchQrState = async () => {
      try {
        const r = await getActiveSlideQrStateViaToken(token);
        if (!r.ok) return;
        setIsCommentsActive(r.isComments);
        if (!qrBusy) {
          setQrShow(r.showQr);
          setQrFullscreen(r.qrFullscreen);
        }
      } catch {
        /* noop */
      }
    };

    void fetchItems();
    void fetchPinned();
    void fetchQrState();
    const t = setInterval(() => {
      void fetchItems();
      void fetchPinned();
      void fetchQrState();
    }, 2500);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const toggleQr = async (field: 'showQr' | 'qrFullscreen', next: boolean) => {
    setQrBusy(true);
    if (field === 'showQr') setQrShow(next);
    else setQrFullscreen(next);
    const r = await setQrViaToken(token, { [field]: next });
    setQrBusy(false);
    if (!r.ok) {
      // rollback
      if (field === 'showQr') setQrShow(!next);
      else setQrFullscreen(!next);
      setError(r.error);
    }
  };

  const counts = useMemo(
    () => ({
      pending: items.filter((it) => it.status === 'pending').length,
      approved: items.filter((it) => it.status === 'approved').length,
      sent: items.filter((it) => it.status === 'sent').length,
      all: items.length,
    }),
    [items],
  );

  const moderate = (id: string, action: Action) => {
    start(async () => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc('moderate_with_token', {
        p_token: token,
        p_submission_id: id,
        p_action: action,
      });
      if (error) {
        setError(error.message);
        return;
      }
      setError(null);
      // Optimistic local — polling reconcilia.
      if (action === 'approve') {
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, status: 'sent' as const } : it)),
        );
      } else if (action === 'reject') {
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, status: 'rejected' as const } : it)),
        );
      } else if (action === 'send' || action === 'reshow') {
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, status: 'sent' as const } : it)),
        );
      } else if (action === 'undo') {
        setItems((prev) =>
          prev.map((it) => (it.id === id ? { ...it, status: 'pending' as const } : it)),
        );
      } else if (action === 'pin') {
        setPinnedId(id);
      } else if (action === 'unpin') {
        setPinnedId(null);
      }
    });
  };

  const visible = items.filter((it) => filter === 'all' || it.status === filter);

  return (
    <div className="min-h-screen bg-surface text-ink">
      <header className="sticky top-0 z-10 bg-paper border-b border-ink/10 px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <p className="text-xs text-ink/55 uppercase tracking-wide">Moderar</p>
          <h1 className="font-display text-xl text-ink truncate">{eventName}</h1>
          {moderatorName ? (
            <p className="text-xs text-ink/60 mt-0.5">Olá, {moderatorName}</p>
          ) : null}
          <div className="mt-3 flex items-center gap-1.5 text-xs overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <FilterBtn
              active={filter === 'pending'}
              onClick={() => setFilter('pending')}
              label="Pendentes"
              count={counts.pending}
            />
            <FilterBtn
              active={filter === 'approved'}
              onClick={() => setFilter('approved')}
              label="Na fila"
              count={counts.approved}
            />
            <FilterBtn
              active={filter === 'sent'}
              onClick={() => setFilter('sent')}
              label="Exibidas"
              count={counts.sent}
            />
            <FilterBtn
              active={filter === 'all'}
              onClick={() => setFilter('all')}
              label="Tudo"
              count={counts.all}
            />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-3">
        {error ? (
          <div className="p-3 rounded-md bg-danger/10 text-danger text-sm">{error}</div>
        ) : null}

        {isCommentsActive ? (
          <div className="rounded-lg border border-primary/30 bg-primary/[0.04] p-3">
            <p className="text-xs uppercase tracking-wide text-primary/70 font-bold mb-2">
              Controles do telão
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => void toggleQr('showQr', !qrShow)}
                disabled={qrBusy}
                className={`text-sm rounded-md border-2 p-3 transition disabled:opacity-60 ${
                  qrShow
                    ? 'border-primary bg-primary text-paper'
                    : 'border-ink/15 bg-paper text-ink hover:border-ink/30'
                }`}
              >
                <span className="text-lg">📱</span>
                <p className="font-semibold mt-1">QR lateral</p>
                <p className="text-[10px] opacity-80 mt-0.5">{qrShow ? 'Aparecendo' : 'Oculto'}</p>
              </button>
              <button
                type="button"
                onClick={() => void toggleQr('qrFullscreen', !qrFullscreen)}
                disabled={qrBusy}
                className={`text-sm rounded-md border-2 p-3 transition disabled:opacity-60 ${
                  qrFullscreen
                    ? 'border-accent bg-accent text-ink'
                    : 'border-ink/15 bg-paper text-ink hover:border-ink/30'
                }`}
              >
                <span className="text-lg">🔍</span>
                <p className="font-semibold mt-1">QR tela cheia</p>
                <p className="text-[10px] opacity-80 mt-0.5">
                  {qrFullscreen ? 'Aparecendo' : 'Oculto'}
                </p>
              </button>
            </div>
          </div>
        ) : null}
        {visible.length === 0 ? (
          <div className="text-center py-12 text-ink/55">
            <p className="text-base">Nenhuma mensagem aqui.</p>
            <p className="text-xs mt-1">A página atualiza sozinha a cada 2.5s.</p>
          </div>
        ) : (
          visible.map((it) => (
            <Card
              key={it.id}
              item={it}
              isPinned={pinnedId === it.id}
              pending={pending}
              onModerate={moderate}
            />
          ))
        )}
      </main>

      <footer className="text-center text-xs text-ink/40 pb-6">
        Audience · Moderador via link
      </footer>
    </div>
  );
}

function FilterBtn({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 h-8 rounded-md border transition shrink-0 inline-flex items-center gap-1.5 ${
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-ink/15 text-ink/60 hover:border-ink/30'
      }`}
    >
      <span>{label}</span>
      <span
        className={`text-[10px] px-1.5 rounded-full ${
          active ? 'bg-primary/20' : 'bg-ink/10'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function Card({
  item,
  isPinned,
  pending,
  onModerate,
}: {
  item: Item;
  isPinned: boolean;
  pending: boolean;
  onModerate: (id: string, action: Action) => void;
}) {
  return (
    <div
      className={`rounded-lg bg-paper border p-4 ${
        isPinned ? 'border-accent ring-1 ring-accent/30' : 'border-ink/10'
      }`}
    >
      <div className="flex items-center justify-between mb-2 gap-2">
        <span className="font-medium text-ink truncate flex-1">{item.name}</span>
        {isPinned ? (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent font-semibold">
            📌 Fixada
          </span>
        ) : null}
        <StatusPill status={item.status} />
      </div>
      <p className="text-ink/85 break-words mb-3">{item.comment}</p>

      <div className="flex flex-wrap gap-2">
        {item.status === 'pending' ? (
          <>
            <ActionBtn
              variant="primary"
              onClick={() => onModerate(item.id, 'approve')}
              disabled={pending}
            >
              ✓ Aprovar
            </ActionBtn>
            <ActionBtn
              variant="ghost"
              onClick={() => onModerate(item.id, 'reject')}
              disabled={pending}
            >
              ✗ Rejeitar
            </ActionBtn>
          </>
        ) : null}

        {item.status === 'approved' ? (
          <>
            <ActionBtn
              variant="primary"
              onClick={() => onModerate(item.id, 'send')}
              disabled={pending}
            >
              ▶ Fixar no telão
            </ActionBtn>
            <ActionBtn
              variant="ghost"
              onClick={() => onModerate(item.id, 'undo')}
              disabled={pending}
            >
              ↶ Desfazer
            </ActionBtn>
          </>
        ) : null}

        {item.status === 'sent' ? (
          <>
            {isPinned ? (
              <ActionBtn
                variant="ghost"
                onClick={() => onModerate(item.id, 'unpin')}
                disabled={pending}
              >
                Soltar
              </ActionBtn>
            ) : (
              <ActionBtn
                variant="ghost"
                onClick={() => onModerate(item.id, 'pin')}
                disabled={pending}
              >
                📌 Fixar no telão
              </ActionBtn>
            )}
            <ActionBtn
              variant="ghost"
              onClick={() => onModerate(item.id, 'reshow')}
              disabled={pending}
            >
              ↻ Mostrar de novo
            </ActionBtn>
            <ActionBtn
              variant="ghost"
              onClick={() => onModerate(item.id, 'undo')}
              disabled={pending}
            >
              ↶ Desfazer
            </ActionBtn>
          </>
        ) : null}

        {item.status === 'rejected' || item.status === 'failed' ? (
          <ActionBtn
            variant="ghost"
            onClick={() => onModerate(item.id, 'undo')}
            disabled={pending}
          >
            ↶ Desfazer
          </ActionBtn>
        ) : null}
      </div>
      {item.error_message ? (
        <p className="mt-2 text-xs text-danger">{item.error_message}</p>
      ) : null}
    </div>
  );
}

function ActionBtn({
  variant,
  onClick,
  disabled,
  children,
}: {
  variant: 'primary' | 'ghost';
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-10 px-4 rounded-md text-sm font-medium disabled:opacity-50 transition ${
        variant === 'primary'
          ? 'bg-accent text-paper hover:opacity-90'
          : 'border border-ink/15 text-ink/75 hover:bg-ink/5'
      }`}
    >
      {children}
    </button>
  );
}

function StatusPill({ status }: { status: SubmissionStatus }) {
  const map: Record<SubmissionStatus, { label: string; cls: string }> = {
    pending: { label: 'Aguardando', cls: 'bg-warning/15 text-warning' },
    approved: { label: 'Na fila', cls: 'bg-accent/15 text-accent' },
    sent: { label: 'Exibida', cls: 'bg-success/15 text-success' },
    rejected: { label: 'Rejeitada', cls: 'bg-ink/10 text-ink/60' },
    failed: { label: 'Falhou', cls: 'bg-danger/15 text-danger' },
  };
  const m = map[status];
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${m.cls}`}>
      {m.label}
    </span>
  );
}
