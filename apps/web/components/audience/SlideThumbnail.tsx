'use client';

import { useEffect, useRef, useState } from 'react';

import { WordCloudDisplay } from '@/components/telao/WordCloudDisplay';
import type { WordcloudConfig } from '@/hooks/useWordcloudActive';
import type { Slide } from '@/lib/slides/types';
import type { WordEntry } from '@/lib/wordcloud/types';

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

// Sample mais leve do que SlideCanvas pra layout rápido em N thumbnails.
const SAMPLE_ENTRIES: WordEntry[] = [
  { text: 'criativo', count: 5 },
  { text: 'líder', count: 4 },
  { text: 'foco', count: 3 },
  { text: 'rápido', count: 2 },
];

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
    <div className="group relative">
      <button
        type="button"
        onClick={onSelect}
        className={`block w-full text-left rounded-md overflow-hidden border transition ${
          isSelected ? 'border-accent ring-2 ring-accent/40' : 'border-ink/15 hover:border-ink/30'
        }`}
      >
        <div className="flex items-center justify-between px-2 py-1 bg-ink/[0.04] text-[10px]">
          <span className="font-mono text-ink/60">#{index + 1}</span>
          {isActive ? (
            <span className="flex items-center gap-1 text-success font-bold">
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              AO VIVO
            </span>
          ) : null}
        </div>
        <div className="relative aspect-video bg-ink/5">
          {slide.type === 'wordcloud' ? (
            <ScaledSlidePreview slide={slide} />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-[10px] text-ink/40">
              {slide.type}
            </div>
          )}
        </div>
      </button>
      <div className="flex gap-1 mt-1">
        {isActive ? (
          <button
            type="button"
            onClick={onDeactivate}
            className="flex-1 h-6 text-[10px] rounded bg-success text-paper font-bold"
          >
            ⏸ Pausar
          </button>
        ) : (
          <button
            type="button"
            onClick={onActivate}
            className="flex-1 h-6 text-[10px] rounded bg-primary text-paper font-bold hover:bg-primary-deep"
          >
            ▶ Ativar
          </button>
        )}
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          className="h-6 w-6 text-[10px] rounded border border-ink/20 disabled:opacity-30"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          className="h-6 w-6 text-[10px] rounded border border-ink/20 disabled:opacity-30"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="h-6 w-6 text-[10px] rounded text-danger hover:bg-danger/10"
          aria-label="Excluir slide"
        >
          ✕
        </button>
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
    <div ref={ref} className="absolute inset-0 overflow-hidden">
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
        <WordCloudDisplay
          eventId={slide.event_id}
          config={slide.config as WordcloudConfig}
          initialEntries={SAMPLE_ENTRIES}
          channel={makeNoopChannel()}
          showBackground
        />
      </div>
    </div>
  );
}

type ChannelLike = Parameters<typeof WordCloudDisplay>[0]['channel'];

function makeNoopChannel(): ChannelLike {
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
