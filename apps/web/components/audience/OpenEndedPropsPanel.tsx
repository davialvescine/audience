'use client';

import { useEffect, useRef, useState } from 'react';

import type { WordcloudBackground } from '@/hooks/useWordcloudActive';
import type { OpenEndedConfig, Slide } from '@/lib/slides/types';
import { resetOpenEndedSlide } from '@/server-actions/openEnded';

const BACKGROUND_PRESETS: Array<{ label: string; bg: WordcloudBackground }> = [
  { label: 'Sem fundo', bg: { type: 'none' } },
  { label: 'Branco', bg: { type: 'color', value: '#FFFFFF' } },
  { label: 'Escuro', bg: { type: 'color', value: '#0A2540' } },
  { label: 'Sunset', bg: { type: 'gradient', from: '#FF6B6B', to: '#FFE66D' } },
  { label: 'Ocean', bg: { type: 'gradient', from: '#0077B6', to: '#4ECDC4' } },
  { label: 'Forest', bg: { type: 'gradient', from: '#06A77D', to: '#1D3557' } },
  { label: 'Purple', bg: { type: 'gradient', from: '#6A4C93', to: '#E63946' } },
];

function bgPreview(bg: WordcloudBackground | undefined): string {
  if (!bg || bg.type === 'none') return 'transparent';
  if (bg.type === 'color') return bg.value;
  if (bg.type === 'gradient') return `linear-gradient(135deg, ${bg.from}, ${bg.to})`;
  return 'transparent';
}

function bgEquals(a: WordcloudBackground | undefined, b: WordcloudBackground): boolean {
  if (!a) return b.type === 'none';
  if (a.type !== b.type) return false;
  if (a.type === 'color' && b.type === 'color') return a.value === b.value;
  if (a.type === 'gradient' && b.type === 'gradient')
    return a.from === b.from && a.to === b.to;
  return a.type === b.type;
}

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
            className="rounded-md border border-ink/15 bg-paper px-2 py-1.5 text-sm h-8 cursor-pointer"
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

      <Section title="Design">
        <p className="text-xs text-ink/55 mb-2">Fundo do slide</p>
        <div className="grid grid-cols-4 gap-2">
          {BACKGROUND_PRESETS.map((p) => {
            const isActive = bgEquals(config.background, p.bg);
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => set('background', p.bg)}
                title={p.label}
                aria-label={p.label}
                aria-pressed={isActive}
                className={`relative aspect-square rounded-md overflow-hidden transition border ${
                  isActive ? 'border-accent ring-2 ring-accent/40' : 'border-ink/15 hover:border-ink/40'
                }`}
                style={{
                  background: bgPreview(p.bg),
                  // "Sem fundo" mostra padrão xadrez sutil pra indicar transparência.
                  backgroundImage:
                    p.bg.type === 'none'
                      ? 'linear-gradient(45deg, #ddd 25%, transparent 25%), linear-gradient(-45deg, #ddd 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ddd 75%), linear-gradient(-45deg, transparent 75%, #ddd 75%)'
                      : undefined,
                  backgroundSize: p.bg.type === 'none' ? '8px 8px' : undefined,
                  backgroundPosition:
                    p.bg.type === 'none' ? '0 0, 0 4px, 4px -4px, -4px 0px' : undefined,
                }}
              />
            );
          })}
        </div>
        <p className="text-[11px] text-ink/45 mt-2">
          {config.background?.type === 'none' || !config.background
            ? 'Slide transparente — útil pra OBS/streaming.'
            : BACKGROUND_PRESETS.find((p) => bgEquals(config.background, p.bg))?.label ?? 'Custom'}
        </p>
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
            className="rounded-md border border-ink/15 bg-paper px-2 py-1.5 text-sm h-8 cursor-pointer"
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
            className="rounded-md border border-ink/15 bg-paper px-2 py-1.5 text-sm h-8 cursor-pointer"
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
          className="inline-flex items-center gap-2 h-8 px-3 rounded-md text-sm font-medium text-danger bg-danger/10 hover:bg-danger/15 transition"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M3 12a9 9 0 1 0 3-6.7" />
            <path d="M3 4v5h5" />
          </svg>
          Resetar respostas
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
    <label className="flex items-center justify-between gap-3 cursor-pointer py-0.5">
      <span className="text-ink/85">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        // Switch maior, knob explícito em branco (não bg-paper) pra contraste
        // tanto em light quanto em dark mode.
        className={`relative h-6 w-11 rounded-full transition-colors shrink-0 ${
          checked ? 'bg-accent' : 'bg-ink/20'
        }`}
      >
        <span
          aria-hidden
          className={`block h-5 w-5 rounded-full shadow-md transition-transform ${
            checked ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
          style={{ background: '#FFFFFF', marginTop: 2 }}
        />
      </button>
    </label>
  );
}
