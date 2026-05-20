'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';

import { backgroundStyle, isBackgroundLight } from '@/components/telao/WordCloudDisplay';
import { useOnlinePresence } from '@/hooks/useOnlinePresence';
import { useOpenEndedResponses, type OpenEndedResponse } from '@/hooks/useOpenEndedResponses';
import type { OpenEndedConfig } from '@/lib/slides/types';

const STAGE_W = 1920;
const STAGE_H = 1080;
const HEADER_H = 220;

type ChannelLike = Parameters<typeof useOpenEndedResponses>[1]['channel'];
type PresenceChannelLike = Parameters<typeof useOnlinePresence>[0]['channel'];

type Props = {
  eventId: string;
  slideId: string | null;
  config: OpenEndedConfig;
  initialResponses: OpenEndedResponse[];
  channel: ChannelLike;
  presenceChannel?: PresenceChannelLike | undefined;
  showBackground?: boolean | undefined;
  joinUrl?: string | undefined;
  paintBodyBackground?: boolean | undefined;
  previewPresenceCount?: number | undefined;
};

export function OpenEndedDisplay({
  eventId,
  slideId,
  config,
  initialResponses,
  channel,
  presenceChannel,
  showBackground = false,
  joinUrl,
  paintBodyBackground = false,
  previewPresenceCount,
}: Props) {
  const { responses, connectionState } = useOpenEndedResponses(eventId, {
    channel,
    initialResponses,
    slideId,
  });
  const presence = useOnlinePresence({
    channel: presenceChannel ?? makeNoopPresenceChannel(),
  });

  const bgStyle = showBackground ? backgroundStyle(config.background) : undefined;
  const lightBg = showBackground && isBackgroundLight(config.background);
  const autoTextColor = lightBg ? '#0A1834' : '#FFFFFF';
  const textColor = config.textColorOverride ?? autoTextColor;
  const subtleColor = lightBg ? 'rgba(10,24,52,0.6)' : 'rgba(255,255,255,0.7)';

  const responsesMode = config.showResponsesMode ?? 'instant';
  const hideResponses = responsesMode === 'private' || responsesMode === 'on_click';

  const showQr = config.showQr !== false && !!joinUrl && showBackground;
  const qrFullscreen = config.qrFullscreen === true && !!joinUrl && showBackground;

  const joinHost = (() => {
    if (!joinUrl) return '';
    try {
      return new URL(joinUrl).host;
    } catch {
      return '';
    }
  })();
  const joinCode = (() => {
    if (!joinUrl) return '';
    try {
      const segs = new URL(joinUrl).pathname.split('/').filter(Boolean);
      return (segs[segs.length - 1] ?? '').toUpperCase();
    } catch {
      return '';
    }
  })();
  const joinInfoMode = config.joinInfoType ?? 'qr_and_url';

  // Paint body background quando paintBodyBackground=true (mesma lógica que wordcloud).
  // Não duplico aqui — confio que /telao/[slug] passa false em preview/canvas.

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ color: textColor }}>
      {/* QR fullscreen overlay */}
      <AnimatePresence>
        {qrFullscreen && joinUrl ? (
          <motion.div
            key="qr-fullscreen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-10"
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            style={(backgroundStyle(config.background ?? { type: 'none' }) ?? { background: '#FFFFFF' }) as any}
          >
            <div className="text-center">
              <p
                className="text-4xl font-semibold mb-2"
                style={{ color: lightBg || config.background?.type === 'none' || !config.background ? 'rgba(10,37,64,0.7)' : 'rgba(255,255,255,0.85)' }}
              >
                Aponte a câmera do celular
              </p>
              <p
                className="text-2xl"
                style={{ color: lightBg || config.background?.type === 'none' || !config.background ? 'rgba(10,37,64,0.55)' : 'rgba(255,255,255,0.65)' }}
              >e participe agora</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-2xl border border-ink/10">
              <QRCodeSVG value={joinUrl} size={760} level="M" />
            </div>
            <div className="text-center">
              <p
                className="text-3xl font-semibold"
                style={{ color: lightBg || config.background?.type === 'none' || !config.background ? '#0A2540' : '#FFFFFF' }}
              >{joinHost}</p>
              <p
                className="text-6xl font-bold tracking-wider mt-2 tabular-nums"
                style={{ letterSpacing: '0.08em', color: lightBg || config.background?.type === 'none' || !config.background ? '#0A2540' : '#FFFFFF' }}
              >
                {joinCode}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {bgStyle ? <div aria-hidden className="absolute inset-0" style={bgStyle} /> : null}

      {/* QR card lateral */}
      <AnimatePresence>
        {showQr && joinUrl ? (
          <motion.div
            key="qr-card"
            initial={{ opacity: 0, x: 80, scale: 0.92 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 80, scale: 0.92 }}
            transition={{ type: 'spring', damping: 22, stiffness: 220, mass: 0.7 }}
            className="absolute right-12 top-1/2 -translate-y-1/2 z-20 rounded-2xl p-8 flex flex-col items-center gap-5 shadow-2xl"
            style={{ background: '#F5F5F0', color: '#0A1834', minWidth: 280 }}
          >
            {joinInfoMode !== 'code' ? (
              <div className="bg-white p-3 rounded-lg">
                <QRCodeSVG value={joinUrl} size={220} level="M" />
              </div>
            ) : null}
            {joinInfoMode !== 'qr' ? (
              <div className="text-center">
                {joinInfoMode === 'url' || joinInfoMode === 'qr_and_url' ? (
                  <p className="text-2xl font-semibold">{joinHost}</p>
                ) : null}
                {joinInfoMode === 'code' || joinInfoMode === 'qr_and_url' ? (
                  <p
                    className="font-bold tracking-wider mt-1 tabular-nums"
                    style={{
                      letterSpacing: '0.05em',
                      fontSize: joinInfoMode === 'code' ? 64 : 36,
                    }}
                  >
                    {joinCode}
                  </p>
                ) : null}
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Pergunta no topo */}
      <header
        className="relative z-10 flex items-start justify-center"
        style={{
          height: HEADER_H,
          paddingTop: 56,
          paddingLeft: 80,
          paddingRight: showQr ? 380 : 80,
        }}
      >
        <h1
          className="font-bold tracking-tight text-center break-words"
          style={{
            fontFamily:
              'var(--font-wordcloud), "Plus Jakarta Sans", Inter, system-ui, sans-serif',
            fontSize: 88,
            lineHeight: 1.05,
            letterSpacing: '-0.02em',
            width: '100%',
            color: textColor,
            textShadow: lightBg ? 'none' : '0 2px 12px rgba(0,0,0,0.35)',
            textWrap: 'balance',
          }}
        >
          {config.question}
        </h1>
      </header>

      {/* Grid de respostas */}
      <div
        className="absolute left-0 px-20 pb-24"
        style={{
          top: HEADER_H,
          right: showQr ? 360 : 0,
          height: STAGE_H - HEADER_H,
          overflow: 'hidden',
        }}
      >
        {hideResponses ? (
          <div
            className="h-full flex flex-col items-center justify-center gap-4 text-center"
            style={{ color: subtleColor }}
          >
            <span className="text-7xl">{responsesMode === 'on_click' ? '⏸' : '🔒'}</span>
            <p className="text-3xl">
              {responsesMode === 'on_click'
                ? 'Aguardando você liberar'
                : 'Coletando respostas em privado'}
            </p>
            <p className="text-xl">
              {responses.length > 0
                ? `${responses.length} resposta${responses.length === 1 ? '' : 's'} recebida${responses.length === 1 ? '' : 's'}`
                : 'As respostas aparecerão quando você liberar.'}
            </p>
          </div>
        ) : responses.length === 0 ? (
          <div
            className="h-full flex items-center justify-center text-3xl text-center"
            style={{ color: subtleColor }}
          >
            Aguardando respostas...
          </div>
        ) : (
          <ResponseGrid
            responses={responses}
            textColor={textColor}
            subtleColor={subtleColor}
            allowVoting={config.allowVoting === true}
            lightBg={lightBg}
          />
        )}
      </div>

      {/* Connection error pill */}
      {showBackground && connectionState === 'error' ? (
        <div
          className="absolute bottom-12 left-12 flex items-center gap-2 rounded-full bg-black/70 text-white text-sm px-3 py-1.5 pointer-events-none"
          aria-live="polite"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-red-400 animate-pulse" />
          Reconectando ao Realtime
        </div>
      ) : null}

      {/* Footer: contagens */}
      {showBackground ? (
        <div
          className="absolute bottom-12 flex items-center gap-6 text-xl whitespace-nowrap pointer-events-none"
          style={{ color: subtleColor, right: showQr ? 380 : 140 }}
        >
          {config.showTotal && responses.length > 0 ? (
            <span>
              <span className="font-bold tabular-nums" style={{ color: textColor }}>
                {responses.length}
              </span>{' '}
              {responses.length === 1 ? 'resposta' : 'respostas'}
            </span>
          ) : null}
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
              {presence.count > 0 ? presence.count : (previewPresenceCount ?? 0)}
            </span>{' '}
            online
          </span>
        </div>
      ) : null}
    </div>
  );
}

function ResponseGrid({
  responses,
  textColor,
  subtleColor,
  allowVoting,
  lightBg,
}: {
  responses: OpenEndedResponse[];
  textColor: string;
  subtleColor: string;
  allowVoting: boolean;
  lightBg: boolean;
}) {
  // Card bg adapta ao fundo: claro vira card sombreado escuro suave,
  // escuro vira card translúcido branco. Funciona até com slide
  // transparente (mode browser_source / sem fundo).
  const cardBg = lightBg ? 'rgba(10, 24, 52, 0.06)' : 'rgba(255, 255, 255, 0.14)';
  const cardBorder = lightBg ? 'rgba(10, 24, 52, 0.10)' : 'rgba(255, 255, 255, 0.20)';
  // Mais agressivo: 1 resposta = 1 coluna, 2-3 = 2, 4-9 = 3, 10+ = 4.
  // Mentimeter-style — quanto mais respostas, mais densa fica a grid.
  const columnCount =
    responses.length <= 1 ? 1 : responses.length <= 3 ? 2 : responses.length <= 9 ? 3 : 4;
  return (
    <div
      className="h-full"
      style={{
        columnCount,
        columnGap: 16,
      }}
    >
      <AnimatePresence>
        {responses.map((r) => {
          // Font escala com tamanho do texto: respostas curtas ficam maiores
          // (impacto visual), longas menores (cabem no card sem cortar).
          const len = r.text.length;
          const bodyFont = len <= 50 ? 26 : len <= 120 ? 22 : 18;
          return (
            <motion.div
              key={r.id}
              layout
              initial={{ opacity: 0, y: 16, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 22, stiffness: 220, mass: 0.7 }}
              className="mb-4 break-inside-avoid rounded-xl px-4 py-3 shadow-md backdrop-blur"
              style={{ background: cardBg, borderColor: cardBorder, borderWidth: 1 }}
            >
              <p
                className="leading-snug"
                style={{
                  fontFamily:
                    'var(--font-wordcloud), "Plus Jakarta Sans", Inter, system-ui, sans-serif',
                  fontSize: bodyFont,
                  color: textColor,
                }}
              >
                {r.text}
              </p>
              {(r.authorName || (allowVoting && r.voteCount > 0)) && (
                <div className="mt-2 flex items-center justify-between text-sm">
                  <span style={{ color: subtleColor, fontSize: 14 }}>
                    {r.authorName ?? ''}
                  </span>
                  {allowVoting ? (
                    <span
                      className="inline-flex items-center gap-1"
                      style={{ color: subtleColor }}
                    >
                      <svg
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        aria-hidden
                      >
                        <path d="M12 21s-7.5-4.5-9.5-9.2C1.1 8.4 3 5 6.2 5c1.7 0 3.3.9 4.3 2.3C11.5 5.9 13.1 5 14.8 5 18 5 19.9 8.4 18.5 11.8 16.5 16.5 12 21 12 21z" />
                      </svg>
                      <span className="font-semibold tabular-nums">{r.voteCount}</span>
                    </span>
                  ) : null}
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
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
