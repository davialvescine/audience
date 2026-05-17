'use client';

import { useEffect, useRef, useState } from 'react';

import { OpenEndedDisplay } from '@/components/telao/OpenEndedDisplay';
import { WordCloudDisplay } from '@/components/telao/WordCloudDisplay';
import type { WordcloudConfig } from '@/hooks/useWordcloudActive';
import type { OpenEndedConfig, Slide } from '@/lib/slides/types';
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
            isSelected
              ? 'ring-2 ring-accent shadow-md'
              : 'ring-1 ring-ink/10 hover:ring-ink/25 shadow-sm'
          }`}
        >
          {/* Preview real do slide — scale do 1920×1080 pra caber no card.
              Mostra a pergunta + visual exatos do que vai no telão. */}
          <ScaledSlidePreview slide={slide} />
          {/* Play overlay — hover em slides NÃO ativos. Clique = ativa. */}
          {!isActive ? (
            <span
              className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-ink/35 transition-opacity"
              role="button"
              aria-label="Ativar slide no telão"
              onClick={(e) => {
                e.stopPropagation();
                onActivate();
              }}
            >
              <span className="h-9 w-9 rounded-full bg-paper text-primary flex items-center justify-center text-base shadow-lg">
                ▶
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
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-3xl text-ink/40">
            {slide.type}
          </div>
        )}
      </div>
    </div>
  );
}
