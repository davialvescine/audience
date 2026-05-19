'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useRef, useState } from 'react';

import { OpenEndedDisplay } from '@/components/telao/OpenEndedDisplay';
import { PollDisplay } from '@/components/telao/PollDisplay';
import { TelaoClient } from '@/components/telao/TelaoClient';
import { backgroundStyle, WordCloudDisplay } from '@/components/telao/WordCloudDisplay';
import type { CommentsConfig, PollConfig } from '@/lib/slides/types';
import { updateSlide } from '@/server-actions/slides';
import type { OpenEndedResponse } from '@/hooks/useOpenEndedResponses';
import type { WordcloudConfig } from '@/hooks/useWordcloudActive';
import type { OpenEndedConfig, Slide } from '@/lib/slides/types';
import type { WordEntry } from '@/lib/wordcloud/types';

type Props = {
  slide: Slide;
  liveConfig?: WordcloudConfig | undefined;
  /** URL pra audiência — passa pro WordCloudDisplay quando QR está habilitado. */
  joinUrl?: string | undefined;
  /** Callback pra alterar a config in-place — usado pelos toggles rápidos da toolbar. */
  onConfigChange?: (cfg: WordcloudConfig) => void;
};

// Sample inspirational pt-BR — exibido no preview enquanto a audiência
// ainda não enviou nada. Tamanhos variados pra mostrar o efeito da nuvem.
const SAMPLE_ENTRIES: WordEntry[] = [
  { text: 'criativo', count: 9 },
  { text: 'líder', count: 7 },
  { text: 'foco', count: 6 },
  { text: 'rápido', count: 5 },
  { text: 'ousado', count: 5 },
  { text: 'inspiração', count: 4 },
  { text: 'energia', count: 3 },
  { text: 'paixão', count: 3 },
  { text: 'transformação', count: 2 },
];

/**
 * Canvas central estilo Mentimeter: 1 slide grande (sem celular embutido).
 * O celular do participante é mostrado num popover separado se o operador
 * quiser ver.
 */
