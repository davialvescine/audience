'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { QRCodeSVG } from 'qrcode.react';

import { SlideCanvas } from '@/components/audience/SlideCanvas';
import { SlidePropsPanel } from '@/components/audience/SlidePropsPanel';
import { SlideThumbnail } from '@/components/audience/SlideThumbnail';
import { Button } from '@/components/ui/Button';
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
  palette: ['#E63946', '#1D3557', '#2A9D8F', '#E76F51', '#6A4C93', '#0077B6', '#06A77D', '#D62828'],
  showTotal: true,
  background: { type: 'color', value: '#FFFFFF' },
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

  const onCreate = () => {
    startCreate(async () => {
      const r = await createSlide(eventId, 'wordcloud', { ...DEFAULT_WORDCLOUD_CONFIG });
      if (r.ok) setSelectedId(r.data.id);
    });
  };

  const onDelete = async (slideId: string) => {
    if (!window.confirm('Excluir este slide? Apaga as palavras enviadas nele.')) return;
    const r = await deleteSlide(slideId);
    if (r.ok && selectedId === slideId) {
      setSelectedId(slides.find((s) => s.id !== slideId)?.id ?? null);
    }
    if (r.ok && activeId === slideId) setActiveId(null);
  };

  const onActivate = async (slideId: string | null) => {
    setActiveId(slideId);
    await setActiveSlide(eventId, slideId);
  };

  const onConfigChange = async (slideId: string, config: WordcloudConfig) => {
    await updateSlide(slideId, config as unknown as Record<string, unknown>);
  };

  const onMove = async (slideId: string, dir: -1 | 1) => {
    const idx = slides.findIndex((s) => s.id === slideId);
    if (idx < 0) return;
    const swapWith = idx + dir;
    if (swapWith < 0 || swapWith >= slides.length) return;
    const reordered = [...slides];
    [reordered[idx], reordered[swapWith]] = [reordered[swapWith]!, reordered[idx]!];
    await reorderSlides(eventId, reordered.map((s) => s.id));
  };

  const openTelao = () => {
    if (isTauri && invoke) {
      void invoke('open_telao_window', { slug, mode: 'fullscreen' });
    } else {
      window.open(`${telaoUrl}?mode=fullscreen&fullscreen=1`, '_blank', 'noopener');
    }
  };

  const goPrevSlide = async () => {
    if (slides.length === 0) return;
    const currentIdx = activeId ? slides.findIndex((s) => s.id === activeId) : -1;
    const prevIdx = currentIdx <= 0 ? slides.length - 1 : currentIdx - 1;
    const target = slides[prevIdx]!;
    await onActivate(target.id);
    setSelectedId(target.id);
  };

  const goNextSlide = async () => {
    if (slides.length === 0) return;
    const currentIdx = activeId ? slides.findIndex((s) => s.id === activeId) : -1;
    const nextIdx = currentIdx === -1 || currentIdx === slides.length - 1 ? 0 : currentIdx + 1;
    const target = slides[nextIdx]!;
    await onActivate(target.id);
    setSelectedId(target.id);
  };

  // Atalhos de teclado: ← → navega slides; espaço = próximo; F = fullscreen.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      if (t?.isContentEditable) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        void goPrevSlide();
      } else if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault();
        void goNextSlide();
      } else if (e.key.toLowerCase() === 'f') {
        e.preventDefault();
        openTelao();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slides, activeId, isTauri, invoke]);

  const [showQr, setShowQr] = useState(false);
  const audienceShort = publicUrl.replace(/^https?:\/\//, '');
  const telaoFullUrl = `${telaoUrl}?mode=fullscreen`;

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] gap-3">
      {/* Quick links: audiência (QR) + telão */}
      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowQr((v) => !v)}
            className="shrink-0 h-16 w-16 rounded-md bg-paper border border-ink/10 flex items-center justify-center hover:bg-ink/5"
            title="Mostrar/esconder QR"
          >
            <QRCodeSVG value={publicUrl} size={56} level="M" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wide font-bold text-primary mb-0.5">
              Link da audiência
            </p>
            <p className="font-mono text-sm text-ink truncate" title={publicUrl}>
              {audienceShort}
            </p>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => copy(publicUrl)}
                className="text-xs text-primary hover:underline"
              >
                Copiar
              </button>
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener"
                className="text-xs text-primary hover:underline"
              >
                Abrir ↗
              </a>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 flex items-center gap-3">
          <div className="shrink-0 h-16 w-16 rounded-md bg-paper border border-ink/10 flex items-center justify-center text-2xl">
            🖥
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wide font-bold text-accent mb-0.5">
              Telão / Projetor
            </p>
            <p className="font-mono text-sm text-ink truncate" title={telaoFullUrl}>
              {telaoFullUrl.replace(/^https?:\/\//, '')}
            </p>
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={() => copy(telaoFullUrl)}
                className="text-xs text-primary hover:underline"
              >
                Copiar
              </button>
              <button
                type="button"
                onClick={openTelao}
                className="text-xs text-primary hover:underline"
              >
                Abrir tela cheia ↗
              </button>
            </div>
          </div>
        </div>
      </div>

      {showQr ? (
        <div className="rounded-lg border border-ink/10 bg-paper p-4 flex items-center justify-center">
          <QRCodeSVG value={publicUrl} size={240} level="M" />
        </div>
      ) : null}

      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button onClick={onCreate} loading={creating} variant="accent" size="sm">
            + Novo slide
          </Button>
          <span className="text-sm text-ink/60">
            {slides.length} {slides.length === 1 ? 'slide' : 'slides'} ·{' '}
            {activeId ? (
              <span className="text-success font-medium">● Slide ao vivo</span>
            ) : (
              <span className="text-ink/40">Nenhum ativo</span>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {slides.length > 1 ? (
            <div className="flex items-center gap-1 mr-2">
              <button
                type="button"
                onClick={() => void goPrevSlide()}
                className="h-8 w-8 rounded border border-ink/20 hover:bg-ink/5"
                title="Slide anterior (←)"
                aria-label="Slide anterior"
              >
                ←
              </button>
              <span className="text-xs text-ink/55 px-1 tabular-nums">
                {activeId ? slides.findIndex((s) => s.id === activeId) + 1 : '-'} / {slides.length}
              </span>
              <button
                type="button"
                onClick={() => void goNextSlide()}
                className="h-8 w-8 rounded border border-ink/20 hover:bg-ink/5"
                title="Próximo slide (→ ou espaço)"
                aria-label="Próximo slide"
              >
                →
              </button>
            </div>
          ) : null}
          <span className="text-xs text-ink/50">← → navega · F tela cheia</span>
        </div>
      </div>

      {/* 3 colunas: thumbnails | canvas | props */}
      <div className="grid grid-cols-[200px_minmax(0,1fr)_360px] gap-3 flex-1 min-h-0">
        {/* Thumbnails sidebar */}
        <div className="overflow-y-auto space-y-2 bg-ink/[0.02] rounded-lg p-2 border border-ink/10">
          {slides.length === 0 ? (
            <p className="text-xs text-ink/60 text-center py-6">
              Clique em <strong>+ Novo slide</strong> pra começar.
            </p>
          ) : (
            slides.map((slide, idx) => (
              <SlideThumbnail
                key={slide.id}
                slide={slide}
                index={idx}
                total={slides.length}
                isSelected={selected?.id === slide.id}
                isActive={activeId === slide.id}
                onSelect={() => setSelectedId(slide.id)}
                onActivate={() => onActivate(slide.id)}
                onDeactivate={() => onActivate(null)}
                onDelete={() => onDelete(slide.id)}
                onMove={(dir) => onMove(slide.id, dir)}
              />
            ))
          )}
        </div>

        {/* Canvas central */}
        <div className="overflow-hidden rounded-lg border border-ink/10 bg-ink/[0.02]">
          {selected ? (
            <SlideCanvas slide={selected} telaoUrl={telaoUrl} />
          ) : (
            <div className="h-full flex items-center justify-center text-ink/50">
              <p>Crie um slide pra começar.</p>
            </div>
          )}
        </div>

        {/* Props sidebar */}
        <div className="overflow-y-auto">
          {selected && selected.type === 'wordcloud' ? (
            <SlidePropsPanel
              slide={selected}
              onChange={(cfg) => onConfigChange(selected.id, cfg)}
            />
          ) : selected ? (
            <p className="text-sm text-ink/60 p-4">
              Editor pro tipo <code>{selected.type}</code> ainda não foi feito.
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
