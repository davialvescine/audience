'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { generatePairingCodeForEvent } from '@/server-actions/generatePairingCode';

type Props = {
  eventId: string;
  alreadyPaired: boolean;
  lastHeartbeat: string | null;
};

export function PairingCodeDisplay({ eventId, alreadyPaired, lastHeartbeat }: Props) {
  const [pending, start] = useTransition();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOnline =
    alreadyPaired && lastHeartbeat && Date.now() - new Date(lastHeartbeat).getTime() < 90_000;

  return (
    <Card>
      <h2 className="text-xl font-display mb-3">Conexão H2R Graphics</h2>
      {alreadyPaired ? (
        <p className={`mb-4 text-sm ${isOnline ? 'text-success' : 'text-danger'}`}>
          {isOnline ? '✓ Bridge online' : '⚠ Bridge offline (sem heartbeat há mais de 90s)'}
        </p>
      ) : (
        <p className="mb-4 text-sm text-ink/60">Ainda não há bridge conectada para este evento.</p>
      )}

      {code ? (
        <div className="bg-surface p-4 rounded-md">
          <p className="text-xs text-ink/60 mb-1">Código de pareamento (válido 15 min):</p>
          <p className="font-mono text-2xl text-primary">{code}</p>
          <p className="mt-3 text-xs text-ink/70">Na máquina do H2R, rode no terminal:</p>
          <code className="block mt-1 p-2 bg-ink/5 rounded text-sm break-all">
            npx @ucob/h2r-bridge pair {code}
          </code>
        </div>
      ) : null}

      {error ? <p role="alert" className="mt-3 text-sm text-danger">{error}</p> : null}

      <Button
        className="mt-4"
        loading={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const r = await generatePairingCodeForEvent(eventId);
            if (r.ok) setCode(r.code);
            else setError(r.error);
          })
        }
      >
        {alreadyPaired ? 'Re-parear' : 'Gerar código de pareamento'}
      </Button>
    </Card>
  );
}
