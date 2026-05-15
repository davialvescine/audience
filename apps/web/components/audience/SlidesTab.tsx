'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { ShareCard } from '@/components/audience/ShareCard';
import { WordcloudSlideEditor } from '@/components/audience/WordcloudSlideEditor';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useSlides } from '@/hooks/useSlides';
import { useTauri } from '@/hooks/useTauri';
import type { WordcloudConfig } from '@/hooks/useWordcloudActive';
import { getSupabaseRealtimeClient } from '@/lib/supabase/browser';
import type { Slide } from '@/lib/slides/types';
import {
  createSlide,
  deleteSlide,
  reorderSlides,
  setActiveSlide,
  updateSlide,
} from '@/server-actions/slides';

const DEFAULT_WORDCLOUD_CONFIG: WordcloudConfig = {
  question: 'Em uma palavra, o que você espera?',
  maxWordsPerSubmission: 1,
  filterStopwords: true,
  filterProfanity: true,
  palette: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3', '#A8E6CF'],
  showTotal: true,
};

type Props = {
  eventId: string;
  slug: string;
  publicUrl: string;
  telaoUrl: string;
  initialSlides: Slide[];
  initialActiveSlideId: string | null;
};

type ChannelLike = NonNullable<Parameters<typeof useSlides>[1]['channel']>;

