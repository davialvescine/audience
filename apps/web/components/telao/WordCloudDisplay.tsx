'use client';

import { AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';

import { WordCloudWord } from '@/components/telao/WordCloudWord';
import { useOnlinePresence } from '@/hooks/useOnlinePresence';
import type { WordcloudBackground, WordcloudConfig } from '@/hooks/useWordcloudActive';
import { useWordCounts } from '@/hooks/useWordCounts';
import { runLayout } from '@/lib/wordcloud/runLayout';
import type { LaidOutWord, WordEntry } from '@/lib/wordcloud/types';

export function backgroundStyle(
  bg: WordcloudBackground | undefined,
): React.CSSProperties | undefined {
  if (!bg || bg.type === 'none') return undefined;
  if (bg.type === 'color') return { background: bg.value };
  if (bg.type === 'gradient')
    return { background: `linear-gradient(135deg, ${bg.from}, ${bg.to})` };
  if (bg.type === 'image') {
    const opacity = bg.opacity ?? 1;
    const blur = bg.blurPx ?? 0;
    const fit = bg.fit ?? 'cover';
    return {
      backgroundImage: `url(${JSON.stringify(bg.url)})`,
      backgroundSize: fit,
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundColor: '#0A2540',
      filter: blur > 0 ? `blur(${blur}px)` : undefined,
      opacity,
    };
  }
  return undefined;
}

function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1]!, 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function isBackgroundLight(bg: WordcloudBackground | undefined): boolean {
  if (!bg || bg.type === 'none') return false;
  if (bg.type === 'color') return luminance(bg.value) > 0.6;
  if (bg.type === 'gradient') return luminance(bg.from) > 0.6 && luminance(bg.to) > 0.6;
  return false;
}

const STAGE_W = 1920;
const STAGE_H = 1080;
const HEADER_H = 220;
const CLOUD_H = STAGE_H - HEADER_H;

type ChannelLike = Parameters<typeof useWordCounts>[1]['channel'];
type PresenceChannelLike = Parameters<typeof useOnlinePresence>[0]['channel'];

type Props = {
  eventId: string;
  config: WordcloudConfig;
  initialEntries: WordEntry[];
  channel: ChannelLike;
  presenceChannel?: PresenceChannelLike | undefined;
  showBackground?: boolean | undefined;
  joinUrl?: string | undefined;
  /** Quando true, pinta o background no <html>/<body> pra eliminar letterbox.
   *  Default false — só ative na rota /telao real, não em preview/canvas
   *  do admin (senão pinta o admin inteiro). */
  paintBodyBackground?: boolean | undefined;
};