export function SlideCanvas({ slide, liveConfig, joinUrl, onConfigChange }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  const cfg = liveConfig ?? (slide.config as WordcloudConfig);
  // Default = ligado. Operador desliga explicitamente com showQr=false.
  const qrOn = cfg.showQr !== false;
  // Default = ligado. Mostra nuvem de exemplo quando ninguém enviou ainda.
  const sampleOn = cfg.showSampleWords !== false;
  // Estado das opções "ao vivo" — espelha exatamente o que a toolbar do
  // telão tem, pra moderador controlar daqui sem ir pra outra tela.
  const responsesPrivate = cfg.showResponsesMode === 'private';
  const qrFullscreenOn = cfg.qrFullscreen === true;

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const update = () => {
      const sx = el.clientWidth / 1920;
      const sy = el.clientHeight / 1080;
      setScale(Math.max(0.05, Math.min(sx, sy)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={boxRef} className="relative h-full w-full flex items-center justify-center p-6 pb-16">
      <div
        ref={stageRef}
        className="relative shadow-2xl rounded-xl overflow-hidden"
        style={{ width: 1920 * scale, height: 1080 * scale }}
      >
        <div
          style={{
            width: 1920,
            height: 1080,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        >
          {slide.type === 'wordcloud' ? (
            <WordCloudDisplay
              key={sampleOn ? 'sample-on' : 'sample-off'}
              eventId={slide.event_id}
              config={cfg}
              initialEntries={sampleOn ? SAMPLE_ENTRIES : []}
              channel={makeNoopChannel()}
              showBackground
              joinUrl={joinUrl}
              previewPresenceCount={12}
            />
          ) : slide.type === 'open_ended' ? (
            <OpenEndedCanvas
              slide={slide as Slide<'open_ended'>}
              liveConfig={liveConfig as unknown as OpenEndedConfig | undefined}
              joinUrl={joinUrl}
            />
          ) : slide.type === 'comments' ? (
            <CommentsCanvas
              key={slide.id}
              slide={slide as Slide<'comments'>}
              liveConfig={liveConfig as unknown as CommentsConfig | undefined}
              joinUrl={joinUrl}
              stageRef={stageRef}
            />
          ) : slide.type === 'poll' ? (
            <PollCanvas
              key={slide.id}
              slide={slide as Slide<'poll'>}
              liveConfig={liveConfig as unknown as PollConfig | undefined}
              joinUrl={joinUrl}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-ink/5">
              <p className="text-3xl text-ink/40">Tipo {slide.type} ainda sem preview.</p>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar no rodapé do canvas — mesmos controles "ao vivo" que o
          telão tem, pra moderador comandar daqui. + botão de Exemplo que
          é admin-only (não afeta o telão real). */}
      {slide.type === 'wordcloud' && onConfigChange ? (
        // No mobile a toolbar pode ficar maior que o canvas. max-w-[calc(100%-32px)]
        // + overflow-x-auto deixa rolar horizontal sem invadir as bordas.
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-[calc(100%-16px)] overflow-x-auto flex items-center gap-1 rounded-full bg-ink text-paper px-2 py-2 z-20 shadow-lg [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <CanvasBtn
            active={!responsesPrivate}
            onClick={() =>
              onConfigChange({
                ...cfg,
                showResponsesMode: responsesPrivate ? 'instant' : 'private',
              })
            }
            label={responsesPrivate ? 'Mostrar palavras' : 'Ocultar palavras'}
            live
          >
            <svg
              className="h-4 w-4"
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
          </CanvasBtn>

          <CanvasBtn
            active={qrOn}
            onClick={() => onConfigChange({ ...cfg, showQr: !qrOn })}
            label={qrOn ? 'QR lateral' : 'Mostrar QR'}
            live
          >
            <svg
              className="h-4 w-4"
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
          </CanvasBtn>

          <CanvasBtn
            active={qrFullscreenOn}
            onClick={() => onConfigChange({ ...cfg, qrFullscreen: !qrFullscreenOn })}
            label={qrFullscreenOn ? 'QR gigante' : 'QR gigante'}
            live
          >
            <svg
              className="h-4 w-4"
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
          </CanvasBtn>

          {/* Separator */}
          <span className="h-6 w-px bg-paper/15 mx-1" aria-hidden />

          {/* Admin-only — não afeta telão real */}
          <CanvasBtn
            active={sampleOn}
            onClick={() => onConfigChange({ ...cfg, showSampleWords: !sampleOn })}
            label={sampleOn ? 'Exemplo' : 'Exemplo'}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 7h16M4 12h10M4 17h6" />
            </svg>
          </CanvasBtn>
        </div>
      ) : null}

      {/* Toolbar pro slide `comments` — toggles ao vivo (showCardBackground,
          showTitle, showAvatar). Mesmo estilo do wordcloud. */}
      {slide.type === 'comments' ? (
        <CommentsCanvasToolbar
          slide={slide as Slide<'comments'>}
          liveConfig={liveConfig as unknown as CommentsConfig | undefined}
        />
      ) : null}
      {/* Toolbar pro slide `poll` — toggles ao vivo (QR, revelar resultado). */}
      {slide.type === 'poll' ? (
        <PollCanvasToolbar
          slide={slide as Slide<'poll'>}
          liveConfig={liveConfig as unknown as PollConfig | undefined}
        />
      ) : null}
    </div>
  );
}

function CommentsCanvasToolbar({
  slide,
  liveConfig,
}: {
  slide: Slide<'comments'>;
  liveConfig: CommentsConfig | undefined;
}) {
  const cfg: CommentsConfig = (liveConfig ?? slide.config) as CommentsConfig;
  const cardOn = cfg.showCardBackground !== false;
  const titleOn = cfg.showTitle === true;
  const authorOn = cfg.showAvatar !== false;
  const qrOn = cfg.showQr === true;
  const qrFullscreenOn = cfg.qrFullscreen === true;
  const flip = (patch: Partial<CommentsConfig>) => {
    void updateSlide(slide.id, { ...cfg, ...patch } as unknown as Record<string, unknown>);
  };
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-[calc(100%-16px)] overflow-x-auto flex items-center gap-1 rounded-full bg-ink text-paper px-2 py-2 z-20 shadow-lg [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <CanvasBtn
        active={cardOn}
        onClick={() => flip({ showCardBackground: !cardOn })}
        label={cardOn ? 'Fundo do card' : 'Sem fundo do card'}
        live
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="7" width="18" height="10" rx="2" />
          <line x1="7" y1="11" x2="14" y2="11" />
        </svg>
      </CanvasBtn>
      <CanvasBtn
        active={titleOn}
        onClick={() => flip({ showTitle: !titleOn })}
        label={titleOn ? 'Esconder título' : 'Mostrar título'}
        live
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 6h16M4 6v2M20 6v2M12 8v12" />
        </svg>
      </CanvasBtn>
      <CanvasBtn
        active={authorOn}
        onClick={() => flip({ showAvatar: !authorOn })}
        label={authorOn ? 'Esconder autor' : 'Mostrar autor'}
        live
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="8" r="3" />
          <path d="M5 20a7 7 0 0114 0" />
        </svg>
      </CanvasBtn>
      <span className="h-6 w-px bg-paper/15 mx-1" aria-hidden />
      <CanvasBtn
        active={qrOn}
        onClick={() => flip({ showQr: !qrOn })}
        label={qrOn ? 'QR lateral' : 'Mostrar QR'}
        live
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <path d="M14 14h3v3h-3zM20 14h1v1h-1zM14 20h3v1h-3zM20 17h1v4M17 20h1" />
        </svg>
      </CanvasBtn>
      <CanvasBtn
        active={qrFullscreenOn}
        onClick={() => flip({ qrFullscreen: !qrFullscreenOn })}
        label={qrFullscreenOn ? 'QR gigante' : 'QR gigante'}
        live
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <rect x="7" y="7" width="3" height="3" />
          <rect x="14" y="7" width="3" height="3" />
          <rect x="7" y="14" width="3" height="3" />
          <path d="M14 14h2v2M16 16h2M14 18h2v2" />
        </svg>
      </CanvasBtn>
    </div>
  );
}

/**
 * Botão da toolbar do canvas — espelha o estilo da OperatorToolbar do telão.
 * `live` adiciona ponto verde pulsando, indicando que o controle afeta a
 * apresentação em tempo real.
 */
function CanvasBtn({
  active,
  onClick,
  label,
  live,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  live?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`relative inline-flex items-center gap-2 rounded-full px-2.5 sm:px-3 h-9 text-sm font-medium transition shrink-0 ${
        active ? 'bg-paper text-ink' : 'text-paper/85 hover:bg-paper/10'
      }`}
    >
      {children}
      {/* Label escondido em telas muito pequenas pra a toolbar caber. */}
      <span className="hidden sm:inline whitespace-nowrap">{label}</span>
      {live ? (
        <span
          className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-success animate-pulse ring-2 ring-ink"
          aria-hidden
        />
      ) : null}
    </button>
  );
}

const SAMPLE_OPEN_ENDED: OpenEndedResponse[] = [
  {
    id: 'sample-1',
    text: 'Adoro a energia deste evento, muito inspirador!',
    authorName: 'Ana',
    voteCount: 4,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sample-2',
    text: 'A apresentação foi incrível, parabéns!',
    authorName: null,
    voteCount: 2,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'sample-3',
    text: 'Quero mais momentos como esse no próximo encontro.',
    authorName: 'Carlos',
    voteCount: 6,
    createdAt: new Date().toISOString(),
  },
];

function OpenEndedCanvas({
  slide,
  liveConfig,
  joinUrl,
}: {
  slide: Slide<'open_ended'>;
  liveConfig: OpenEndedConfig | undefined;
  joinUrl: string | undefined;
}) {
  const cfg = liveConfig ?? slide.config;
  const sampleOn = cfg.showSampleResponses !== false;
  return (
    <OpenEndedDisplay
      key={sampleOn ? 'sample-on' : 'sample-off'}
      eventId={slide.event_id}
      slideId={slide.id}
      config={cfg}
      initialResponses={sampleOn ? SAMPLE_OPEN_ENDED : []}
      channel={makeNoopOpenEndedChannel()}
      showBackground
      joinUrl={joinUrl}
      previewPresenceCount={12}
    />
  );
}

type ChannelLike = Parameters<typeof WordCloudDisplay>[0]['channel'];
type OpenEndedChannelLike = Parameters<typeof OpenEndedDisplay>[0]['channel'];

function makeNoopOpenEndedChannel(): OpenEndedChannelLike {
  const self: OpenEndedChannelLike = {
    on() {
      return self;
    },
    subscribe() {
      return self;
    },
    unsubscribe() {},
  };
  return self;
}

function makeNoopChannel(): ChannelLike {
  const self: ChannelLike = {
    on() {
      return self;
    },
    subscribe() {
      return self;
    },
    unsubscribe() {},
  };
  return self;
}

/**
 * Preview do slide `comments` no canvas central do editor.
 * Renderiza TelaoClient em preview mode (mostra sample comment + permite
 * drag-to-position). Posição é persistida via autosave do callback.
 */
function CommentsCanvas({
  slide,
  liveConfig,
  joinUrl,
  stageRef,
}: {
  slide: Slide<'comments'>;
  liveConfig: CommentsConfig | undefined;
  joinUrl: string | undefined;
  stageRef: React.RefObject<HTMLDivElement | null>;
}) {
  const cfg = liveConfig ?? slide.config;
  const bg = cfg.background ?? { type: 'none' as const };
  const wrapBg = backgroundStyle(bg);
  const qrOn = cfg.showQr === true;
  const qrFullscreenOn = cfg.qrFullscreen === true;
  const joinHost = (() => {
    if (!joinUrl) return '';
    try {
      return new URL(joinUrl).host;
    } catch {
      return '';
    }
  })();
  return (
    <div className="absolute inset-0" style={wrapBg}>
      <TelaoClient
        slug="preview"
        eventId={slide.event_id}
        eventName=""
        config={cfg}
        preview
        title={cfg.title}
        showTitle={cfg.showTitle === true}
        titleColor={cfg.titleColor}
        titleFontFamily={cfg.titleFontFamily}
        titleShadow={cfg.titleShadow}
        stageRef={stageRef}
        qrSidebarActive={qrOn && !qrFullscreenOn && !!joinUrl}
        onPositionChange={({ posXPct, posYPct }) => {
          void updateSlide(slide.id, { ...cfg, posXPct, posYPct } as unknown as Record<string, unknown>);
        }}
      />
      {qrFullscreenOn && joinUrl ? (
        <div
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-10"
          style={{ background: '#FFFFFF' }}
        >
          <p className="text-4xl font-semibold text-ink/70">Aponte a câmera</p>
          <div className="bg-white p-6 rounded-2xl shadow-2xl border border-ink/10">
            <QRCodeSVG value={joinUrl} size={520} level="M" />
          </div>
          {cfg.showJoinUrl !== false ? (
            <p className="text-3xl font-semibold text-ink">{joinHost}</p>
          ) : null}
        </div>
      ) : null}
      {qrOn && !qrFullscreenOn && joinUrl ? (
        <div
          className="absolute right-12 top-1/2 -translate-y-1/2 z-20 rounded-2xl p-8 flex flex-col items-center gap-5 shadow-2xl"
          style={{ background: '#F5F5F0', color: '#0A1834', minWidth: 280 }}
        >
          <div className="bg-white p-3 rounded-lg">
            <QRCodeSVG value={joinUrl} size={220} level="M" />
          </div>
          {cfg.showJoinUrl !== false ? (
            <p className="text-lg font-semibold">{joinHost}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PollCanvas({
  slide,
  liveConfig,
  joinUrl,
}: {
  slide: Slide<'poll'>;
  liveConfig: PollConfig | undefined;
  joinUrl: string | undefined;
}) {
  const cfg = liveConfig ?? (slide.config as PollConfig);
  // Sample counts pra preview no admin (audiência simulada).
  const sampleCounts = cfg.options.map((_, idx) => {
    if (cfg.correctOption != null && idx === cfg.correctOption) return 12;
    return Math.max(2, 8 - idx * 2);
  });
  return (
    <PollDisplay
      slug="preview"
      slideId={slide.id}
      config={cfg}
      initialCounts={sampleCounts}
      channel={makeNoopChannel() as unknown as Parameters<typeof PollDisplay>[0]['channel']}
      showBackground
      joinUrl={joinUrl}
    />
  );
}

function PollCanvasToolbar({
  slide,
  liveConfig,
}: {
  slide: Slide<'poll'>;
  liveConfig: PollConfig | undefined;
}) {
  const cfg: PollConfig = (liveConfig ?? slide.config) as PollConfig;
  const qrOn = cfg.showQr !== false;
  const qrFullscreenOn = cfg.qrFullscreen === true;
  const revealed = cfg.revealed === true;
  const isAfterReveal = cfg.showResults === 'after_reveal';
  const factCheck = cfg.factCheckMode === true;
  const flip = (patch: Partial<PollConfig>) => {
    void updateSlide(slide.id, { ...cfg, ...patch } as unknown as Record<string, unknown>);
  };
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 max-w-[calc(100%-16px)] overflow-x-auto flex items-center gap-1 rounded-full bg-ink text-paper px-2 py-2 z-20 shadow-lg [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <CanvasBtn
        active={factCheck}
        onClick={() => flip({ factCheckMode: !factCheck })}
        label={factCheck ? 'Modo Fato/Fake (verde/vermelho)' : 'Modo Fato/Fake'}
        live
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      </CanvasBtn>
      {isAfterReveal ? (
        <CanvasBtn
          active={revealed}
          onClick={() => flip({ revealed: !revealed })}
          label={revealed ? 'Esconder resultado' : 'Revelar resultado'}
          live
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </CanvasBtn>
      ) : null}
      <span className="h-6 w-px bg-paper/15 mx-1" aria-hidden />
      <CanvasBtn
        active={qrOn}
        onClick={() => flip({ showQr: !qrOn })}
        label={qrOn ? 'QR lateral' : 'Mostrar QR'}
        live
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <path d="M14 14h3v3h-3zM20 14h1v1h-1zM14 20h3v1h-3zM20 17h1v4M17 20h1" />
        </svg>
      </CanvasBtn>
      <CanvasBtn
        active={qrFullscreenOn}
        onClick={() => flip({ qrFullscreen: !qrFullscreenOn })}
        label="QR gigante (tela cheia)"
        live
      >
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <rect x="7" y="7" width="3" height="3" />
          <rect x="14" y="7" width="3" height="3" />
          <rect x="7" y="14" width="3" height="3" />
          <path d="M14 14h2v2M16 16h2M14 18h2v2" />
        </svg>
      </CanvasBtn>
    </div>
  );
}
