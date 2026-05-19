'use client';

import { useEffect, useRef, useState } from 'react';

import { OpenEndedDisplay } from '@/components/telao/OpenEndedDisplay';
import { PollDisplay } from '@/components/telao/PollDisplay';
import { backgroundStyle, WordCloudDisplay } from '@/components/telao/WordCloudDisplay';
import type { WordcloudConfig } from '@/hooks/useWordcloudActive';
import type { CommentsConfig, OpenEndedConfig, PollConfig, Slide } from '@/lib/slides/types';
import { customPositionStyles, positionStyles, shadowStyle } from '@/lib/telao/config';
import { resolveTelaoFont } from '@/lib/telao/fonts';
import type { WordEntry } from '@/lib/wordcloud/types';

const SAMPLE_WORDS: WordEntry[] = [
  { text: 'criativo', count: 5 },
  { text: 'líder', count: 4 },
  { text: 'foco', count: 3 },
  { text: 'rápido', count: 2 },
];

const SAMPLE_RESPONSES = [
  { id: 's1', text: 'Adoro a energia!', authorName: null, voteCount: 0, createdAt: '' },
  { id: 's2', text: 'Muito inspirador.', authorName: null, voteCount: 0, createdAt: '' },
];

type ChannelLike = Parameters<typeof WordCloudDisplay>[0]['channel'];

function makeNoop(): ChannelLike {
  const self: ChannelLike = {
    on() {
      return self;
    },
    subscribe() {
      return self;
    },
    unsubscribe() {},
  };
  return self;
}

type Props = {
  slide: Slide;
  index: number;
  total: number;
  isSelected: boolean;
  isActive: boolean;
  onSelect: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
};

