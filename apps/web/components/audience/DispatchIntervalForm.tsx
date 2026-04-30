'use client';

import { useState, useTransition } from 'react';

import { Button } from '@/components/ui/Button';
import { updateDispatchInterval } from '@/server-actions/moderation';

const PRESETS = [1, 3, 5, 10, 15, 30];

type Props = { eventId: string; current: number };

export function DispatchIntervalForm({ eventId, current }: Props) {
  const [pending, start] = useTransition();
  const [value, setValue] = useState(current);
  const [feedback, setFeedback] = useState<string | null>(null);

  const dirty = value !== current;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-ink">Intervalo entre disparos</p>
        <p className="text-xs text-ink/60 mt-1">
          Quanto tempo o sistema espera entre enviar uma mensagem e a próxima quando há fila.
          Útil pra dar tempo da audiência ler cada mensagem no telão.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => setValue(preset)}
            className={`h-10 px-4 rounded-md border text-sm font-medium transition ${
              value === preset
                ? 'bg-ink text-paper border-ink'
                : 'bg-paper border-ink/15 text-ink hover:border-ink/30'
            }`}
          >
            {preset}s
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-ink/70">
          <span>Customizado:</span>
          <input
            type="number"
            min={1}
            max={60}
            value={value}
            onChange={(e) => setValue(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
            className="h-10 w-20 px-3 rounded-md border border-ink/25 bg-paper text-ink text-sm"
          />
          <span className="text-ink/50">segundos</span>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <Button
          loading={pending}
          disabled={!dirty}
          onClick={() =>
            start(async () => {
              const r = await updateDispatchInterval(eventId, value);
              setFeedback(r.ok ? '✓ Intervalo salvo' : `✗ ${r.error}`);
              setTimeout(() => setFeedback(null), 3000);
            })
          }
        >
          Salvar
        </Button>
        {feedback ? <span className="text-sm text-ink/70">{feedback}</span> : null}
      </div>
    </div>
  );
}
