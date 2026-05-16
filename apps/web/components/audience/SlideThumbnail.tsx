'use client';

import type { Slide } from '@/lib/slides/types';

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
          className={`block w-full aspect-video rounded-lg overflow-hidden relative transition ${
            isSelected
              ? 'ring-2 ring-accent shadow-md'
              : 'ring-1 ring-ink/10 hover:ring-ink/25 shadow-sm'
          }`}
        >
          {/* Card estilo Mentimeter — dark navy com ícone + título truncado.
              Não rendeira a nuvem real (caro e pouco informativo nesse tamanho). */}
          <SlideMentiCard slide={slide} />
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
        {/* Linha de meta: AO VIVO (clicável → pausa) + ações em hover */}
        <div className="mt-1 flex items-center justify-between min-h-[18px]">
          {isActive ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeactivate();
              }}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-success/10 text-success text-[10px] font-bold uppercase tracking-wider hover:bg-success/20 transition"
              title="Clique pra pausar"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
              Ao vivo
            </button>
          ) : (
            <span />
          )}
          {/* Ações secundárias inline — só aparecem ao hover */}
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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

function SlideMentiCard({ slide }: { slide: Slide }) {
  const cfg = slide.config as { question?: string } | undefined;
  const question = cfg?.question?.trim() || 'Sem pergunta';

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-3"
      style={{ background: '#1A1F2E' }}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white/10 text-white">
        {iconFor(slide.type)}
      </span>
      <p
        className="text-[10px] font-medium text-white/85 text-center leading-tight line-clamp-2"
        style={{ fontFamily: 'var(--font-wordcloud), Inter, system-ui, sans-serif' }}
      >
        {question}
      </p>
    </div>
  );
}

function iconFor(type: string): React.ReactNode {
  if (type === 'wordcloud') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M12 2c1.1 0 2 .9 2 2 2.2 0 4 1.8 4 4 1.7 0 3 1.3 3 3s-1.3 3-3 3h-1l1 4-4-3H8a4 4 0 01-4-4c-1.1 0-2-.9-2-2s.9-2 2-2a4 4 0 014-4c0-1.1.9-2 2-2z" />
      </svg>
    );
  }
  if (type === 'open_ended') {
    return (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
        <path d="M4 4h16a2 2 0 012 2v10a2 2 0 01-2 2H8l-4 4V6a2 2 0 012-2z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 9h18" />
    </svg>
  );
}