export function SlideThumbnail({
  slide,
  index,
  total,
  isSelected,
  isActive,
  onSelect,
  onActivate,
  onDeactivate,
  onDelete,
  onMove,
}: Props) {
  return (
    <div className="group relative flex items-start gap-2">
      {/* Número fora do card, à esquerda */}
      <span className="font-mono text-[11px] font-semibold text-ink/45 tabular-nums pt-1 w-6 text-right shrink-0">
        {String(index + 1).padStart(2, '0')}
      </span>
      <div className="flex-1 min-w-0">
        <button
          type="button"
          onClick={onSelect}
          className={`block w-full aspect-video rounded-none overflow-hidden relative transition ${
            isActive
              ? 'ring-2 ring-success shadow-md shadow-success/20'
              : isSelected
                ? 'ring-2 ring-accent shadow-md'
                : 'ring-1 ring-ink/10 hover:ring-ink/25 shadow-sm'
          }`}
        >
          {/* Preview real do slide — scale do 1920×1080 pra caber no card.
              Mostra a pergunta + visual exatos do que vai no telão. */}
          <ScaledSlidePreview slide={slide} />
          {/* Badge "AO VIVO" permanente no slide ativo — operador vê de relance
              qual está sendo exibido sem precisar passar mouse. */}
          {isActive ? (
            <span className="absolute top-1 left-1 z-10 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-success text-paper text-[9px] font-bold uppercase tracking-wide shadow-sm">
              <span className="h-1 w-1 rounded-full bg-paper animate-pulse" />
              Ao vivo
            </span>
          ) : null}
          {/* Hover hint pra slides NÃO ativos: indica que clique vai ao vivo. */}
          {!isActive ? (
            <span
              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-ink/25 transition-opacity pointer-events-none"
              aria-hidden
            >
              <span className="text-paper text-[10px] font-bold uppercase tracking-wide bg-primary/80 px-2 py-1 rounded shadow-lg">
                ▶ Exibir
              </span>
            </span>
          ) : null}
        </button>
        {/* Ações secundárias inline — só aparecem ao hover. O indicador AO VIVO
            mora no top bar da aba Slides (não precisa duplicar aqui). */}
        <div className="mt-1 flex items-center justify-end min-h-[18px]">
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            {isActive ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeactivate();
                }}
                className="h-5 px-1.5 text-[10px] rounded text-ink/55 hover:bg-ink/[0.08] transition"
                title="Pausar slide"
                aria-label="Pausar slide"
              >
                ⏸
              </button>
            ) : null}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMove(-1);
              }}
              disabled={index === 0}
              className="h-5 w-5 text-[10px] rounded text-ink/55 hover:bg-ink/[0.08] disabled:opacity-25 disabled:cursor-not-allowed transition"
              aria-label="Mover pra cima"
              title="Mover pra cima"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onMove(1);
              }}
              disabled={index === total - 1}
              className="h-5 w-5 text-[10px] rounded text-ink/55 hover:bg-ink/[0.08] disabled:opacity-25 disabled:cursor-not-allowed transition"
              aria-label="Mover pra baixo"
              title="Mover pra baixo"
            >
              ↓
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="h-5 w-5 text-[10px] rounded text-ink/55 hover:bg-danger/10 hover:text-danger transition"
              aria-label="Excluir slide"
              title="Excluir slide"
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScaledSlidePreview({ slide }: { slide: Slide }) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const sx = el.clientWidth / 1920;
      const sy = el.clientHeight / 1080;
      setScale(Math.max(0.01, Math.min(sx, sy)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className="absolute inset-0 overflow-hidden bg-ink/5">
      <div
        style={{
          width: 1920,
          height: 1080,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      >
        {slide.type === 'wordcloud' ? (
          <WordCloudDisplay
            eventId={slide.event_id}
            config={slide.config as WordcloudConfig}
            initialEntries={SAMPLE_WORDS}
            channel={makeNoop()}
            showBackground
          />
        ) : slide.type === 'open_ended' ? (
          <OpenEndedDisplay
            eventId={slide.event_id}
            slideId={slide.id}
            config={slide.config as OpenEndedConfig}
            initialResponses={SAMPLE_RESPONSES}
            channel={makeNoop()}
            showBackground
          />
        ) : slide.type === 'comments' ? (
          <CommentsThumb config={slide.config as CommentsConfig} />
        ) : slide.type === 'poll' ? (
          <PollThumb config={slide.config as PollConfig} slideId={slide.id} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-3xl text-ink/40">
            {slide.type}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Mini-preview do slide `comments` — card de exemplo posicionado conforme
 * config.posXPct/posYPct (ou position preset).
 */
function CommentsThumb({ config }: { config: CommentsConfig }) {
  const hasCustomPos =
    typeof config.posXPct === 'number' && typeof config.posYPct === 'number';
  const positionStyle = hasCustomPos
    ? customPositionStyles(config.posXPct as number, config.posYPct as number)
    : positionStyles(config.position);
  const wrapBg = backgroundStyle(config.background ?? { type: 'none' });
  return (
    <div className="absolute inset-0" style={wrapBg}>
      {config.showTitle && config.title ? (
        <h1
          style={{
            position: 'fixed',
            top: '4%',
            left: '50%',
            transform: 'translateX(-50%)',
            color: config.cardText,
            fontFamily: resolveTelaoFont(config.fontFamily),
            fontSize: `${Math.round(config.fontSizePx * 1.4)}px`,
            fontWeight: 700,
            textAlign: 'center',
            margin: 0,
          }}
        >
          {config.title}
        </h1>
      ) : null}
      <div
        style={{
          ...positionStyle,
          width: `${config.widthPct}%`,
          fontFamily: resolveTelaoFont(config.fontFamily),
        }}
      >
        <div
          style={{
            background: config.cardBg,
            color: config.cardText,
            borderRadius: `${config.borderRadius}px`,
            boxShadow: shadowStyle(config.shadow),
            padding: `${Math.round(config.fontSizePx * 0.6)}px ${Math.round(config.fontSizePx * 0.85)}px`,
            fontSize: `${config.fontSizePx}px`,
            lineHeight: 1.3,
          }}
        >
          <div
            style={{
              fontSize: `${Math.round(config.fontSizePx * 0.55)}px`,
              opacity: 0.75,
              fontWeight: 600,
              marginBottom: '0.25em',
            }}
          >
            Convidado
          </div>
          <div style={{ fontWeight: 500 }}>Que evento incrível!</div>
        </div>
      </div>
    </div>
  );
}


function PollThumb({ config, slideId }: { config: PollConfig; slideId: string }) {
  const sampleCounts = config.options.map((_, idx) => {
    if (config.correctOption != null && idx === config.correctOption) return 12;
    return Math.max(2, 8 - idx * 2);
  });
  type AnyChan = Parameters<typeof PollDisplay>[0]['channel'];
  const noop: AnyChan = {
    on() { return noop; },
    subscribe() { return noop; },
    unsubscribe() {},
  };
  return (
    <PollDisplay
      slug="preview"
      slideId={slideId}
      config={config}
      initialCounts={sampleCounts}
      channel={noop}
      showBackground
    />
  );
}
