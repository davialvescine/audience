'use client';

import { useEffect, useRef, useState } from 'react';

import type { OpenEndedConfig, Slide } from '@/lib/slides/types';
import { resetOpenEndedSlide } from '@/server-actions/openEnded';

type Props = {
  slide: Slide<'open_ended'>;
  onChange: (config: OpenEndedConfig) => void;
  onLiveChange?: ((config: OpenEndedConfig) => void) | undefined;
};

const DEBOUNCE_MS = 500;

export function OpenEndedPropsPanel({ slide, onChange, onLiveChange }: Props) {
  const [config, setConfig] = useState<OpenEndedConfig>(slide.config);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNext = useRef(true);

  useEffect(() => {
    setConfig(slide.config);
    skipNext.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide.id, JSON.stringify(slide.config)]);

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    onLiveChange?.(config);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChange(config);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  const set = <K extends keyof OpenEndedConfig>(key: K, value: OpenEndedConfig[K]) =>
    setConfig((c) => ({ ...c, [key]: value }));

  const showQr = config.showQr !== false;
  const responsesMode = config.showResponsesMode ?? 'instant';

  return (
    <div className="space-y-5 px-4 py-3 text-sm">
      <Section title="Pergunta">
        <textarea
          value={config.question}
          onChange={(e) => set('question', e.target.value)}
          placeholder="Sua pergunta…"
          rows={2}
          className="w-full rounded-md border border-ink/15 bg-paper px-2 py-1.5 text-sm resize-none"
        />
      </Section>

      <Section title="Configurações de resposta">
        <Row label="Número de respostas">
          <select
            value={String(config.numberOfResponses)}
            onChange={(e) =>
              set(
                'numberOfResponses',
                e.target.value === 'unlimited'
                  ? 'unlimited'
                  : (parseInt(e.target.value, 10) as 1 | 2 | 3 | 4 | 5),
              )
            }
            className="rounded-md border border-ink/15 bg-paper px-2 py-1 text-sm"
          >
            <option value="unlimited">Ilimitado</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4</option>
            <option value="5">5</option>
          </select>
        </Row>
        <Toggle
          label="Pedir nome"
          checked={config.askForName === true}
          onChange={(v) => set('askForName', v)}
        />
        <Toggle
          label="Votar nas respostas"
          checked={config.allowVoting === true}
          onChange={(v) => set('allowVoting', v)}
        />
        <Toggle
          label="Auto-scroll pra nova resposta"
          checked={config.autoScroll !== false}
          onChange={(v) => set('autoScroll', v)}
        />
        <Row label="Tamanho máximo">
          <input
            type="number"
            min={20}
            max={500}
            value={config.maxLength}
            onChange={(e) => set('maxLength', parseInt(e.target.value, 10) || 150)}
            className="w-20 rounded-md border border-ink/15 bg-paper px-2 py-1 text-sm tabular-nums"
          />
        </Row>
      </Section>

      <Section title="No telão">
        <Toggle
          label="Mostrar QR code"
          checked={showQr}
          onChange={(v) => set('showQr', v)}
        />
        <Row label="Tipo do convite">
          <select
            value={config.joinInfoType ?? 'qr_and_url'}
            onChange={(e) =>
              set('joinInfoType', e.target.value as OpenEndedConfig['joinInfoType'])
            }
            className="rounded-md border border-ink/15 bg-paper px-2 py-1 text-sm"
          >
            <option value="qr_and_url">QR + URL + código</option>
            <option value="qr">Só QR</option>
            <option value="url">Só URL</option>
            <option value="code">Só código</option>
          </select>
        </Row>
        <Row label="Mostrar respostas">
          <select
            value={responsesMode}
            onChange={(e) =>
              set(
                'showResponsesMode',
                e.target.value as OpenEndedConfig['showResponsesMode'],
              )
            }
            className="rounded-md border border-ink/15 bg-paper px-2 py-1 text-sm"
          >
            <option value="instant">Instantâneo</option>
            <option value="on_click">Só quando eu liberar</option>
            <option value="private">Privado</option>
          </select>
        </Row>
      </Section>

      <Section title="Ações">
        <button
          type="button"
          onClick={async () => {
            if (!window.confirm('Resetar todas as respostas deste slide?')) return;
            await resetOpenEndedSlide(slide.id);
          }}
          className="text-xs text-danger hover:underline"
        >
          🔄 Resetar respostas
        </button>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-ink/55 mb-2">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-ink/80">{label}</span>
      {children}
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer">
      <span className="text-ink/80">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition ${
          checked ? 'bg-accent' : 'bg-ink/15'
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-paper shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  );
}
