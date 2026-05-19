'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import {
  BACKGROUND_PRESETS,
  BgImageUploader,
  Check,
  LiveBadge,
  Section,
} from '@/components/audience/SlidePropsPanel';
import {
  ColorInput,
  PresetGroup,
  Slider,
} from '@/components/audience/TelaoConfigControls';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import type { WordcloudBackground } from '@/hooks/useWordcloudActive';
import {
  DEFAULT_COMMENTS_CONFIG,
  type CommentsConfig,
  type Slide,
} from '@/lib/slides/types';
import type {
  TelaoAnimation,
  TelaoShadow,
  TelaoTransitionMode,
} from '@/lib/telao/config';
import { resolveTelaoFont, TELAO_FONTS } from '@/lib/telao/fonts';

type Props = {
  slide: Slide<'comments'>;
  slug: string;
  onChange: (config: CommentsConfig) => void;
  onLiveChange?: ((config: CommentsConfig) => void) | undefined;
};

const DEBOUNCE_MS = 500;

const ANIMATIONS: readonly TelaoAnimation[] = [
  'slide-up',
  'slide-down',
  'slide-left',
  'slide-right',
  'fade',
  'scale',
  'bounce',
];
const ANIMATION_ICON: Record<TelaoAnimation, string> = {
  'slide-up': '↑',
  'slide-down': '↓',
  'slide-left': '←',
  'slide-right': '→',
  fade: '◐',
  scale: '⊕',
  bounce: '↕',
};
const SHADOWS: readonly TelaoShadow[] = ['none', 'subtle', 'medium', 'dramatic'];
const TRANSITIONS: readonly TelaoTransitionMode[] = ['sequential', 'overlap'];

