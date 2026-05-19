'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useMemo, useState } from 'react';

import { FullscreenButton } from '@/components/telao/FullscreenButton';
import { StatsBadge } from '@/components/telao/StatsBadge';
import { TelaoClient } from '@/components/telao/TelaoClient';
import { backgroundStyle } from '@/components/telao/WordCloudDisplay';
import { useActiveSlideConfig } from '@/hooks/useActiveSlideConfig';
import { useOnlinePresence } from '@/hooks/useOnlinePresence';
import { getSupabaseBrowserClient, getSupabaseRealtimeClient } from '@/lib/supabase/browser';
import { DEFAULT_COMMENTS_CONFIG, type CommentsConfig } from '@/lib/slides/types';

type ChannelLike = NonNullable<Parameters<typeof useActiveSlideConfig>[1]['channel']>;

type Props = {
  slug: string;
  eventId: string;
  eventName: string;
  initialActiveSlideId: string;
  initialConfig: CommentsConfig;
  intervalSeconds: number;
  /** Quando true, pinta o fundo do slide (config.background) atrás do TelaoClient.
   *  Em modo browser_source (?mode=browser_source), passar false pra manter
   *  transparência absoluta. */
  showBackground: boolean;
  /** URL pública pra audiência escanear via QR. Quando undefined ou em modo
   *  browser_source (sem fundo), o QR não é exibido. */
  joinUrl?: string | undefined;
  isOperator?: boolean | undefined;
};

/**
 * Wrapper realtime do TelaoClient pro slide `comments`. Escuta
 * `useActiveSlideConfig` pra atualizar config ao vivo (cor, fonte, posição,
 * título, etc.) sem refresh.
 */
export function TelaoCommentsSwitcher({
  slug,
  eventId,
  eventName,
  initialActiveSlideId,
  initialConfig,
  intervalSeconds,
  showBackground,
  joinUrl,
  isOperator,
}: Props) {
  const [channel, setChannel] = useState<ChannelLike | undefined>(undefined);
  type PresenceChannel = NonNullable<Parameters<typeof useOnlinePresence>[0]['channel']>;
  const [presenceChannel, setPresenceChannel] = useState<PresenceChannel | undefined>(undefined);
  const [commentsCount, setCommentsCount] = useState(0);

  useEffect(() => {
    const rt = getSupabaseRealtimeClient();
    const ts = Date.now();
    const ch = rt.channel(`telao:${eventId}:cmts:${ts}`) as unknown as ChannelLike;
    const pres = rt.channel(`presence:event:${eventId}`, {
      config: { presence: { key: '' } },
    }) as unknown as PresenceChannel;
    setChannel(ch);
    setPresenceChannel(pres);
    return () => {
      ch?.unsubscribe();
      pres?.unsubscribe();
    };
  }, [eventId]);

  // Polling do contador de comentários sent. Anon-friendly via RPC
  // count_event_sent_submissions (security definer). 3s é discreto.
  useEffect(() => {
    if (!showBackground) return;
    const sb = getSupabaseBrowserClient();
    let cancelled = false;
    const fetchCount = async () => {
      const { data } = await sb.rpc('count_event_sent_submissions' as never, {
        p_slug: slug,
      } as never);
      if (cancelled) return;
      const n = typeof data === 'number' ? data : Number(data ?? 0);
      setCommentsCount(n);
    };
    void fetchCount();
    const id = setInterval(fetchCount, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [slug, showBackground]);

  const slide = useActiveSlideConfig(eventId, {
    initialActiveSlideId,
    initialActiveType: 'comments',
    // Passamos como WordcloudConfig só pelo shape do hook — na prática
    // armazena um CommentsConfig. Cast abaixo no consumo.
    initialActiveConfig: initialConfig as unknown as never,
    channel,
  });

  // useMemo estabiliza a referência de merged. Estratégia:
  // - Se slide.activeSlideId (vindo do hook) BATE com o slide do SSR (mesma sessão),
  //   usa slide.config do hook (pega updates em tempo real).
  // - Se NÃO bate (hook ainda não atualizou após troca de slide), usa initialConfig
  //   do SSR — evita mostrar config do slide ANTERIOR enquanto o hook async não
  //   recebeu o config do slide novo.
  const slideConfigKey = JSON.stringify(slide.config);
  const initialConfigKey = JSON.stringify(initialConfig);
  const sameSlide = slide.activeSlideId === initialActiveSlideId;
  const merged: CommentsConfig = useMemo(() => {
    const source =
      sameSlide && slide.activeType === 'comments' && slide.config
        ? (slide.config as Partial<CommentsConfig>)
        : initialConfig;
    return { ...DEFAULT_COMMENTS_CONFIG, ...(source ?? {}) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideConfigKey, initialConfigKey, slide.activeType, sameSlide]);

  const wrapStyle = showBackground
    ? backgroundStyle(merged.background ?? { type: 'none' })
    : undefined;

  // QR só faz sentido quando há joinUrl + estamos pintando fundo (no OBS,
  // showBackground=false → QR off pra não bagunçar a sobreposição).
  // Default = off (escondido). Admin liga explicitamente pelo toggle.
  const qrEnabled = !!joinUrl && showBackground;
  const showQr = qrEnabled && merged.showQr === true;
  const qrFullscreen = qrEnabled && merged.qrFullscreen === true;
  const joinHost = useMemo(() => {
    if (!joinUrl) return '';
    try {
      return new URL(joinUrl).host;
    } catch {
      return '';
    }
  }, [joinUrl]);

  return (
    <div className="absolute inset-0" style={wrapStyle}>
      <TelaoClient
        slug={slug}
        eventId={eventId}
        eventName={eventName}
        config={merged}
        intervalSeconds={intervalSeconds}
        title={merged.title}
        showTitle={merged.showTitle === true}
        titleColor={merged.titleColor}
        titleFontFamily={merged.titleFontFamily}
        titleShadow={merged.titleShadow}
        titleSizePx={merged.titleSizePx}
        qrSidebarActive={showQr && !qrFullscreen}
      />
      {qrFullscreen && joinUrl ? (
        <div
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
            <QRCodeSVG value={joinUrl} size={520} level="M" />
          </div>
          {merged.showJoinUrl !== false ? (
            <p className="text-3xl font-semibold text-ink">{joinHost}</p>
          ) : null}
        </div>
      ) : null}
      {showBackground && presenceChannel ? (
        <StatsBadge
          presenceChannel={presenceChannel}
          count={commentsCount}
          label="comentário"
          color={merged.cardText}
        />
      ) : null}
      {showBackground && isOperator ? <FullscreenButton /> : null}
      {showQr && !qrFullscreen && joinUrl ? (
        <div
          className="absolute right-12 top-1/2 -translate-y-1/2 z-20 rounded-2xl p-8 flex flex-col items-center gap-5 shadow-2xl"
          style={{ background: '#F5F5F0', color: '#0A1834', minWidth: 280 }}
        >
          <div className="bg-white p-3 rounded-lg">
            <QRCodeSVG value={joinUrl} size={220} level="M" />
          </div>
          {merged.showJoinUrl !== false ? (
            <div className="text-center">
              <p className="text-lg font-semibold">{joinHost}</p>
              <p className="text-sm opacity-70 mt-1">Aponte sua câmera</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
