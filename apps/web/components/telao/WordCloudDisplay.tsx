'use client';

import { AnimatePresence } from 'framer-motion';
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

/** Relative luminance of a hex color (#rrggbb). */
function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1]!, 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Returns true when text should be dark (because the background is light). */
export function isBackgroundLight(bg: WordcloudBackground | undefined): boolean {
  if (!bg || bg.type === 'none') return false;
  if (bg.type === 'color') return luminance(bg.value) > 0.6;
  if (bg.type === 'gradient') {
    return luminance(bg.from) > 0.6 && luminance(bg.to) > 0.6;
  }
  // image: assume escuro por segurança (texto branco com sombra)
  return false;
}

const STAGE_W = 1920;
const STAGE_H = 1080;
const TOP_BAR_H = 80;
const HEADER_H = 200;
const CLOUD_H = STAGE_H - TOP_BAR_H - HEADER_H;

type ChannelLike = Parameters<typeof useWordCounts>[1]['channel'];
type PresenceChannelLike = Parameters<typeof useOnlinePresence>[0]['channel'];

type Props = {
  eventId: string;
  config: WordcloudConfig;
  initialEntries: WordEntry[];
  channel: ChannelLike;
  /** Optional presence channel. When provided, shows the online viewer count. */
  presenceChannel?: PresenceChannelLike | undefined;
  /**
   * When true, apply the configured background. When false (Browser Source
   * / OBS overlay), keep transparent.
   */
  showBackground?: boolean | undefined;
  /** Public URL pra audiência entrar, mostrado no topo do telão tela cheia. */
  joinUrl?: string | undefined;
};

export function WordCloudDisplay({
  eventId,
  config,
  initialEntries,
  channel,
  presenceChannel,
  showBackground = false,
  joinUrl,
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

  const bgStyle = showBackground ? backgroundStyle(config.background) : undefined;
  const lightBg = showBackground && isBackgroundLight(config.background);
  const textColor = lightBg ? '#0A1834' : '#FFFFFF';
  const subtleColor = lightBg ? 'rgba(10,24,52,0.6)' : 'rgba(255,255,255,0.7)';
  const topBarBg = lightBg ? 'rgba(10,24,52,0.04)' : 'rgba(255,255,255,0.08)';
  const topBarBorder = lightBg ? 'rgba(10,24,52,0.08)' : 'rgba(255,255,255,0.12)';

  // Cleanup: remove o hostname do joinUrl pra ficar tipo "audience-opal.vercel.app/e/<slug>".
  const joinLabel = (() => {
    if (!joinUrl) return null;
    try {
      const u = new URL(joinUrl);
      return `${u.host}${u.pathname}`;
    } catch {
      return joinUrl;
    }
  })();

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ ...bgStyle, color: textColor }}>
      {/* Top bar: link pra entrar (esquerda) + total/online (direita) */}
      {showBackground && (joinLabel || presenceChannel) ? (
        <div
          className="absolute left-0 right-0 top-0 flex items-center justify-between px-10"
          style={{
            height: TOP_BAR_H,
            background: topBarBg,
            borderBottom: `1px solid ${topBarBorder}`,
          }}
        >
          {joinLabel ? (
            <div className="flex items-center gap-3 text-2xl">
              <span style={{ color: subtleColor }}>Pra participar, acesse:</span>
              <span className="font-mono font-semibold">{joinLabel}</span>
            </div>
          ) : (
            <span />
          )}
          {presenceChannel && presence.count > 0 ? (
            <div className="flex items-center gap-2 text-xl">
              <svg
                className="h-6 w-6"
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
              <span className="font-bold tabular-nums">{presence.count}</span>
              <span style={{ color: subtleColor }}>
                {presence.count === 1 ? 'pessoa online' : 'pessoas online'}
              </span>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Pergunta */}
      <header
        className="relative z-10 px-12 text-center"
        style={{ paddingTop: showBackground ? TOP_BAR_H + 40 : 48, height: HEADER_H + 40 }}
      >
        <h1
          className="font-display font-bold tracking-tight"
          style={{
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: 88,
            lineHeight: 1.05,
            color: textColor,
            textShadow: lightBg ? 'none' : '0 2px 12px rgba(0,0,0,0.35)',
          }}
        >
          {config.question}
        </h1>
        {config.showTotal && entries.length > 0 ? (
          <p className="mt-4 text-2xl" style={{ color: subtleColor }}>
            {totalSubmissions} palavras enviadas
          </p>
        ) : null}
      </header>

      {/* Nuvem */}
      <div
        className="absolute left-0 right-0"
        style={{ top: TOP_BAR_H + HEADER_H, height: CLOUD_H }}
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
            Aguardando palavras... Envie pelo celular ↓
          </div>
        ) : null}
      </div>
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