export function SlidesTab({
  eventId,
  slug,
  publicUrl,
  telaoUrl,
  initialSlides,
  initialActiveSlideId,
}: Props) {
  const [channel, setChannel] = useState<ChannelLike | undefined>(undefined);
  const [activeId, setActiveId] = useState<string | null>(initialActiveSlideId);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialActiveSlideId ?? initialSlides[0]?.id ?? null,
  );
  const [creating, startCreate] = useTransition();
  const { isTauri, invoke } = useTauri();

  useEffect(() => {
    const rt = getSupabaseRealtimeClient();
    const ch = rt.channel(`admin:${eventId}:slides:${Date.now()}`) as unknown as ChannelLike;
    setChannel(ch);
    return () => {
      ch?.unsubscribe();
    };
  }, [eventId]);

  const { slides } = useSlides(eventId, { initialSlides, channel });
  const selected = useMemo(
    () => slides.find((s) => s.id === selectedId) ?? slides[0] ?? null,
    [slides, selectedId],
  );

  // Pickup active_slide_id changes via short polling — Realtime on events is
  // already feeding TelaoWordcloudSwitcher; here we just need accurate UI state.
  // For simplicity we trust whatever the user did locally + revalidate on action success.

  const onCreate = () => {
    startCreate(async () => {
      const r = await createSlide(eventId, 'wordcloud', { ...DEFAULT_WORDCLOUD_CONFIG });
      if (r.ok) {
        setSelectedId(r.data.id);
      }
    });
  };

  const onDelete = async (slideId: string) => {
    if (!window.confirm('Excluir este slide? Vai apagar as palavras enviadas nele.')) return;
    const r = await deleteSlide(slideId);
    if (r.ok && selectedId === slideId) {
      setSelectedId(slides.find((s) => s.id !== slideId)?.id ?? null);
    }
    if (r.ok && activeId === slideId) {
      setActiveId(null);
    }
  };

  const onActivate = async (slideId: string | null) => {
    setActiveId(slideId);
    await setActiveSlide(eventId, slideId);
  };

  const onSlideConfigChange = async (slideId: string, config: WordcloudConfig) => {
    await updateSlide(slideId, config as unknown as Record<string, unknown>);
  };

  const onMove = async (slideId: string, dir: -1 | 1) => {
    const idx = slides.findIndex((s) => s.id === slideId);
    if (idx < 0) return;
    const swapWith = idx + dir;
    if (swapWith < 0 || swapWith >= slides.length) return;
    const reordered = [...slides];
    const a = reordered[idx]!;
    const b = reordered[swapWith]!;
    reordered[idx] = b;
    reordered[swapWith] = a;
    await reorderSlides(
      eventId,
      reordered.map((s) => s.id),
    );
  };

  const openTelao = () => {
    const url = `${telaoUrl}?mode=fullscreen&fullscreen=1`;
    if (isTauri && invoke) {
      void invoke('open_telao_window', { slug, mode: 'fullscreen' });
    } else {
      window.open(url, '_blank', 'noopener');
    }
  };

  return (
    <div className="space-y-4">
      <ShareCard publicUrl={publicUrl} />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg text-ink">Apresentação</h3>
            <p className="text-sm text-ink/60">
              Monte uma sequência de slides. Cada um é uma pergunta independente; o telão troca
              de slide na hora que você ativa.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={onCreate} loading={creating} variant="accent">
              + Novo slide de nuvem
            </Button>
            <Button variant="ghost" onClick={openTelao}>
              Abrir telão ↗
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-[320px_1fr] gap-4">
        {/* Sidebar com lista */}
        <div className="space-y-2">
          {slides.length === 0 ? (
            <Card>
              <p className="text-sm text-ink/60">
                Nenhum slide ainda. Clique em <strong>Novo slide</strong> pra começar.
              </p>
            </Card>
          ) : (
            slides.map((slide, idx) => (
              <SlideCard
                key={slide.id}
                slide={slide}
                index={idx}
                total={slides.length}
                isSelected={selected?.id === slide.id}
                isActive={activeId === slide.id}
                onClick={() => setSelectedId(slide.id)}
                onActivate={() => onActivate(slide.id)}
                onDeactivate={() => onActivate(null)}
                onDelete={() => onDelete(slide.id)}
                onMove={(dir) => onMove(slide.id, dir)}
              />
            ))
          )}
        </div>

        {/* Editor à direita */}
        <div>
          {selected ? (
            selected.type === 'wordcloud' ? (
              <WordcloudSlideEditor
                key={selected.id}
                slide={selected}
                slug={slug}
                telaoUrl={telaoUrl}
                onChange={(cfg) => onSlideConfigChange(selected.id, cfg)}
              />
            ) : (
              <Card>
                <p className="text-sm text-ink/60">
                  Editor pro tipo <code>{selected.type}</code> ainda não foi feito.
                </p>
              </Card>
            )
          ) : (
            <Card>
              <p className="text-sm text-ink/60 text-center py-10">
                Crie ou selecione um slide pra começar a editar.
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function SlideCard({
  slide,
  index,
  total,
  isSelected,
  isActive,
  onClick,
  onActivate,
  onDeactivate,
  onDelete,
  onMove,
}: {
  slide: Slide;
  index: number;
  total: number;
  isSelected: boolean;
  isActive: boolean;
  onClick: () => void;
  onActivate: () => void;
  onDeactivate: () => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const question = (slide.config as { question?: string } | null)?.question ?? '(sem pergunta)';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-lg border p-3 transition ${
        isSelected
          ? 'border-accent bg-accent/5'
          : 'border-ink/15 bg-paper hover:border-ink/30'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-xs uppercase tracking-wide font-bold text-primary">
          Slide {index + 1} · {slide.type}
        </span>
        {isActive ? (
          <span className="inline-flex items-center gap-1 text-xs font-bold text-success">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
            Ao vivo
          </span>
        ) : null}
      </div>
      <p className="text-sm text-ink line-clamp-2">{question}</p>
      <div className="mt-3 flex flex-wrap gap-1">
        {isActive ? (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onDeactivate();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation();
                onDeactivate();
              }
            }}
            className="px-2 h-7 inline-flex items-center text-xs rounded-md bg-success text-paper cursor-pointer"
          >
            ⏸ Pausar
          </span>
        ) : (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onActivate();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.stopPropagation();
                onActivate();
              }
            }}
            className="px-2 h-7 inline-flex items-center text-xs rounded-md bg-primary text-paper cursor-pointer hover:bg-primary-deep"
          >
            ▶ Ativar
          </span>
        )}
        <span
          role="button"
          tabIndex={0}
          aria-disabled={index === 0}
          onClick={(e) => {
            e.stopPropagation();
            if (index > 0) onMove(-1);
          }}
          className={`px-2 h-7 inline-flex items-center text-xs rounded-md border border-ink/20 ${
            index === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-ink/5'
          }`}
        >
          ↑
        </span>
        <span
          role="button"
          tabIndex={0}
          aria-disabled={index === total - 1}
          onClick={(e) => {
            e.stopPropagation();
            if (index < total - 1) onMove(1);
          }}
          className={`px-2 h-7 inline-flex items-center text-xs rounded-md border border-ink/20 ${
            index === total - 1 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-ink/5'
          }`}
        >
          ↓
        </span>
        <span
          role="button"
          tabIndex={0}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="px-2 h-7 inline-flex items-center text-xs rounded-md text-danger hover:bg-danger/10 ml-auto"
        >
          Excluir
        </span>
      </div>
    </button>
  );
}
