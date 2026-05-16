'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { WordCloudDisplay } from '@/components/telao/WordCloudDisplay';
import { useActiveSlideConfig } from '@/hooks/useActiveSlideConfig';
import { useOnlinePresence } from '@/hooks/useOnlinePresence';
import { useWordcloudActive, type WordcloudConfig } from '@/hooks/useWordcloudActive';
import { getSupabaseBrowserClient, getSupabaseRealtimeClient } from '@/lib/supabase/browser';
import type { WordEntry } from '@/lib/wordcloud/types';
import { updateSlide } from '@/server-actions/slides';

type ChannelLike = NonNullable<Parameters<typeof useWordcloudActive>[1]['channel']>;
type PresenceChannelLike = Parameters<typeof useOnlinePresence>[0]['channel'];

type Props = {
  eventId: string;
  eventSlug: string;
  initialWordcloudActive: boolean;
  initialWordcloudConfig: WordcloudConfig;
  initialActiveSlideId?: string | null | undefined;
  initialWordcloudEntries: WordEntry[];
  showBackground?: boolean | undefined;
  joinUrl?: string | undefined;
  /** Quando true, renderiza OperatorToolbar (toggles QR / ocultar / fullscreen).
   *  Calculado server-side via SSR auth — só owner/member do evento vê. */
  isOperator?: boolean | undefined;
  children: ReactNode;
};

/**
 * Decide o que o telão mostra:
 *   - Se tem slide ativo do tipo wordcloud → WordCloudDisplay com config do slide
 *     (escuta `slides.UPDATE` em tempo real pra pegar mudanças do operador).
 *   - Senão se legacy `wordcloud_active=true` → WordCloudDisplay com config legacy.
 *   - Senão → renderiza children (TelaoClient com comentários).
 *
 * Cada hook tem seu próprio canal Supabase porque supabase-js não aceita
 * chamar `.on()` depois do primeiro `.subscribe()`.
 */
export function TelaoWordcloudSwitcher({
  eventId,
  eventSlug,
  initialWordcloudActive,
  initialWordcloudConfig,
  initialActiveSlideId = null,
  initialWordcloudEntries,
  showBackground = false,
  joinUrl,
  isOperator = false,
  children,
}: Props) {
  // Entries por slide. Inicial vem do SSR (do slide ativo no momento do
  // request); quando operador troca de slide, refetch via RPC.
  const [currentEntries, setCurrentEntries] = useState<WordEntry[]>(initialWordcloudEntries);
  const [entriesSlideId, setEntriesSlideId] = useState<string | null>(initialActiveSlideId);
  const [legacyChannel, setLegacyChannel] = useState<ChannelLike | undefined>(undefined);
  const [slidesChannel, setSlidesChannel] = useState<ChannelLike | undefined>(undefined);
  const [wordsChannel, setWordsChannel] = useState<ChannelLike | undefined>(undefined);
  const [presenceChannel, setPresenceChannel] = useState<PresenceChannelLike | undefined>(
    undefined,
  );

  useEffect(() => {
    const rt = getSupabaseRealtimeClient();
    const ts = Date.now();
    const legacy = rt.channel(`telao:${eventId}:events:${ts}`) as unknown as ChannelLike;
    const slides = rt.channel(`telao:${eventId}:slides:${ts}`) as unknown as ChannelLike;
    const wc = rt.channel(`telao:${eventId}:words:${ts}`) as unknown as ChannelLike;
    const pres = rt.channel(`presence:event:${eventId}`, {
      config: { presence: { key: '' } },
    }) as unknown as PresenceChannelLike;
    setLegacyChannel(legacy);
    setSlidesChannel(slides);
    setWordsChannel(wc);
    setPresenceChannel(pres);
    return () => {
      legacy?.unsubscribe();
      slides?.unsubscribe();
      wc?.unsubscribe();
      pres?.unsubscribe();
    };
  }, [eventId]);

  // Legacy toggle (events.wordcloud_active + events.wordcloud_config).
  const legacy = useWordcloudActive(eventId, {
    initialActive: initialWordcloudActive,
    initialConfig: initialWordcloudConfig,
    channel: legacyChannel,
  });

  // Sistema novo: slide ativo + sua config (events.active_slide_id + slides.config).
  const slide = useActiveSlideConfig(eventId, {
    initialActiveSlideId,
    initialActiveConfig: initialActiveSlideId ? initialWordcloudConfig : null,
    channel: slidesChannel,
  });

  // Precedência: slide ativo > legacy toggle.
  const active = slide.activeSlideId !== null || legacy.active;
  const config: WordcloudConfig = slide.config ?? legacy.config;

  // Quando active_slide_id muda (operador clica próximo/anterior), refetch
  // palavras desse slide pelo RPC. Cada slide = sessão isolada.
  useEffect(() => {
    const sid = slide.activeSlideId;
    if (sid === entriesSlideId) return; // nada mudou
    if (!sid) {
      // Voltou pra legacy mode: zera e usa initial entries de SSR.
      setCurrentEntries(initialWordcloudEntries);
      setEntriesSlideId(null);
      return;
    }
    let cancelled = false;
    const sb = getSupabaseBrowserClient();
    void sb
      .rpc('get_wordcloud_state', { p_slug: eventSlug, p_slide_id: sid })
      .then(({ data }) => {
        if (cancelled) return;
        const rows = (data ?? []) as Array<{ word: string; count: number | string }>;
        setCurrentEntries(rows.map((r) => ({ text: r.word, count: Number(r.count) })));
        setEntriesSlideId(sid);
      });
    return () => {
      cancelled = true;
    };
  }, [slide.activeSlideId, eventSlug, entriesSlideId, initialWordcloudEntries]);

  return useMemo(() => {
    if (!active) return <>{children}</>;
    const noopChannel: ChannelLike = {
      on() {
        return this as unknown as ChannelLike;
      },
      subscribe() {
        return this as unknown as ChannelLike;
      },
      unsubscribe() {},
    } as unknown as ChannelLike;
    return (
      <>
        <WordCloudDisplay
          eventId={eventId}
          config={config}
          initialEntries={currentEntries}
          channel={wordsChannel ?? noopChannel}
          presenceChannel={presenceChannel}
          showBackground={showBackground}
          joinUrl={joinUrl}
          paintBodyBackground
          slideId={slide.activeSlideId}
        />
        {showBackground && slide.activeSlideId && isOperator ? (
          <OperatorToolbar slideId={slide.activeSlideId} config={config} />
        ) : null}
      </>
    );
  }, [
    active,
    children,
    config,
    eventId,
    currentEntries,
    wordsChannel,
    presenceChannel,
    showBackground,
    joinUrl,
    slide.activeSlideId,
    isOperator,
  ]);
}

