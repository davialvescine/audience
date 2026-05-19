'use client';

import cloud from 'd3-cloud';
import { AnimatePresence, motion } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useState } from 'react';

import { WordCloudWord } from '@/components/telao/WordCloudWord';
import { useOnlinePresence } from '@/hooks/useOnlinePresence';
import type { WordcloudBackground, WordcloudConfig } from '@/hooks/useWordcloudActive';
import { useWordCounts } from '@/hooks/useWordCounts';
import type { LaidOutWord, WordEntry } from '@/lib/wordcloud/types';

export function backgroundStyle(
  bg: WordcloudBackground | undefined,
): React.CSSProperties | undefined {
  if (!bg || bg.type === 'none') return undefined;
  if (bg.type === 'color') return { background: bg.value };
  if (bg.type === 'gradient')
    return { background: `linear-gradient(135deg, ${bg.from}, ${bg.to})` };
  if (bg.type === 'image') {
    // Background-only style — sem filter/opacity, que são aplicados na
    // camada separada `<BackgroundLayer>` pra não afetar o texto.
    const fit = bg.fit ?? 'cover';
    return {
      backgroundImage: `url(${JSON.stringify(bg.url)})`,
      backgroundSize: fit,
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
      backgroundColor: '#0A2540',
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

/**
 * Layout síncrono — d3-cloud direto no main thread. Mesmo algoritmo que
 * o worker usa, mas executa imediatamente (sem precisar carregar Worker).
 * Pra ~20 palavras roda em <50ms, então não dá pra perceber lag. Pro
 * telão real (100+ palavras), o worker assíncrono pega o relay.
 */
type CloudInput = {
  text: string;
  count: number;
  size: number;
  // d3-cloud escreve essas props de volta em cada word após start().
  x?: number;
  y?: number;
  rotate?: number;
  font?: string;
  padding?: number;
};

function synchronousFallbackLayout(
  entries: WordEntry[],
  paletteSize: number,
  width: number = STAGE_W,
  height: number = CLOUD_H,
): LaidOutWord[] {
  if (entries.length === 0) return [];
  const max = Math.max(...entries.map((e) => e.count));
  // FontSize maior pra a palavra dominante; mínimo legível.
  const maxFont = Math.min(200, width * 0.13);
  const sized: CloudInput[] = entries.map((w) => ({
    text: w.text,
    count: w.count,
    size: 48 + (w.count / max) * (maxFont - 48),
  }));
  let result: LaidOutWord[] = [];
  try {
    cloud<CloudInput>()
      .size([width, height])
      .words(sized)
      // Padding bem apertado — Mentimeter cola as palavras pra parecer uma
      // nuvem densa, não um grid esparso.
      // Padding apertado pra clusterizar (estilo Mentimeter). 8 é o sweet spot:
      // pequeno o bastante pra parecer denso, grande o bastante pra d3-cloud
      // não dropar palavras pequenas em jsdom (testes) e na produção.
      .padding(8)
      .rotate(0) // todas horizontais — Mentimeter-style
      .font('Plus Jakarta Sans, Inter, system-ui, sans-serif')
      .fontWeight(500)
      .fontSize((d) => d.size ?? 16)
      .spiral('archimedean')
      // Deterministic random — primeira palavra (maior) cai exatamente em (0,0).
      .random(() => 0.5)
      .on('end', (laid) => {
        result = laid.map((w, i) => ({
          text: w.text ?? '',
          count: w.count,
          x: w.x ?? 0,
          y: w.y ?? 0,
          fontSize: w.size ?? 16,
          rotate: w.rotate ?? 0,
          colorIdx: i % paletteSize,
        }));
      })
      .start();
  } catch {
    // ignore — fallback do fallback abaixo.
  }
  if (result.length === entries.length) return result;
  // Se d3-cloud descartou palavras (não couberam), use grid simples.
  const cols = Math.ceil(Math.sqrt(entries.length));
  const rows = Math.ceil(entries.length / cols);
  const cellW = (width - 120) / cols;
  const cellH = (height - 120) / rows;
  return entries.map((entry, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      text: entry.text,
      count: entry.count,
      x: -width / 2 + 60 + cellW * (col + 0.5),
      y: -height / 2 + 60 + cellH * (row + 0.5),
      fontSize: sized[i]!.size,
      rotate: 0,
      colorIdx: i % paletteSize,
    };
  });
}

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
  /** Count exibido como "X online" quando não tem presenceChannel (preview/canvas). */
  previewPresenceCount?: number | undefined;
  /** ID do slide ativo — filtra palavras só desse slide. Quando muda,
   *  zera a nuvem e começa fresh (cada slide é uma pergunta independente). */
  slideId?: string | null | undefined;
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
  previewPresenceCount,
  slideId,
}: Props) {
  const { entries, totalSubmissions, connectionState } = useWordCounts(eventId, {
    channel,
    initialEntries,
    slideId,
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
    // d3-cloud no main thread. Quando QR card está visível, encolhe a
    // área de layout pra esquerda pra palavras não invadirem o painel.
    const cloudWidth = config.showQr !== false && joinUrl ? STAGE_W - 360 : STAGE_W;
    setLaid(
      synchronousFallbackLayout(entries, config.palette.length, cloudWidth, CLOUD_H),
    );
  }, [entries, config.palette.length, config.showQr, joinUrl]);

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
      // !important pra sobrescrever o `background: transparent !important`
      // do telao/layout.tsx (necessário pros modos browser_source/H2R).
      html.style.setProperty(css, String(v), 'important');
      body.style.setProperty(css, String(v), 'important');
    });
    return () => {
      html.setAttribute('style', prevHtml);
      body.setAttribute('style', prevBody);
    };
  }, [paintBodyBackground, showBackground, config.background]);

  const bgStyle = showBackground ? backgroundStyle(config.background) : undefined;
  const lightBg = showBackground && isBackgroundLight(config.background);
  const autoTextColor = lightBg ? '#0A1834' : '#FFFFFF';
  const textColor = config.textColorOverride ?? autoTextColor;
  const subtleColor = lightBg ? 'rgba(10,24,52,0.6)' : 'rgba(255,255,255,0.7)';
  const responsesMode = config.showResponsesMode ?? 'instant';
  // 'private' e 'on_click' ambos escondem as palavras do telão. A diferença é
  // só a mensagem mostrada (private = coleta silenciosa; on_click = operador
  // libera quando quiser).
  const hideResponses = responsesMode === 'private' || responsesMode === 'on_click';
  // Blur/opacity da imagem ficam isolados numa camada de fundo, não afetam texto.
  const imageBg = config.background?.type === 'image' ? config.background : null;
  const imageBlur = imageBg?.blurPx ?? 0;
  const imageOpacity = imageBg?.opacity ?? 1;

  const joinLabel = (() => {
    if (!joinUrl) return null;
    try {
      const u = new URL(joinUrl);
      return `${u.host}${u.pathname}`;
    } catch {
      return joinUrl;
    }
  })();
  const joinHost = (() => {
    if (!joinUrl) return '';
    try {
      return new URL(joinUrl).host;
    } catch {
      return joinLabel ?? '';
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
  const joinInfoMode: 'qr' | 'url' | 'code' | 'qr_and_url' =
    config.joinInfoType ?? 'qr_and_url';

  // Default = QR visível. Operador desliga explicitamente com showQr=false.
  const showQr = config.showQr !== false && !!joinUrl && showBackground;
  const qrFullscreen = config.qrFullscreen === true && !!joinUrl && showBackground;

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ color: textColor }}>
      {/* QR FULLSCREEN — sobrepõe tudo. Operador liga antes do evento pra
          audiência escanear de longe; depois desliga e a nuvem aparece. */}
      <AnimatePresence>
        {qrFullscreen && joinUrl ? (
          <motion.div
            key="qr-fullscreen"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-10"
            style={{ background: '#FFFFFF' }}
          >
            <div className="text-center">
              <p className="text-4xl font-semibold text-ink/70 mb-2">
                Aponte a câmera do celular
              </p>
              <p className="text-2xl text-ink/55">e participe agora</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-2xl border border-ink/10">
              <QRCodeSVG value={joinUrl} size={760} level="M" />
            </div>
            <div className="text-center">
              <p className="text-3xl font-semibold text-ink">{joinHost}</p>
              <p
                className="text-6xl font-bold tracking-wider mt-2 tabular-nums text-ink"
                style={{ letterSpacing: '0.08em' }}
              >
                {joinCode}
              </p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {/* Camada de fundo isolada — blur/opacity ficam aqui, não afetam o
          texto da pergunta nem as palavras da nuvem. */}
      {bgStyle ? (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            ...bgStyle,
            filter: imageBlur > 0 ? `blur(${imageBlur}px)` : undefined,
            opacity: imageOpacity,
            // Pequena ampliação pra que o blur não revele bordas brancas.
            transform: imageBlur > 0 ? 'scale(1.05)' : undefined,
          }}
        />
      ) : null}
      {/* QR card lateral — varia conforme joinInfoType:
          qr → só QR · url → só URL · code → só código · qr_and_url → tudo.
          AnimatePresence pra fade+slide suave ao mostrar/esconder. */}
      <AnimatePresence>
      {showQr && joinUrl ? (
        <motion.div
          key="qr-card"
          initial={{ opacity: 0, x: 80, scale: 0.92 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 80, scale: 0.92 }}
          transition={{ type: 'spring', damping: 22, stiffness: 220, mass: 0.7 }}
          className="absolute right-12 top-1/2 -translate-y-1/2 z-20 rounded-2xl p-8 flex flex-col items-center gap-5 shadow-2xl"
          style={{
            background: '#F5F5F0',
            color: '#0A1834',
            minWidth: 280,
          }}
        >
          {joinInfoMode !== 'code' ? (
            <div className="bg-white p-3 rounded-lg">
              <QRCodeSVG value={joinUrl} size={220} level="M" />
            </div>
          ) : null}
          {joinInfoMode !== 'qr' ? (
            <div className="text-center">
              {joinInfoMode === 'url' || joinInfoMode === 'qr_and_url' ? (
                <p className="text-2xl font-semibold" style={{ color: '#0A1834' }}>
                  {joinHost}
                </p>
              ) : null}
              {joinInfoMode === 'code' || joinInfoMode === 'qr_and_url' ? (
                <p
                  className="font-bold tracking-wider mt-1 tabular-nums"
                  style={{
                    color: '#0A1834',
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

      {/* Pergunta colada no topo, sem barra */}
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

      {/* Imagem de conteúdo opcional — canto inferior esquerdo */}
      {config.contentImageUrl ? (
        <img
          src={config.contentImageUrl}
          alt=""
          className="absolute bottom-16 left-16 z-10 max-h-72 max-w-md rounded-lg shadow-2xl"
        />
      ) : null}

      {/* Nuvem ocupa tudo abaixo da pergunta — encolhe da direita se QR estiver visível */}
      <div
        className="absolute left-0 overflow-hidden"
        style={{
          top: HEADER_H,
          height: CLOUD_H,
          right: showQr ? 360 : 0,
        }}
      >
        <AnimatePresence>
          {hideResponses
            ? null
            : laid.map((w) => (
                <WordCloudWord
                  key={w.text}
                  word={w}
                  palette={config.palette}
                  // Centro do container (encolhe quando QR está visível).
                  originX={(showQr ? STAGE_W - 360 : STAGE_W) / 2}
                  originY={CLOUD_H / 2}
                />
              ))}
        </AnimatePresence>

        {hideResponses ? (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-center px-12"
            style={{ color: subtleColor }}
          >
            <span className="text-7xl">{responsesMode === 'on_click' ? '⏸' : '🔒'}</span>
            <p className="text-3xl">
              {responsesMode === 'on_click'
                ? 'Aguardando você liberar'
                : 'Coletando respostas em privado'}
            </p>
            <p className="text-xl">
              {entries.length > 0
                ? `${entries.length} resposta${entries.length === 1 ? '' : 's'} recebida${entries.length === 1 ? '' : 's'}`
                : 'As palavras aparecerão quando você liberar.'}
            </p>
          </div>
        ) : entries.length === 0 ? (
          <div
            className="absolute inset-0 flex items-center justify-center text-3xl text-center px-12"
            style={{ color: subtleColor }}
          >
            Aguardando palavras...
          </div>
        ) : null}
      </div>

      {/* Pill discreta no canto inferior esquerdo quando Realtime cai —
          avisa o operador sem bloquear o telão. */}
      {showBackground && connectionState === 'error' ? (
        <div
          className="absolute bottom-12 left-12 flex items-center gap-2 rounded-full bg-black/70 text-white text-sm px-3 py-1.5 pointer-events-none"
          aria-live="polite"
        >
          <span className="inline-block h-2 w-2 rounded-full bg-red-400 animate-pulse" />
          Reconectando ao Realtime
        </div>
      ) : null}

      {/* Footer: só contagens à direita. URL/link do participante mora no
          QR card, então não duplica aqui. */}
      {showBackground && joinLabel ? (
        <div
          className="absolute bottom-12 flex items-center gap-6 text-xl whitespace-nowrap pointer-events-none"
          style={{
            color: subtleColor,
            right: showQr ? 380 : 140,
          }}
        >
            {config.showTotal && entries.length > 0 ? (
              <span>
                <span className="font-bold tabular-nums" style={{ color: textColor }}>
                  {entries.length}
                </span>{' '}
                {entries.length === 1 ? 'palavra' : 'palavras'}
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
