'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { addEventMember, removeEventMember } from '@/server-actions/eventMembers';

type Member = {
  user_id: string;
  email: string;
  added_at: string;
  is_owner: boolean;
};

type PlatformUser = {
  user_id: string;
  email: string;
};

type Props = {
  eventId: string;
  currentUserId: string;
  initialMembers: Member[];
  platformUsers: PlatformUser[];
  isOwner: boolean;
};

export function EventMembers({
  eventId,
  currentUserId,
  initialMembers,
  platformUsers,
  isOwner,
}: Props) {
  const [members, setMembers] = useState(initialMembers);
  const [email, setEmail] = useState('');
  const memberIds = new Set(members.map((m) => m.user_id));
  const candidates = platformUsers.filter((u) => !memberIds.has(u.user_id));
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const add = () => {
    setFeedback(null);
    const picked = platformUsers.find((u) => u.email === email);
    if (!picked) return;
    start(async () => {
      const res = await addEventMember(eventId, email);
      if (!res.ok) {
        setFeedback({ kind: 'err', msg: res.error });
        return;
      }
      setMembers((prev) => [
        ...prev,
        {
          user_id: picked.user_id,
          email: picked.email,
          added_at: new Date().toISOString(),
          is_owner: false,
        },
      ]);
      setEmail('');
      setFeedback({ kind: 'ok', msg: `${picked.email} adicionado.` });
    });
  };

  const remove = (m: Member) => {
    if (m.is_owner) return;
    if (m.user_id === currentUserId) {
      if (!window.confirm('Remover você mesmo? Você perde acesso a esse evento.')) return;
    } else {
      if (!window.confirm(`Remover ${m.email}?`)) return;
    }
    start(async () => {
      const res = await removeEventMember(eventId, m.user_id);
      if (!res.ok) {
        setFeedback({ kind: 'err', msg: res.error });
        return;
      }
      setMembers((prev) => prev.filter((x) => x.user_id !== m.user_id));
      setFeedback({ kind: 'ok', msg: 'Removido.' });
    });
  };

  return (
    <Card>
      <h3 className="font-display text-lg mb-1">Gestores do evento</h3>
      <p className="text-sm text-ink/60 mb-4">
        Pessoas com acesso completo a este evento (moderar, configurar telão, ver compartilhamento).
        Pra dar acesso só de moderação sem login, usa o link de moderador abaixo.
        {isOwner ? '' : ' Só o dono pode adicionar/remover.'}
      </p>

      <ul className="divide-y divide-ink/10 mb-4">
        {members.map((m) => (
          <li key={m.user_id} className="py-2 flex items-center justify-between gap-3 text-sm">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-ink truncate">{m.email}</span>
              {m.is_owner ? (
                <span className="text-[10px] uppercase tracking-wide bg-primary/15 text-primary px-1.5 py-0.5 rounded">
                  Dono
                </span>
              ) : null}
              {m.user_id === currentUserId ? (
                <span className="text-[10px] uppercase tracking-wide bg-ink/10 text-ink/60 px-1.5 py-0.5 rounded">
                  Você
                </span>
              ) : null}
            </div>
            {isOwner && !m.is_owner ? (
              <button
                type="button"
                onClick={() => remove(m)}
                disabled={pending}
                className="text-xs text-danger hover:underline disabled:opacity-50"
              >
                Remover
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      {isOwner ? (
        <>
          <div className="flex gap-2">
            <select
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={candidates.length === 0}
              className="flex-1 h-10 px-3 rounded-md border border-ink/15 bg-transparent text-ink focus:border-primary focus:outline-none disabled:opacity-60"
            >
              <option value="">
                {candidates.length === 0
                  ? 'Todos os usuários já são gestores'
                  : 'Selecione um usuário…'}
              </option>
              {candidates.map((u) => (
                <option key={u.user_id} value={u.email}>
                  {u.email}
                </option>
              ))}
            </select>
            <Button onClick={add} loading={pending} disabled={!email || pending}>
              Adicionar
            </Button>
          </div>
          <p className="text-xs text-ink/50 mt-2">
            Não vê a pessoa na lista? Convide ela primeiro em{' '}
            <a href="/admin/users" className="text-primary hover:underline">
              /admin/users
            </a>
            .
          </p>
        </>
      ) : null}

      {feedback ? (
        <p className={`text-xs mt-2 ${feedback.kind === 'ok' ? 'text-success' : 'text-danger'}`}>
          {feedback.kind === 'ok' ? '✓' : '✗'} {feedback.msg}
        </p>
      ) : null}
    </Card>
  );
}
