'use client';

import { useEffect, useRef, useState } from 'react';

import {
  BACKGROUND_PRESETS,
  BgImageUploader,
  Check,
  LiveBadge,
  Section,
} from '@/components/audience/SlidePropsPanel';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { WordcloudBackground } from '@/hooks/useWordcloudActive';
import {
  DEFAULT_POLL_CONFIG,
  type PollConfig,
  type Slide,
} from '@/lib/slides/types';
import { resetPollSlide } from '@/server-actions/poll';

type Props = {
  slide: Slide<'poll'>;
  onChange: (config: PollConfig) => void;
  onLiveChange?: ((config: PollConfig) => void) | undefined;
};

const DEBOUNCE_MS = 500;

export function PollPropsPanel({ slide, onChange, onLiveChange }: Props) {
  const [config, setConfig] = useState<PollConfig>({ ...DEFAULT_POLL_CONFIG, ...slide.config });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNext = useRef(true);
  const [tab, setTab] = useState<'conteudo' | 'design' | 'avancado'>('conteudo');

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setConfig({ ...DEFAULT_POLL_CONFIG, ...slide.config });
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

  const setBg = (bg: WordcloudBackground) => setConfig((c) => ({ ...c, background: bg }));
  const bg = (config.background ?? { type: 'none' }) as WordcloudBackground;

  const updateOption = (idx: number, value: string) => {
    setConfig((c) => {
      const next = [...c.options];
      next[idx] = value;
      return { ...c, options: next };
    });
  };
  const addOption = () => {
    if (config.options.length >= 10) return;
    setConfig((c) => ({ ...c, options: [...c.options, ''] }));
  };
  const removeOption = (idx: number) => {
    if (config.options.length <= 2) return;
    setConfig((c) => {
      const next = c.options.filter((_, i) => i !== idx);
      const correctOption =
        c.correctOption == null
          ? null
          : c.correctOption === idx
            ? null
            : c.correctOption > idx
              ? c.correctOption - 1
              : c.correctOption;
      return { ...c, options: next, correctOption };
    });
  };

  const reveal = () => setConfig((c) => ({ ...c, revealed: true }));
  const hideResults = () => setConfig((c) => ({ ...c, revealed: false }));

  const reset = async () => {
    if (!window.confirm('Apagar todos os votos deste slide?')) return;
    await resetPollSlide(slide.id);
  };

  return (
    <div className="flex flex-col gap-3 pb-4">
      <div className="flex items-center gap-1 rounded-full bg-ink/[0.05] p-1 sticky top-0 z-10">
        {(
          [
            { id: 'conteudo' as const, label: 'Conteúdo' },
            { id: 'design' as const, label: 'Design' },
            { id: 'avancado' as const, label: 'Avançado' },
          ]
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 h-8 rounded-full text-xs font-semibold transition ${
              tab === t.id ? 'bg-paper text-ink shadow-sm' : 'text-ink/55 hover:text-ink/80'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* CONTEÚDO */}
      <div className="space-y-3" hidden={tab !== 'conteudo'}>
        <Section title="Modo">
          <Check
            label="Modo Fato/Fake (visual quiz com gabarito)"
            checked={config.factCheckMode === true}
            onChange={(v) => setConfig((c) => ({ ...c, factCheckMode: v }))}
          />
          <p className="text-[11px] text-ink/55 mt-1">
            Quando ligado, mostra botões grandes Verde (Fato) e Vermelho (Fake) +
            anima a revelação da resposta correta.
          </p>
        </Section>

        <Section title="Pergunta">
          <Input
            label=""
            id={`q-${slide.id}`}
            value={config.question}
            onChange={(e) => setConfig((c) => ({ ...c, question: e.target.value }))}
            maxLength={200}
            placeholder="Ex: Vacinas causam autismo?"
          />
        </Section>

        <Section title="Opções">
          {config.options.map((opt, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setConfig((c) => ({
                    ...c,
                    correctOption: c.correctOption === idx ? null : idx,
                  }))
                }
                title={
                  config.correctOption === idx
                    ? 'Opção marcada como correta'
                    : 'Marcar como correta (modo quiz)'
                }
                className={`h-9 w-9 shrink-0 rounded-md border-2 flex items-center justify-center transition ${
                  config.correctOption === idx
                    ? 'border-success bg-success/10 text-success'
                    : 'border-ink/15 text-ink/40 hover:border-success/50'
                }`}
              >
                {config.correctOption === idx ? '✓' : ''}
              </button>
              <Input
                label=""
                id={`opt-${slide.id}-${idx}`}
                value={opt}
                onChange={(e) => updateOption(idx, e.target.value)}
                maxLength={80}
                placeholder={`Opção ${idx + 1}`}
              />
              <button
                type="button"
                onClick={() => removeOption(idx)}
                disabled={config.options.length <= 2}
                className="h-9 w-9 shrink-0 rounded-md text-ink/45 hover:bg-danger/10 hover:text-danger disabled:opacity-25 disabled:cursor-not-allowed transition"
                title="Remover opção"
                aria-label="Remover opção"
              >
                ✕
              </button>
            </div>
          ))}
          {config.options.length < 10 ? (
            <button
              type="button"
              onClick={addOption}
              className="text-sm text-primary hover:underline mt-2"
            >
              + Adicionar opção
            </button>
          ) : (
            <p className="text-[11px] text-ink/55">Máx. 10 opções</p>
          )}
          <p className="text-[11px] text-ink/55 mt-2">
            Clica no quadrado verde pra marcar a resposta correta (modo quiz). Sem
            correta marcada vira enquete normal — todos os votos são "válidos".
          </p>
        </Section>
      </div>

      {/* DESIGN */}
      <div className="space-y-3" hidden={tab !== 'design'}>
        <Section title="Plano de fundo">
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setBg({ type: 'none' })}
              className={`h-12 rounded-md border text-[10px] font-medium overflow-hidden relative ${
                bg.type === 'none'
                  ? 'border-accent ring-1 ring-accent/40'
                  : 'border-ink/15 hover:border-accent'
              }`}
              style={{
                backgroundImage:
                  'linear-gradient(45deg, #ddd 25%, transparent 25%), linear-gradient(-45deg, #ddd 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ddd 75%), linear-gradient(-45deg, transparent 75%, #ddd 75%)',
                backgroundSize: '8px 8px',
                backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
              }}
              title="Sem fundo (transparente — ideal pro OBS)"
            >
              <span
                className="absolute bottom-0 left-0 right-0 bg-paper/80 backdrop-blur px-1 text-ink truncate"
                style={{ lineHeight: '14px' }}
              >
                Sem fundo
              </span>
            </button>
            {BACKGROUND_PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setConfig((c) => ({ ...c, background: p.bg }))}
                className="h-12 rounded-md border border-ink/15 hover:border-accent text-[10px] font-medium overflow-hidden relative"
                style={{
                  ...(p.bg.type === 'color' ? { background: p.bg.value } : {}),
                  ...(p.bg.type === 'gradient'
                    ? { background: `linear-gradient(135deg, ${p.bg.from}, ${p.bg.to})` }
                    : {}),
                }}
                title={p.label}
              >
                <span
                  className="absolute bottom-0 left-0 right-0 bg-paper/80 backdrop-blur px-1 text-ink truncate"
                  style={{ lineHeight: '14px' }}
                >
                  {p.label}
                </span>
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <input
              type="color"
              aria-label="Cor sólida"
              value={bg.type === 'color' ? bg.value : '#FFFFFF'}
              onChange={(e) => setBg({ type: 'color', value: e.target.value })}
              className="h-9 w-9 rounded cursor-pointer"
              title="Cor sólida"
            />
            <BgImageUploader
              eventId={slide.event_id}
              current={bg.type === 'image' ? bg.url : null}
              onUploaded={(url) =>
                setBg({ type: 'image', url, fit: 'cover', opacity: 1, blurPx: 0 })
              }
              onClear={() => setBg({ type: 'none' })}
              label={bg.type === 'image' ? 'Trocar imagem' : 'Subir imagem 16:9'}
            />
          </div>
        </Section>
      </div>

      {/* AVANÇADO */}
      <div className="space-y-3" hidden={tab !== 'avancado'}>
        <Section title="Mostrar resultados" live>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={config.showResults === 'instant'}
                onChange={() => setConfig((c) => ({ ...c, showResults: 'instant' }))}
              />
              <span className="text-sm">Imediatamente após votar</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={config.showResults === 'after_reveal'}
                onChange={() => setConfig((c) => ({ ...c, showResults: 'after_reveal' }))}
              />
              <span className="text-sm">Só quando eu liberar (botão Revelar)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={config.showResults === 'private'}
                onChange={() => setConfig((c) => ({ ...c, showResults: 'private' }))}
              />
              <span className="text-sm">Só eu vejo (privado)</span>
            </label>
          </div>
        </Section>

        {config.showResults === 'after_reveal' ? (
          <Section title="Revelar resultado" live>
            {config.revealed ? (
              <Button onClick={hideResults} variant="ghost">
                ↩ Esconder resultados de novo
              </Button>
            ) : (
              <Button onClick={reveal} variant="accent">
                ▶ Revelar agora pra audiência
              </Button>
            )}
            <p className="text-[11px] text-ink/55 mt-1">
              <LiveBadge /> Audiência vê na hora.
            </p>
          </Section>
        ) : null}

        <Section title="QR code do telão" live>
          <Check
            label="Mostrar QR lateral"
            checked={config.showQr !== false}
            onChange={(v) => setConfig((c) => ({ ...c, showQr: v }))}
          />
          <Check
            label="QR gigante (tela cheia)"
            checked={config.qrFullscreen === true}
            onChange={(v) => setConfig((c) => ({ ...c, qrFullscreen: v }))}
          />
        </Section>

        <Section title="Zerar votos">
          <Button onClick={reset} variant="ghost">
            🗑 Apagar todos os votos deste slide
          </Button>
        </Section>
      </div>
    </div>
  );
}
