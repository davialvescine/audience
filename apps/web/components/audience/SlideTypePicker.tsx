'use client';

import { useEffect } from 'react';

import type { SlideType } from '@/lib/slides/types';

type Group = {
  label: string;
  items: Array<{
    type: SlideType | 'placeholder';
    label: string;
    icon: React.ReactNode;
    enabled: boolean;
  }>;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (type: SlideType) => void;
};

const GROUPS: Group[] = [
  {
    label: 'Perguntas interativas',
    items: [
      { type: 'wordcloud', label: 'Nuvem de palavras', icon: <CloudIcon />, enabled: true },
      { type: 'open_ended', label: 'Aberto', icon: <ChatIcon />, enabled: true },
      { type: 'poll', label: 'Múltipla escolha', icon: <BarsIcon />, enabled: false },
      { type: 'rating', label: 'Escalas', icon: <ScaleIcon />, enabled: false },
      { type: 'qa', label: 'Perguntas e respostas', icon: <QnaIcon />, enabled: false },
      { type: 'placeholder', label: 'Classificação', icon: <RankIcon />, enabled: false },
    ],
  },
  {
    label: 'Slides de conteúdo',
    items: [
      { type: 'placeholder', label: 'Texto', icon: <TextIcon />, enabled: false },
      { type: 'placeholder', label: 'Imagem', icon: <ImageIcon />, enabled: false },
      { type: 'placeholder', label: 'Vídeo', icon: <VideoIcon />, enabled: false },
    ],
  },
];

export function SlideTypePicker({ open, onClose, onPick }: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Escolher tipo de slide"
        className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl bg-paper shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 bg-paper flex items-center justify-between px-6 py-4 border-b border-ink/10">
          <h2 className="text-lg font-semibold text-ink">Novo slide</h2>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-md text-ink/55 hover:bg-ink/[0.06] transition"
            aria-label="Fechar"
          >
            ✕
          </button>
        </header>
        <div className="px-6 py-5 space-y-6">
          {GROUPS.map((g) => (
            <section key={g.label}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-ink/55 mb-3">
                {g.label}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {g.items.map((item, idx) => (
                  <button
                    key={`${item.label}-${idx}`}
                    type="button"
                    disabled={!item.enabled}
                    onClick={() => {
                      if (!item.enabled) return;
                      onPick(item.type as SlideType);
                      onClose();
                    }}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition ${
                      item.enabled
                        ? 'hover:bg-accent/10 text-ink'
                        : 'opacity-40 cursor-not-allowed text-ink/60'
                    }`}
                    title={item.enabled ? '' : 'Em breve'}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/15 text-accent shrink-0">
                      {item.icon}
                    </span>
                    <span className="text-sm font-medium truncate">{item.label}</span>
                    {!item.enabled ? (
                      <span className="ml-auto text-[10px] uppercase tracking-wider text-ink/45 shrink-0">
                        Em breve
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function CloudIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M12 4c1.1 0 2 .9 2 2 2.2 0 4 1.8 4 4 1.7 0 3 1.3 3 3s-1.3 3-3 3H6a4 4 0 110-8c0-1.1.9-2 2-2a4 4 0 014-4z" />
    </svg>
  );
}
function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M4 4h16a2 2 0 012 2v10a2 2 0 01-2 2H8l-4 4V6a2 2 0 012-2z" />
    </svg>
  );
}
function BarsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <rect x="4" y="10" width="3" height="10" rx="1" />
      <rect x="10.5" y="6" width="3" height="14" rx="1" />
      <rect x="17" y="13" width="3" height="7" rx="1" />
    </svg>
  );
}
function ScaleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <line x1="3" y1="18" x2="21" y2="18" />
      <circle cx="8" cy="12" r="2" />
      <circle cx="16" cy="8" r="2" />
    </svg>
  );
}
function QnaIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm.5 14h-1v-1h1v1zm1.6-5.6c-.9.6-1.1.9-1.1 1.6h-1.5c0-1.2.4-1.8 1.4-2.5.6-.4.7-.6.7-1 0-.5-.4-.9-1-.9-.7 0-1.1.4-1.1 1.1H9.9c0-1.5 1.1-2.5 2.7-2.5 1.5 0 2.6.8 2.6 2.1 0 .9-.3 1.4-1.1 2z" />
    </svg>
  );
}
function RankIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="14" y2="18" />
    </svg>
  );
}
function TextIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M4 5h16v3h-2V7H13v11h2v2H9v-2h2V7H6v1H4z" />
    </svg>
  );
}
function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="1.5" />
      <path d="M21 16l-5-5-9 9" />
    </svg>
  );
}
function VideoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden>
      <path d="M5 5h10a2 2 0 012 2v3l4-3v10l-4-3v3a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
    </svg>
  );
}
