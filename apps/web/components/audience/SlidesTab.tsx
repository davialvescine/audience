'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';

import { CommentsPropsPanel } from '@/components/audience/CommentsPropsPanel';
import { OpenEndedPropsPanel } from '@/components/audience/OpenEndedPropsPanel';
import { SlideCanvas } from '@/components/audience/SlideCanvas';
import { SlidePropsPanel } from '@/components/audience/SlidePropsPanel';
import { SlideThumbnail } from '@/components/audience/SlideThumbnail';
import { SlideTypePicker } from '@/components/audience/SlideTypePicker';
import { Button } from '@/components/ui/Button';
import { useSlides } from '@/hooks/useSlides';
import { useTauri } from '@/hooks/useTauri';
import type { WordcloudConfig } from '@/hooks/useWordcloudActive';
import { getSupabaseRealtimeClient } from '@/lib/supabase/browser';
import { DEFAULT_COMMENTS_CONFIG, DEFAULT_OPEN_ENDED_CONFIG, type Slide, type SlideType } from '@/lib/slides/types';
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
  // Paleta pastel estilo Mentimeter — cores suaves, alto contraste com fundo branco.
  palette: ['#7B89F4', '#F08CA0', '#A8D5BA', '#FFD580', '#C8B6FF', '#FFA8C5', '#9AD9DB', '#FFB7A5'],
  showTotal: true,
  showQr: true,
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
  const [pickerOpen, setPickerOpen] = useState(false);
  // Live overlay do config sendo editado — reflete keystrokes no canvas
  // imediatamente, sem esperar autosave + realtime.
  const [liveConfig, setLiveConfig] = useState<WordcloudConfig | null>(null);
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

  const onCreate = (type: SlideType) => {
    startCreate(async () => {
      const config =
        type === 'open_ended'
          ? { ...DEFAULT_OPEN_ENDED_CONFIG }
          : type === 'comments'
            ? { ...DEFAULT_COMMENTS_CONFIG }
            : { ...DEFAULT_WORDCLOUD_CONFIG };
      const r = await createSlide(eventId, type, config);
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

  // useCallback estabiliza a identidade — sem isso, cada re-render do
  // SlidesTab cria uma função nova, o useEffect do SlidePropsPanel detecta
  // como "mudança" e re-dispara autosave salvando config velha, sobrescrevendo
  // toggles do operador (ex: showQr clicado no telão sumia).
  const onConfigChange = useCallback(async (slideId: string, config: WordcloudConfig) => {
    await updateSlide(slideId, config as unknown as Record<string, unknown>);
  }, []);
  const onLiveChangeStable = useCallback((cfg: WordcloudConfig) => setLiveConfig(cfg), []);

  // Reset liveConfig quando troca de slide selecionado OU quando o slide
  // que estamos editando ganha update via realtime (ex: toggle do telão).
  // Sem isso, liveConfig fica grudada na versão velha e ofusca o estado
  // novo do DB no canvas.
  useEffect(() => {
    setLiveConfig(null);
  }, [selectedId, JSON.stringify(selected?.config)]);

  // Auto-cria 1 slide exemplo quando o evento não tem nenhum, pra usuário
  // já cair direto no editor sem precisar clicar '+ Novo slide'.
  const autoCreatedRef = useRef(false);
  useEffect(() => {
    if (autoCreatedRef.current) return;
    if (slides.length > 0) return;
    autoCreatedRef.current = true;
    void createSlide(eventId, 'wordcloud', { ...DEFAULT_WORDCLOUD_CONFIG }).then((r) => {
      if (r.ok) setSelectedId(r.data.id);
    });
  }, [slides.length, eventId]);

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

  const slidesUrl = `${publicUrl}?mode=slides`;
  const telaoFullUrl = `${telaoUrl}?mode=fullscreen`;

  // Save indicator state — flipa pra 'saving' quando dispara updateSlide,
  // volta pra 'saved' quando termina. Mostra pílula no header.
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const lastSavedAtRef = useRef<number>(0);
  const onConfigChangeWithStatus = useCallback(
    async (slideId: string, cfg: WordcloudConfig) => {
      setSaveState('saving');
      await updateSlide(slideId, cfg as unknown as Record<string, unknown>);
      lastSavedAtRef.current = Date.now();
      setSaveState('saved');
    },
    [],
  );

  return (
    <div className="flex flex-col lg:h-[calc(100vh-180px)] gap-4">
      {/* Link público — visível direto na aba Slides pra operador copiar
          sem precisar ir na aba Compartilhar. */}
      <ShareLinkBar publicUrl={publicUrl} />

      {/* Top bar — wrap em mobile, layout horizontal em desktop. */}
      <div className="flex flex-wrap items-center justify-between gap-2 lg:gap-4 px-1">
        <div className="flex items-center gap-2 lg:gap-3 flex-wrap">
          <Button onClick={() => setPickerOpen(true)} loading={creating} variant="accent" size="sm">
            + Novo slide
          </Button>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-ink/55 tabular-nums hidden sm:inline">
              {slides.length} {slides.length === 1 ? 'slide' : 'slides'}
            </span>
            {activeId ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-success/10 text-success text-xs font-semibold">
                <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                AO VIVO
              </span>
            ) : null}
            <SaveIndicator state={saveState} />
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {slides.length > 1 ? (
            <div className="flex items-center gap-1 rounded-full bg-ink/[0.04] px-1.5 py-1">
              <button
                type="button"
                onClick={() => void goPrevSlide()}
                className="h-8 w-8 rounded-full hover:bg-ink/[0.06] text-ink/70 transition"
                title="Slide anterior (←)"
                aria-label="Slide anterior"
              >
                ←
              </button>
              <span className="text-xs text-ink/60 px-2 tabular-nums font-medium">
                {activeId ? slides.findIndex((s) => s.id === activeId) + 1 : '–'} / {slides.length}
              </span>
              <button
                type="button"
                onClick={() => void goNextSlide()}
                className="h-8 w-8 rounded-full hover:bg-ink/[0.06] text-ink/70 transition"
                title="Próximo slide (→ ou espaço)"
                aria-label="Próximo slide"
              >
                →
              </button>
            </div>
          ) : null}
          <span className="text-xs text-ink/45 mr-2 hidden xl:inline">
            <kbd className="px-1.5 py-0.5 rounded bg-ink/[0.06] font-mono text-[10px]">←</kbd>
            <kbd className="ml-1 px-1.5 py-0.5 rounded bg-ink/[0.06] font-mono text-[10px]">→</kbd>
            <span className="ml-2">navega</span>
            <kbd className="ml-3 px-1.5 py-0.5 rounded bg-ink/[0.06] font-mono text-[10px]">F</kbd>
            <span className="ml-1">tela cheia</span>
          </span>
          <button
            type="button"
            onClick={openTelao}
            className="hidden sm:inline-flex items-center gap-2 h-9 px-4 rounded-full text-sm font-medium text-ink hover:bg-ink/[0.06] transition"
          >
            Preview ↗
          </button>
          <button
            type="button"
            onClick={() => {
              if (selected && !activeId) {
                void onActivate(selected.id);
              }
              openTelao();
            }}
            className="inline-flex items-center gap-2 h-9 px-3 lg:px-4 rounded-full bg-primary text-paper text-sm font-bold hover:bg-primary-deep shadow-sm transition"
          >
            <span>▶</span>
            <span className="hidden sm:inline">Iniciar apresentação</span>
            <span className="sm:hidden">Iniciar</span>
          </button>
        </div>
      </div>

      {/* Mobile: stack vertical. Desktop (lg+): 3 colunas (thumbs · canvas · props). */}
      <div className="flex flex-col lg:grid lg:grid-cols-[150px_minmax(0,1fr)_340px] gap-4 flex-1 lg:min-h-0">
        {/* Thumbnails — strip horizontal no mobile, sidebar vertical em desktop. */}
        <div className="lg:overflow-y-auto bg-ink/[0.03] rounded-xl p-2.5">
          {slides.length === 0 ? (
            <p className="text-[11px] text-ink/55 text-center py-6">
              Crie seu primeiro slide
            </p>
          ) : (
            <div className="flex lg:block gap-2 lg:gap-0 lg:space-y-2 overflow-x-auto lg:overflow-x-visible -mx-0.5 px-0.5 lg:mx-0 lg:px-0">
              {slides.map((slide, idx) => (
                <div key={slide.id} className="w-32 shrink-0 lg:w-auto">
                  <SlideThumbnail
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
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Canvas central — ring verde quando slide selecionado é o ativo.
            Mobile: aspect-video fixo. Desktop: ocupa altura disponível. */}
        <div
          className={`overflow-hidden rounded-xl bg-ink/[0.03] aspect-video lg:aspect-auto transition-shadow ${
            selected && activeId === selected.id
              ? 'ring-2 ring-success/50 shadow-[0_0_0_8px_rgba(34,197,94,0.06)]'
              : 'shadow-sm'
          }`}
        >
          {selected ? (
            <SlideCanvas
              slide={selected}
              liveConfig={liveConfig ?? undefined}
              joinUrl={slidesUrl}
              onConfigChange={(cfg) => {
                setLiveConfig(cfg);
                void onConfigChangeWithStatus(selected.id, cfg);
              }}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-ink/45">
              <p>Crie um slide pra começar.</p>
            </div>
          )}
        </div>

        {/* Props sidebar — full width no mobile, sidebar em desktop. */}
        <div className="lg:overflow-y-auto lg:pr-1 bg-paper rounded-xl border border-ink/10 lg:bg-transparent lg:rounded-none lg:border-0">
          {selected && selected.type === 'wordcloud' ? (
            <SlidePropsPanel
              slide={selected}
              onChange={(cfg) => onConfigChangeWithStatus(selected.id, cfg)}
              onLiveChange={onLiveChangeStable}
              onApplyToAll={
                slides.length > 1
                  ? () => {
                      const cfg = liveConfig ?? (selected.config as WordcloudConfig);
                      void Promise.all(
                        slides
                          .filter((s) => s.id !== selected.id && s.type === 'wordcloud')
                          .map((s) => updateSlide(s.id, cfg as unknown as Record<string, unknown>)),
                      );
                    }
                  : undefined
              }
            />
          ) : selected && selected.type === 'open_ended' ? (
            <OpenEndedPropsPanel
              slide={selected as Slide<'open_ended'>}
              onChange={(cfg) => {
                setLiveConfig(cfg as unknown as WordcloudConfig);
                void updateSlide(selected.id, cfg as unknown as Record<string, unknown>);
              }}
              onLiveChange={(cfg) => setLiveConfig(cfg as unknown as WordcloudConfig)}
              onApplyToAll={
                slides.filter((s) => s.id !== selected.id && s.type === 'open_ended').length > 0
                  ? () => {
                      const cfg = liveConfig ?? selected.config;
                      void Promise.all(
                        slides
                          .filter((s) => s.id !== selected.id && s.type === 'open_ended')
                          .map((s) =>
                            updateSlide(s.id, cfg as unknown as Record<string, unknown>),
                          ),
                      );
                    }
                  : undefined
              }
            />
          ) : selected && selected.type === 'comments' ? (
            <CommentsPropsPanel
              slide={selected as Slide<'comments'>}
              slug={slug}
              onChange={(cfg) => {
                setLiveConfig(cfg as unknown as WordcloudConfig);
                void updateSlide(selected.id, cfg as unknown as Record<string, unknown>);
              }}
              onLiveChange={(cfg) => setLiveConfig(cfg as unknown as WordcloudConfig)}
            />
          ) : selected ? (
            <p className="text-sm text-ink/60 p-4">
              Editor pro tipo <code>{selected.type}</code> ainda não foi feito.
            </p>
          ) : null}
        </div>
      </div>

      <SlideTypePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(type) => onCreate(type)}
      />
    </div>
  );
}

function ShareLinkBar({ publicUrl }: { publicUrl: string }) {
  const [copied, setCopied] = useState(false);
  // Versão "limpa" pra mostrar (sem https://).
  const display = publicUrl.replace(/^https?:\/\//, '');
  const copy = () => {
    void navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex items-center gap-2 rounded-xl bg-accent/8 border border-accent/20 px-3 py-2">
      <span className="hidden sm:inline text-[10px] font-semibold uppercase tracking-wider text-accent shrink-0">
        Pra audiência
      </span>
      <code className="flex-1 min-w-0 text-sm text-ink font-mono truncate">{display}</code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-accent text-ink text-xs font-semibold hover:bg-accent/80 transition"
        title="Copiar link"
      >
        {copied ? (
          <>
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Copiado
          </>
        ) : (
          <>
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Copiar
          </>
        )}
      </button>
    </div>
  );
}

function SaveIndicator({ state }: { state: 'idle' | 'saving' | 'saved' }) {
  if (state === 'idle') return null;
  if (state === 'saving') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-ink/55">
        <span className="h-3 w-3 rounded-full border-2 border-ink/30 border-t-ink/70 animate-spin" />
        Salvando…
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-ink/50">
      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
      Salvo
    </span>
  );
}

