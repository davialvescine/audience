'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { renameEvent } from '@/server-actions/renameEvent';

type Props = {
  eventId: string;
  initialName: string;
};

export function EventSettings({ eventId, initialName }: Props) {
  const [name, setName] = useState(initialName);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<
    { kind: 'idle' } | { kind: 'saved' } | { kind: 'error'; message: string }
  >({ kind: 'idle' });

  const dirty = name.trim() !== initialName.trim();
  const tooShort = name.trim().length < 2;

  const submit = () => {
    start(async () => {
      const res = await renameEvent(eventId, name.trim());
      if (res.ok) {
        setStatus({ kind: 'saved' });
        setTimeout(() => setStatus({ kind: 'idle' }), 1500);
      } else {
        setStatus({ kind: 'error', message: res.error });
      }
    });
  };

  return (
    <div className="space-y-4 max-w-xl">
      <Card>
        <h3 className="font-display text-lg mb-1">Nome do evento</h3>
        <p className="text-sm text-ink/60 mb-3">
          O nome aparece no painel admin e (opcionalmente) no card do telão.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={100}
            className="flex-1 h-10 px-3 rounded-md border border-ink/15 bg-transparent text-ink focus:border-primary focus:outline-none"
            placeholder="Nome do evento"
          />
          <Button onClick={submit} loading={pending} disabled={!dirty || tooShort || pending}>
            Salvar
          </Button>
        </div>
        <div className="mt-2 text-sm h-5">
          {status.kind === 'saved' ? <span className="text-success">✓ Salvo</span> : null}
          {status.kind === 'error' ? <span className="text-danger">✗ {status.message}</span> : null}
          {tooShort && dirty ? <span className="text-ink/50">Mínimo 2 caracteres</span> : null}
        </div>
        <p className="text-xs text-ink/50 mt-3">
          Renomear não muda o slug (URL) — links existentes continuam funcionando.
        </p>
      </Card>
    </div>
  );
}