/** Toolbar flutuante do operador no telão — icon-only, estilo Mentimeter. */
function OperatorToolbar({
  slideId,
  config,
}: {
  slideId: string;
  config: WordcloudConfig;
}) {
  const qrOn = config.showQr !== false;
  const qrFullscreenOn = config.qrFullscreen === true;
  const responsesPrivate = config.showResponsesMode === 'private';
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const update = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', update);
    update();
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  const flip = (patch: Partial<WordcloudConfig>) => {
    void updateSlide(slideId, { ...config, ...patch } as unknown as Record<string, unknown>);
  };
  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  };
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-1 rounded-full bg-black/[0.06] backdrop-blur-md px-2 py-2 shadow-sm">
      <ToolbarButton
        active={!responsesPrivate}
        onClick={() => flip({ showResponsesMode: responsesPrivate ? 'instant' : 'private' })}
        tooltip={responsesPrivate ? 'Mostrar palavras' : 'Ocultar palavras'}
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {responsesPrivate ? (
            <>
              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </>
          ) : (
            <>
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </>
          )}
        </svg>
      </ToolbarButton>
      <ToolbarButton
        active={qrOn}
        onClick={() => flip({ showQr: !qrOn })}
        tooltip={qrOn ? 'Ocultar QR code (lateral)' : 'Mostrar QR code (lateral)'}
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <path d="M14 14h3v3h-3zM20 14h1v1h-1zM14 20h3v1h-3zM20 17h1v4M17 20h1" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        active={qrFullscreenOn}
        onClick={() => flip({ qrFullscreen: !qrFullscreenOn })}
        tooltip={qrFullscreenOn ? 'Fechar QR gigante' : 'QR gigante (tela cheia)'}
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <rect x="7" y="7" width="3" height="3" />
          <rect x="14" y="7" width="3" height="3" />
          <rect x="7" y="14" width="3" height="3" />
          <path d="M14 14h2v2M16 16h2M14 18h2v2" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        active={isFullscreen}
        onClick={toggleFullscreen}
        tooltip={isFullscreen ? 'Sair de tela cheia (Esc)' : 'Entrar em tela cheia'}
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {isFullscreen ? (
            <path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M3 16h3a2 2 0 012 2v3M16 21v-3a2 2 0 012-2h3" />
          ) : (
            <path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M3 16v3a2 2 0 002 2h3M16 21h3a2 2 0 002-2v-3" />
          )}
        </svg>
      </ToolbarButton>
    </div>
  );
}

function ToolbarButton({
  active,
  onClick,
  tooltip,
  children,
}: {
  active: boolean;
  onClick: () => void;
  tooltip: string;
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        aria-label={tooltip}
        className={`h-10 w-10 rounded-full flex items-center justify-center transition ${
          active ? 'bg-white text-black shadow-sm' : 'text-black/70 hover:bg-black/[0.06]'
        }`}
      >
        {children}
      </button>
      {hover ? (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 rounded-md bg-black text-white text-xs whitespace-nowrap pointer-events-none">
          {tooltip}
        </span>
      ) : null}
    </div>
  );
}
