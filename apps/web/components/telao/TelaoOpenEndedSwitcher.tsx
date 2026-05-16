'use client';

import { useEffect, useMemo, useState } from 'react';

import { OpenEndedDisplay } from '@/components/telao/OpenEndedDisplay';
import type { OpenEndedResponse } from '@/hooks/useOpenEndedResponses';
import { getSupabaseBrowserClient, getSupabaseRealtimeClient } from '@/lib/supabase/browser';
import type { OpenEndedConfig } from '@/lib/slides/types';
import { updateSlide } from '@/server-actions/slides';

type ChannelLike = Parameters<typeof OpenEndedDisplay>[0]['channel'];
type PresenceChannelLike = NonNullable<Parameters<typeof OpenEndedDisplay>[0]['presenceChannel']>;

type Props = {
  eventId: string;
  slideId: string;
  initialConfig: OpenEndedConfig;
  initialResponses: OpenEndedResponse[];
  showBackground: boolean;
  joinUrl?: string | undefined;
  isOperator: boolean;
};

export function TelaoOpenEndedSwitcher({
  eventId,
  slideId,
  initialConfig,
  initialResponses,
  showBackground,
  joinUrl,
  isOperator,
}: Props) {
  const [config, setConfig] = useState<OpenEndedConfig>(initialConfig);
  const [responses, setResponses] = useState<OpenEndedResponse[]>(initialResponses);
  const [responsesChannel, setResponsesChannel] = useState<ChannelLike | undefined>(undefined);
  const [slidesChannel, setSlidesChannel] = useState<ChannelLike | undefined>(undefined);
  const [presenceChannel, setPresenceChannel] = useState<PresenceChannelLike | undefined>(
    undefined,
  );

  useEffect(() => {
    const rt = getSupabaseRealtimeClient();
    const ts = Date.now();
    const r = rt.channel(`telao:${eventId}:oer:${ts}`) as unknown as ChannelLike;
    const s = rt.channel(`telao:${eventId}:oer-slides:${ts}`) as unknown as ChannelLike;
    const p = rt.channel(`presence:event:${eventId}`, {
      config: { presence: { key: '' } },
    }) as unknown as PresenceChannelLike;
    setResponsesChannel(r);
    setSlidesChannel(s);
    setPresenceChannel(p);
    return () => {
      r?.unsubscribe();
      s?.unsubscribe();
      p?.unsubscribe();
    };
  }, [eventId]);

  // Sync config via slides UPDATE em tempo real (toolbar do operador,
  // SlidePropsPanel autosave, etc).
  useEffect(() => {
    const ch = slidesChannel;
    if (!ch) return;
    ch.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'slides', filter: `id=eq.${slideId}` },
      (payload) => {
        const row = payload.new as { config?: OpenEndedConfig };
        if (row.config) setConfig(row.config);
      },
    ).subscribe();
    return () => {
      ch.unsubscribe();
    };
  }, [slidesChannel, slideId]);

  // Polling fallback — refetch config a cada 3s caso Realtime caia.
  useEffect(() => {
    let cancelled = false;
    const sb = getSupabaseBrowserClient();
    const poll = async () => {
      const { data } = await sb.from('slides').select('config').eq('id', slideId).maybeSingle();
      if (cancelled) return;
      const cfg = (data as { config?: OpenEndedConfig } | null)?.config;
      if (cfg) {
        setConfig((prev) => (JSON.stringify(prev) === JSON.stringify(cfg) ? prev : cfg));
      }
    };
    const id = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [slideId]);

  return useMemo(() => {
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
        <OpenEndedDisplay
          eventId={eventId}
          slideId={slideId}
          config={config}
          initialResponses={responses}
          channel={responsesChannel ?? noopChannel}
          presenceChannel={presenceChannel}
          showBackground={showBackground}
          joinUrl={joinUrl}
          paintBodyBackground
        />
        {showBackground && isOperator ? (
          <OperatorToolbar slideId={slideId} config={config} />
        ) : null}
      </>
    );
  }, [
    config,
    eventId,
    slideId,
    responses,
    responsesChannel,
    presenceChannel,
    showBackground,
    joinUrl,
    isOperator,
  ]);
}

function OperatorToolbar({
  slideId,
  config,
}: {
  slideId: string;
  config: OpenEndedConfig;
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
  const flip = (patch: Partial<OpenEndedConfig>) => {
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
        tooltip={responsesPrivate ? 'Mostrar respostas' : 'Ocultar respostas'}
      >
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  children: React.ReactNode;
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

