'use client';

import type { Slide } from '@/lib/slides/types';
import type { WordcloudBackground, WordcloudConfig } from '@/hooks/useWordcloudActive';
import { backgroundStyle } from '@/components/telao/WordCloudDisplay';

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
  const cfg = (slide.config ?? {}) as WordcloudConfig;
  const bg = (cfg.background ?? { type: 'none' }) as WordcloudBackground;
  const isLight = (() => {
    if (bg.type === 'color' && bg.value.toUpperCase() === '#FFFFFF') return true;
    if (bg.type === 'color') return false;
    return false;
  })();
  const thumbBgStyle = backgroundStyle(bg) ?? { background: '#0A2540' };
  const textColor = isLight ? '#0A1834' : '#FFFFFF';

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
        <div
          className="aspect-video flex items-center justify-center p-2 text-center"
          style={{ ...thumbBgStyle, color: textColor }}
        >
          <p
            className="font-bold leading-tight line-clamp-3"
            style={{ fontSize: 11, color: textColor }}
          >
            {cfg.question || '(sem pergunta)'}
          </p>
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