export function CommentsPropsPanel({ slide, slug, onChange, onLiveChange }: Props) {
  const [config, setConfig] = useState<CommentsConfig>({
    ...DEFAULT_COMMENTS_CONFIG,
    ...slide.config,
  });
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNext = useRef(true);
  const [tab, setTab] = useState<'conteudo' | 'design' | 'avancado'>('conteudo');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // CRÍTICO: cancela qualquer autosave PENDENTE de outro slide antes de
    // resetar o local config. Sem isso, o debounce do slide anterior dispara
    // depois e chama updateSlide com o id do slide ATUAL + config do
    // ANTERIOR — sobrescrevendo o slide novo com config errada.
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setConfig({ ...DEFAULT_COMMENTS_CONFIG, ...slide.config });
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

  const obsUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/telao/${slug}?mode=browser_source`;
  }, [slug]);

  const copyObsUrl = async () => {
    if (!obsUrl) return;
    try {
      await navigator.clipboard.writeText(obsUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="flex flex-col gap-3 pb-4">
      {/* Tabs — mesma estrutura do Aberto */}
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
        <Section title="Tipo">
          <div className="relative">
            <select
              className="w-full h-10 rounded-md border border-ink/20 bg-paper text-sm px-3 pr-8 appearance-none cursor-pointer"
              value={slide.type}
              disabled
            >
              <option value="comments">💬 Cards rotativos</option>
            </select>
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink/40 pointer-events-none">
              ▾
            </span>
          </div>
          <p className="text-[11px] text-ink/55">
            Comentários aprovados pelo moderador aparecem um por vez no telão.
          </p>
        </Section>

        <Section title="Título">
          <Check
            label="Mostrar título acima do card"
            checked={config.showTitle === true}
            onChange={(v) => setConfig((c) => ({ ...c, showTitle: v }))}
          />
          {config.showTitle ? (
            <div className="mt-2 space-y-3">
              <Input
                label=""
                id={`title-${slide.id}`}
                value={config.title ?? ''}
                onChange={(e) => setConfig((c) => ({ ...c, title: e.target.value }))}
                maxLength={140}
                placeholder="Ex: O que você achou do evento?"
              />
              <ColorInput
                label="Cor do título"
                value={config.titleColor ?? '#0A2540'}
                onChange={(v) => setConfig((c) => ({ ...c, titleColor: v }))}
              />
            </div>
          ) : null}
          <p className="text-[11px] text-ink/55 mt-1">
            Opcional. Quando ocultado, só o card flutuante aparece — bom pra usar como overlay no OBS.
          </p>
        </Section>

        <Section title="Como funciona">
          <p className="text-[11px] text-ink/60 leading-relaxed">
            Audiência envia comentários pelo link público. Você modera na aba <strong>Comentários</strong> e
            clica em <strong>"Mostrar no telão"</strong> — ele entra na rotação automática deste slide
            pelo tempo configurado em "Avançado".
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

        <Section title="Cor do card">
          <ColorInput
            label="Fundo do card"
            value={config.cardBg}
            onChange={(v) => setConfig((c) => ({ ...c, cardBg: v }))}
          />
          <div className="mt-3">
            <ColorInput
              label="Cor do texto"
              value={config.cardText}
              onChange={(v) => setConfig((c) => ({ ...c, cardText: v }))}
            />
          </div>
        </Section>

        <Section title="Tipografia">
          <FontPicker
            value={config.fontFamily}
            onChange={(v) => setConfig((c) => ({ ...c, fontFamily: v }))}
          />
          <div className="mt-3">
            <Slider
              label="Tamanho da fonte"
              suffix="px"
              min={18}
              max={96}
              value={config.fontSizePx}
              onChange={(v) => setConfig((c) => ({ ...c, fontSizePx: v }))}
            />
          </div>
        </Section>

        <Section title="Forma e estilo">
          <div className="mt-0">
            <Slider
              label="Largura do card"
              suffix="%"
              min={30}
              max={200}
              value={config.widthPct}
              onChange={(v) => setConfig((c) => ({ ...c, widthPct: v }))}
            />
          </div>
          <div className="mt-3">
            <Slider
              label="Cantos arredondados"
              suffix="px"
              min={0}
              max={48}
              value={config.borderRadius}
              onChange={(v) => setConfig((c) => ({ ...c, borderRadius: v }))}
            />
          </div>
          <div className="mt-3">
            <Slider
              label="Desfoque do fundo do card"
              suffix="px"
              min={0}
              max={24}
              value={config.backdropBlur}
              onChange={(v) => setConfig((c) => ({ ...c, backdropBlur: v }))}
            />
          </div>
          <div className="mt-3">
            <PresetGroup
              label="Sombra"
              options={SHADOWS}
              value={config.shadow}
              onChange={(v) => setConfig((c) => ({ ...c, shadow: v }))}
            />
          </div>
        </Section>
      </div>

      {/* AVANÇADO */}
      <div className="space-y-3" hidden={tab !== 'avancado'}>
        <Section title="Rotação">
          <Slider
            label="Tempo de cada card"
            suffix="s"
            min={3}
            max={30}
            value={config.displaySeconds}
            onChange={(v) => setConfig((c) => ({ ...c, displaySeconds: v }))}
          />
          <div className="mt-3">
            <Slider
              label="Cards simultâneos na tela"
              suffix=""
              min={1}
              max={5}
              value={config.maxConcurrent}
              onChange={(v) => setConfig((c) => ({ ...c, maxConcurrent: v }))}
            />
          </div>
          <div className="mt-3">
            <PresetGroup
              label="Modo de transição"
              options={TRANSITIONS}
              value={config.transitionMode}
              onChange={(v) => setConfig((c) => ({ ...c, transitionMode: v }))}
            />
          </div>
          <div className="mt-3">
            <PresetGroup
              label="Animação"
              options={ANIMATIONS}
              value={config.animation}
              onChange={(v) => setConfig((c) => ({ ...c, animation: v }))}
              iconFor={(o) => ANIMATION_ICON[o]}
            />
          </div>
        </Section>

        <Section title="No card" live>
          <Check
            label="Mostrar nome do autor"
            checked={config.showAvatar !== false}
            onChange={(v) => setConfig((c) => ({ ...c, showAvatar: v }))}
          />
          <Check
            label="Mostrar horário"
            checked={config.showTimestamp === true}
            onChange={(v) => setConfig((c) => ({ ...c, showTimestamp: v }))}
          />
          <Check
            label="Mostrar nome do evento"
            checked={config.showEventName === true}
            onChange={(v) => setConfig((c) => ({ ...c, showEventName: v }))}
          />
          <p className="text-[11px] text-ink/55 mt-1">
            <LiveBadge /> Atualiza no telão na hora.
          </p>
        </Section>

        <Section title="QR code do telão" live>
          <Check
            label="Mostrar QR lateral"
            checked={config.showQr === true}
            onChange={(v) => setConfig((c) => ({ ...c, showQr: v }))}
          />
          <Check
            label="QR gigante (tela cheia)"
            checked={config.qrFullscreen === true}
            onChange={(v) => setConfig((c) => ({ ...c, qrFullscreen: v }))}
          />
          <Check
            label="Mostrar link/URL abaixo do QR"
            checked={config.showJoinUrl !== false}
            onChange={(v) => setConfig((c) => ({ ...c, showJoinUrl: v }))}
          />
          <p className="text-[11px] text-ink/55 mt-1">
            QR + URL ficam ocultos automaticamente no modo OBS (transparente).
          </p>
        </Section>

        <Section title="Compartilhar pro OBS">
          <p className="text-[11px] text-ink/60 leading-relaxed">
            Use esse link como <strong>Browser Source</strong> no OBS / vMix / Streamlabs. O fundo
            fica transparente automaticamente — o card flutua sobre a apresentação que você estiver
            transmitindo.
          </p>
          <div className="mt-2">
            <Button onClick={copyObsUrl} variant="ghost">
              {copied ? '✓ Copiado!' : '📋 Copiar URL pro OBS (transparente)'}
            </Button>
          </div>
        </Section>
      </div>
    </div>
  );
}

function FontPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const resolved = resolveTelaoFont(value);
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink/60 mb-2">Fonte</p>
      <div className="grid grid-cols-2 gap-1.5">
        {TELAO_FONTS.map((f) => {
          const selected = resolved === f.value;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => onChange(f.value)}
              className={`h-12 rounded-md border text-left px-3 transition relative ${
                selected
                  ? 'border-accent ring-1 ring-accent/40 bg-accent/[0.04]'
                  : 'border-ink/15 hover:border-accent bg-paper'
              }`}
              title={f.label}
            >
              <span
                className="block text-[15px] leading-tight truncate text-ink"
                style={{ fontFamily: f.value, fontWeight: 600 }}
              >
                {f.label}
              </span>
              <span className="block text-[9px] uppercase tracking-wider text-ink/45 mt-0.5">
                {f.category === 'sans' ? 'Sem serifa' : f.category === 'serif' ? 'Serifa' : 'Display'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
