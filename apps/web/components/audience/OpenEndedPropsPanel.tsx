'use client';

import { useEffect, useRef, useState } from 'react';

import {
  BACKGROUND_PRESETS,
  BgImageUploader,
  Check,
  LiveBadge,
  Radio,
  Section,
} from '@/components/audience/SlidePropsPanel';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { WordcloudBackground } from '@/hooks/useWordcloudActive';
import type { OpenEndedConfig, Slide } from '@/lib/slides/types';
import { resetOpenEndedSlide } from '@/server-actions/openEnded';

type Props = {
  slide: Slide<'open_ended'>;
  onChange: (config: OpenEndedConfig) => void;
  onLiveChange?: ((config: OpenEndedConfig) => void) | undefined;
  onApplyToAll?: (() => void) | undefined;
};

const DEBOUNCE_MS = 500;

export function OpenEndedPropsPanel({ slide, onChange, onLiveChange, onApplyToAll }: Props) {
  const [config, setConfig] = useState<OpenEndedConfig>(slide.config);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNext = useRef(true);
  const [tab, setTab] = useState<'conteudo' | 'design' | 'avancado'>('conteudo');

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

  const setBg = (bg: WordcloudBackground) => setConfig((c) => ({ ...c, background: bg }));
  const bg = (config.background ?? { type: 'none' }) as WordcloudBackground;

  return (
    <div className="flex flex-col gap-3 pb-4">
      {/* Tabs — mesma estrutura que a nuvem de palavras */}
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
        <Section title="Tipo da pergunta">
          <div className="relative">
            <select
              className="w-full h-10 rounded-md border border-ink/20 bg-paper text-sm px-3 pr-8 appearance-none cursor-pointer"
              value={slide.type}
              disabled
            >
              <option value="open_ended">💬 Aberto</option>
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 pointer-events-none">
              ▾
            </span>
          </div>
          <p className="text-[11px] text-ink/55">
            Audiência envia resposta curta. Aparece em cards no telão.
          </p>
        </Section>

        <Section title="Pergunta">
          <Input
            label=""
            id={`q-${slide.id}`}
            value={config.question}
            onChange={(e) => setConfig((c) => ({ ...c, question: e.target.value }))}
            maxLength={140}
            placeholder="O que você quer perguntar?"
          />
        </Section>

        <Section title="Configurações de resposta">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-ink">Número de respostas</span>
            <select
              value={String(config.numberOfResponses)}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  numberOfResponses:
                    e.target.value === 'unlimited'
                      ? 'unlimited'
                      : (parseInt(e.target.value, 10) as 1 | 2 | 3 | 4 | 5),
                }))
              }
              className="h-9 rounded-md border border-ink/20 bg-paper text-sm px-2"
            >
              <option value="unlimited">Ilimitado</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-ink">Tamanho máximo</span>
            <input
              type="number"
              min={20}
              max={500}
              value={config.maxLength}
              onChange={(e) =>
                setConfig((c) => ({ ...c, maxLength: parseInt(e.target.value, 10) || 150 }))
              }
              className="w-20 h-9 rounded-md border border-ink/20 bg-paper text-sm px-2 tabular-nums"
            />
          </div>
          <Check
            label="Pedir nome do participante"
            checked={config.askForName === true}
            onChange={(v) => setConfig((c) => ({ ...c, askForName: v }))}
          />
          <Check
            label="Audiência pode curtir respostas"
            checked={config.allowVoting === true}
            onChange={(v) => setConfig((c) => ({ ...c, allowVoting: v }))}
          />
          <Check
            label="Auto-scroll pra resposta mais nova"
            checked={config.autoScroll !== false}
            onChange={(v) => setConfig((c) => ({ ...c, autoScroll: v }))}
          />
        </Section>

        <Section title="Mostrar respostas" live>
          <Radio
            name="showResponses"
            value="instant"
            current={config.showResponsesMode ?? 'instant'}
            onChange={(v) => setConfig((c) => ({ ...c, showResponsesMode: v }))}
            label="Imediatamente"
            recommended
          />
          <Radio
            name="showResponses"
            value="on_click"
            current={config.showResponsesMode ?? 'instant'}
            onChange={(v) => setConfig((c) => ({ ...c, showResponsesMode: v }))}
            label="Só quando eu liberar"
          />
          <Radio
            name="showResponses"
            value="private"
            current={config.showResponsesMode ?? 'instant'}
            onChange={(v) => setConfig((c) => ({ ...c, showResponsesMode: v }))}
            label="Privadas (só eu vejo)"
          />
        </Section>
      </div>

      {/* DESIGN */}
      <div className="space-y-3" hidden={tab !== 'design'}>
        <Section title="Design">
          <p className="text-[11px] uppercase font-bold text-ink/55 mb-1">Plano de fundo</p>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              onClick={() => setBg({ type: 'none' })}
              className={`h-12 rounded-md border text-[10px] font-medium overflow-hidden relative ${
                bg.type === 'none' ? 'border-accent ring-1 ring-accent/40' : 'border-ink/15 hover:border-accent'
              }`}
              style={{
                backgroundImage:
                  'linear-gradient(45deg, #ddd 25%, transparent 25%), linear-gradient(-45deg, #ddd 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ddd 75%), linear-gradient(-45deg, transparent 75%, #ddd 75%)',
                backgroundSize: '8px 8px',
                backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
              }}
              title="Sem fundo (transparente)"
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
            {bg.type === 'gradient' ? (
              <>
                <input
                  type="color"
                  value={bg.from}
                  onChange={(e) =>
                    setBg({ type: 'gradient', from: e.target.value, to: bg.to })
                  }
                  className="h-9 w-9 rounded cursor-pointer"
                  title="Gradiente cor 1"
                />
                <input
                  type="color"
                  value={bg.to}
                  onChange={(e) =>
                    setBg({ type: 'gradient', from: bg.from, to: e.target.value })
                  }
                  className="h-9 w-9 rounded cursor-pointer"
                  title="Gradiente cor 2"
                />
              </>
            ) : null}
            <BgImageUploader
              eventId={slide.event_id}
              current={bg.type === 'image' ? bg.url : null}
              onUploaded={(url) =>
                setBg({ type: 'image', url, fit: 'cover', opacity: 1, blurPx: 0 })
              }
              onClear={() => setBg({ type: 'color', value: '#FFFFFF' })}
              label={bg.type === 'image' ? 'Trocar imagem' : 'Subir imagem 16:9'}
            />
          </div>

          {bg.type === 'image' ? (
            <div className="mt-2 space-y-2">
              <img
                src={bg.url}
                alt=""
                className="w-full aspect-video object-cover rounded border border-ink/15"
                style={{ opacity: bg.opacity ?? 1 }}
              />
              <label className="block text-[11px] text-ink/55">
                Opacidade {Math.round((bg.opacity ?? 1) * 100)}%
                <input
                  type="range"
                  min={0.2}
                  max={1}
                  step={0.05}
                  value={bg.opacity ?? 1}
                  onChange={(e) => setBg({ ...bg, opacity: Number(e.target.value) })}
                  className="w-full"
                />
              </label>
              <label className="block text-[11px] text-ink/55">
                Desfoque {bg.blurPx ?? 0}px
                <input
                  type="range"
                  min={0}
                  max={20}
                  step={1}
                  value={bg.blurPx ?? 0}
                  onChange={(e) => setBg({ ...bg, blurPx: Number(e.target.value) })}
                  className="w-full"
                />
              </label>
            </div>
          ) : null}

          <p className="text-[11px] uppercase font-bold text-ink/55 mt-3 mb-1">Cor do texto</p>
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                setConfig((c) => {
                  const { textColorOverride: _drop, ...rest } = c;
                  void _drop;
                  return rest;
                })
              }
              className={`h-9 px-2 text-xs rounded border ${
                config.textColorOverride === undefined
                  ? 'border-accent bg-accent/10 text-accent font-medium'
                  : 'border-ink/15 text-ink/70 hover:bg-ink/5'
              }`}
            >
              Auto
            </button>
            <input
              type="color"
              value={config.textColorOverride ?? '#000000'}
              onChange={(e) =>
                setConfig((c) => ({ ...c, textColorOverride: e.target.value }))
              }
              className="h-9 w-9 rounded cursor-pointer"
              aria-label="Cor do texto"
            />
          </div>

          <p className="text-[11px] uppercase font-bold text-ink/55 mt-3 mb-1">
            Imagem de conteúdo
          </p>
          <BgImageUploader
            eventId={slide.event_id}
            current={config.contentImageUrl ?? null}
            onUploaded={(url) => setConfig((c) => ({ ...c, contentImageUrl: url }))}
            onClear={() =>
              setConfig((c) => {
                const { contentImageUrl: _drop, ...rest } = c;
                void _drop;
                return rest;
              })
            }
            label={config.contentImageUrl ? 'Trocar' : '+ Subir imagem'}
          />
          {config.contentImageUrl ? (
            <img
              src={config.contentImageUrl}
              alt=""
              className="mt-2 w-full max-h-32 object-contain rounded border border-ink/15"
            />
          ) : null}
        </Section>
      </div>

      {/* AVANÇADO */}
      <div className="space-y-3" hidden={tab !== 'avancado'}>
        <Section title="QR code do telão" live>
          <Check
            label="QR code visível enquanto apresenta"
            checked={config.showQr !== false}
            onChange={(v) => setConfig((c) => ({ ...c, showQr: v }))}
          />
          <p className="text-xs text-ink/55 mt-1">
            Card lateral com QR + URL. <LiveBadge /> Afeta o telão na hora.
          </p>
          <div className="flex items-center justify-between gap-3 mt-3">
            <span className="text-sm text-ink">Mostrar como</span>
            <select
              value={config.joinInfoType ?? 'qr_and_url'}
              onChange={(e) =>
                setConfig((c) => ({
                  ...c,
                  joinInfoType: e.target.value as 'qr' | 'url' | 'code' | 'qr_and_url',
                }))
              }
              className="h-9 rounded-md border border-ink/20 bg-paper text-sm px-2"
            >
              <option value="qr_and_url">QR + URL</option>
              <option value="qr">Apenas QR</option>
              <option value="url">Apenas URL</option>
              <option value="code">Apenas código</option>
            </select>
          </div>
        </Section>

        <Section title="No telão" live>
          <Check
            label="Contador de respostas"
            checked={config.showTotal !== false}
            onChange={(v) => setConfig((c) => ({ ...c, showTotal: v }))}
          />
          <Check
            label="QR gigante (tela cheia) — pra audiência escanear de longe"
            checked={config.qrFullscreen === true}
            onChange={(v) => setConfig((c) => ({ ...c, qrFullscreen: v }))}
          />
        </Section>

        <div className="rounded-md border border-ink/10 bg-paper p-3 flex flex-col gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setConfig((c) => {
                const { textColorOverride: _drop, ...rest } = c;
                void _drop;
                return { ...rest, background: { type: 'color', value: '#FFFFFF' } };
              });
            }}
            className="justify-start"
          >
            ⚪ Voltar pro tema branco (padrão)
          </Button>
          {onApplyToAll ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (window.confirm('Aplicar essas configurações a todos os outros slides?')) {
                  onApplyToAll();
                }
              }}
              className="justify-start"
            >
              ↕ Aplicar a todos os slides
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (
                window.confirm(
                  'Zerar todas as respostas deste slide? Não afeta outros slides.',
                )
              ) {
                void resetOpenEndedSlide(slide.id);
              }
            }}
            className="justify-start text-danger"
          >
            🔄 Resetar respostas deste slide
          </Button>
        </div>
      </div>
    </div>
  );
}