export function WordCloudDisplay({
  eventId,
  config,
  initialEntries,
  channel,
  presenceChannel,
  showBackground = false,
  joinUrl,
  paintBodyBackground = false,
}: Props) {
  const { entries, totalSubmissions } = useWordCounts(eventId, {
    channel,
    initialEntries,
  });
  const presence = useOnlinePresence({
    channel: presenceChannel ?? makeNoopPresenceChannel(),
  });
  const [laid, setLaid] = useState<LaidOutWord[]>([]);

  useEffect(() => {
    if (!entries.length) {
      setLaid([]);
      return;
    }
    let cancelled = false;
    runLayout({
      entries,
      width: STAGE_W,
      height: CLOUD_H,
      paletteSize: config.palette.length,
    })
      .then((w) => {
        if (!cancelled) setLaid(w);
      })
      .catch((e) => {
        // eslint-disable-next-line no-console
        console.warn('wordcloud layout failed', e);
      });
    return () => {
      cancelled = true;
    };
  }, [entries, config.palette.length]);

  // Pinta o background do slide direto no <html>/<body> pra eliminar as
  // barras brancas que aparecem em letterbox quando o TelaoStage escala
  // 1920×1080 numa viewport com aspect-ratio diferente. Só aplica quando
  // paintBodyBackground=true (rota /telao real). Em preview/canvas do
  // admin, sempre false — senão pinta o admin inteiro com o bg do slide.
  useEffect(() => {
    if (!paintBodyBackground) return;
    if (!showBackground) return;
    if (typeof document === 'undefined') return;
    const style = backgroundStyle(config.background);
    if (!style) return;
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.getAttribute('style') ?? '';
    const prevBody = body.getAttribute('style') ?? '';
    Object.entries(style).forEach(([k, v]) => {
      const css = k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      html.style.setProperty(css, String(v));
      body.style.setProperty(css, String(v));
    });
    return () => {
      html.setAttribute('style', prevHtml);
      body.setAttribute('style', prevBody);
    };
  }, [paintBodyBackground, showBackground, config.background]);

  const bgStyle = showBackground ? backgroundStyle(config.background) : undefined;
  const lightBg = showBackground && isBackgroundLight(config.background);
  const textColor = lightBg ? '#0A1834' : '#FFFFFF';
  const subtleColor = lightBg ? 'rgba(10,24,52,0.6)' : 'rgba(255,255,255,0.7)';

  const joinLabel = (() => {
    if (!joinUrl) return null;
    try {
      const u = new URL(joinUrl);
      return `${u.host}${u.pathname}`;
    } catch {
      return joinUrl;
    }
  })();

  const showQr = config.showQr === true && !!joinUrl && showBackground;

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ ...bgStyle, color: textColor }}>
      {/* QR code lateral pra participante entrar — estilo Mentimeter */}
      {showQr && joinUrl ? (
        <div
          className="absolute right-12 top-1/2 -translate-y-1/2 z-20 rounded-xl p-6 flex flex-col items-center gap-4"
          style={{
            background: lightBg ? 'rgba(10,24,52,0.05)' : 'rgba(255,255,255,0.1)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div className="bg-paper p-3 rounded-lg">
            <QRCodeSVG value={joinUrl} size={180} level="M" />
          </div>
          <div className="text-center">
            <p className="text-xl font-mono font-semibold" style={{ color: textColor }}>
              {joinLabel}
            </p>
            <p className="text-sm mt-1" style={{ color: subtleColor }}>
              Escaneie pra participar
            </p>
          </div>
        </div>
      ) : null}

      {/* Pergunta colada no topo, sem barra */}
      <header
        className="relative z-10 px-20 flex items-start justify-center"
        style={{
          height: HEADER_H,
          paddingTop: 56,
          paddingRight: showQr ? 320 : undefined,
        }}
      >
        <h1
          className="font-display font-bold tracking-tight text-center break-words"
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 88,
            lineHeight: 1.05,
            maxWidth: '100%',
            width: '100%',
            color: textColor,
            textShadow: lightBg ? 'none' : '0 2px 12px rgba(0,0,0,0.35)',
            textWrap: 'balance',
          }}
        >
          {config.question}
        </h1>
      </header>

      {/* Nuvem ocupa tudo abaixo da pergunta — encolhe da direita se QR estiver visível */}
      <div
        className="absolute left-0"
        style={{
          top: HEADER_H,
          height: CLOUD_H,
          right: showQr ? 340 : 0,
        }}
      >
        <AnimatePresence>
          {laid.map((w) => (
            <WordCloudWord
              key={w.text}
              word={w}
              palette={config.palette}
              originX={STAGE_W / 2}
              originY={CLOUD_H / 2}
            />
          ))}
        </AnimatePresence>

        {entries.length === 0 ? (
          <div
            className="absolute inset-0 flex items-center justify-center text-3xl text-center px-12"
            style={{ color: subtleColor }}
          >
            Aguardando palavras...
          </div>
        ) : null}
      </div>

      {/* Footer flutuante discreto */}
      {showBackground && joinLabel ? (
        <div
          className="absolute bottom-6 left-8 right-8 flex items-end justify-between text-lg pointer-events-none"
          style={{ color: subtleColor }}
        >
          <span>
            Acesse:{' '}
            <span className="font-mono font-semibold" style={{ color: textColor }}>
              {joinLabel}
            </span>
          </span>
          <div className="flex items-center gap-4">
            {config.showTotal && totalSubmissions > 0 ? (
              <span>
                <span className="font-bold tabular-nums" style={{ color: textColor }}>
                  {totalSubmissions}
                </span>{' '}
                palavras
              </span>
            ) : null}
            {presenceChannel ? (
              <span className="flex items-center gap-2">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
                <span className="font-bold tabular-nums" style={{ color: textColor }}>
                  {presence.count}
                </span>{' '}
                online
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function makeNoopPresenceChannel(): PresenceChannelLike {
  const self: PresenceChannelLike = {
    on() {
      return self;
    },
    subscribe() {
      return self;
    },
    unsubscribe() {},
    presenceState() {
      return {};
    },
  };
  return self;
}
