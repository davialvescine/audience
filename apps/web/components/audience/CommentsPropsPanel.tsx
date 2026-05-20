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

// ANIMATIONS removido — TelaoClient agora usa fade puro fixo (sem
// slide/scale/bounce) pra eliminar layout shift. A propriedade
// config.animation continua sendo persistida pra compat, mas é
// ignorada no render. Slider removido do painel.
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
    // CRÍTICO: só re-sincroniza quando o SLIDE muda (slide.id diferente).
    // Antes dependia também de JSON.stringify(slide.config) — toda vez
    // que o autosave salvava no DB, o realtime devolvia o config novo,
    // o useEffect disparava e SOBRESCREVIA o config local. Se o usuário
    // estava digitando ("Palestr...") durante o autosave debounce de
    // 500ms, letras eram perdidas porque o input voltava pro valor que
    // estava no DB no momento do save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slide.id]);

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
              <div>
                <p className="text-xs uppercase tracking-wide text-ink/60 mb-2">
                  Fonte do título
                </p>
                <p className="text-[11px] text-ink/55 mb-1.5">
                  Vazio = mesma fonte do card.
                </p>
                <FontPicker
                  value={config.titleFontFamily ?? ''}
                  onChange={(v) => setConfig((c) => ({ ...c, titleFontFamily: v }))}
                />
              </div>
              <Slider
                label="Tamanho do título"
                suffix="px"
                min={24}
                max={180}
                value={config.titleSizePx ?? Math.round(config.fontSizePx * 1.4)}
                onChange={(v) => setConfig((c) => ({ ...c, titleSizePx: v }))}
              />
              <ColorInput
                label="Cor do título"
                value={config.titleColor ?? '#0A2540'}
                onChange={(v) => setConfig((c) => ({ ...c, titleColor: v }))}
              />
              <PresetGroup
                label="Sombra do título"
                options={['none', 'subtle', 'medium', 'strong'] as const}
                value={config.titleShadow ?? 'none'}
                onChange={(v) => setConfig((c) => ({ ...c, titleShadow: v }))}
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
            clica em <strong>"Fixar no telão"</strong> — ele entra na rotação automática deste slide
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

          {/* Cor sólida do fundo do telão com hex code + opacidade.
              Quando bg.type !== 'color', usa fallback transparente. */}
          <div className="mt-3">
            <ColorWithOpacity
              label="Cor sólida do fundo"
              value={bg.type === 'color' ? bg.value : 'rgba(255, 255, 255, 1)'}
              onChange={(v) => setBg({ type: 'color', value: v })}
            />
          </div>
        </Section>

        <Section title="Cor do card">
          <ColorWithOpacity
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
              max={240}
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
              label="Altura do card"
              suffix="px"
              min={120}
              max={1080}
              value={config.heightPx > 0 ? config.heightPx : 240}
              onChange={(v) => setConfig((c) => ({ ...c, heightPx: v }))}
            />
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => setConfig((c) => ({ ...c, heightPx: 240 }))}
                className="text-[11px] text-ink/65 hover:text-primary hover:underline"
              >
                Pequeno
              </button>
              <span className="text-ink/30">·</span>
              <button
                type="button"
                onClick={() => setConfig((c) => ({ ...c, heightPx: 480 }))}
                className="text-[11px] text-ink/65 hover:text-primary hover:underline"
              >
                Médio
              </button>
              <span className="text-ink/30">·</span>
              <button
                type="button"
                onClick={() => setConfig((c) => ({ ...c, heightPx: 720 }))}
                className="text-[11px] text-ink/65 hover:text-primary hover:underline"
              >
                Grande
              </button>
              <span className="text-ink/30">·</span>
              <button
                type="button"
                onClick={() => setConfig((c) => ({ ...c, heightPx: 1080 }))}
                className="text-[11px] text-ink/65 hover:text-primary hover:underline"
              >
                Tela cheia
              </button>
            </div>
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

/** Parseia uma cor CSS (#rgb, #rrggbb, rgb(), rgba()) em { hex, alpha }. */
function parseColor(input: string): { hex: string; alpha: number } {
  const v = (input ?? '').trim();
  // rgba(r, g, b, a)
  const rgba = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i);
  if (rgba) {
    const [, r, g, b, a] = rgba;
    const hex = `#${[r, g, b]
      .map((n) => Number(n).toString(16).padStart(2, '0'))
      .join('')}`;
    return { hex, alpha: a !== undefined ? Math.max(0, Math.min(1, Number(a))) : 1 };
  }
  // #rgb
  const short = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (short) {
    return {
      hex: `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`,
      alpha: 1,
    };
  }
  // #rrggbb ou #rrggbbaa
  const long = v.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (long) {
    const hex = `#${long[1]}`;
    const alpha = long[2] !== undefined ? parseInt(long[2]!, 16) / 255 : 1;
    return { hex, alpha };
  }
  return { hex: '#0A2540', alpha: 1 };
}

function composeColor(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  if (alpha >= 1) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
}

function ColorWithOpacity({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { hex, alpha } = parseColor(value);
  const setHex = (h: string) => onChange(composeColor(h, alpha));
  const setAlpha = (a: number) => onChange(composeColor(hex, a));
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-ink/60 mb-2">{label}</p>
      <div className="flex gap-2 items-center">
        <input
          type="color"
          value={hex}
          onChange={(e) => setHex(e.target.value)}
          className="h-10 w-12 rounded-md border border-ink/20 cursor-pointer shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 h-10 px-2 rounded-md border border-ink/20 bg-paper">
            <span
              className="h-6 w-6 rounded border border-ink/15 shrink-0"
              style={{ background: value }}
              aria-hidden
            />
            <input
              type="text"
              value={hex.toUpperCase()}
              onChange={(e) => {
                const v = e.target.value.trim();
                if (/^#[0-9a-f]{6}$/i.test(v)) setHex(v);
              }}
              className="flex-1 min-w-0 bg-transparent text-ink text-xs font-mono uppercase outline-none"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard?.writeText(hex.toUpperCase());
              }}
              className="text-[10px] text-ink/50 hover:text-ink transition shrink-0"
              title="Copiar código"
            >
              ⧉
            </button>
          </div>
        </div>
      </div>
      <div className="mt-3">
        <label className="text-xs uppercase tracking-wide text-ink/60 flex justify-between mb-1.5">
          <span>Opacidade</span>
          <span className="text-ink font-medium tabular-nums">{Math.round(alpha * 100)}%</span>
        </label>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(alpha * 100)}
          onChange={(e) => setAlpha(Number(e.target.value) / 100)}
          className="w-full"
        />
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
