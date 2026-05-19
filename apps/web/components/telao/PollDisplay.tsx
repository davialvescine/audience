'use client';

import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useMemo, useState } from 'react';

import { backgroundStyle } from '@/components/telao/WordCloudDisplay';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { PollConfig } from '@/lib/slides/types';

type ChannelLike = {
  on: (
    event: string,
    filter: { table?: string; event?: string; schema?: string; filter?: string },
    cb: (payload: { eventType: string; new: Record<string, unknown> }) => void,
  ) => ChannelLike;
  subscribe: () => ChannelLike;
  unsubscribe: () => void;
};

type Props = {
  slug: string;
  slideId: string;
  config: PollConfig;
  initialCounts: number[];
  channel: ChannelLike;
  showBackground: boolean;
  joinUrl?: string | undefined;
  isOperator?: boolean | undefined;
  /** Callback opcional pra reportar o total de votos ao parent — usado
   *  pela StatsBadge do TelaoPollSwitcher. */
  onTotalChange?: ((total: number) => void) | undefined;
};

export function PollDisplay({
  slug,
  slideId,
  config,
  initialCounts,
  channel,
  showBackground,
  joinUrl,
  isOperator: _isOperator,
  onTotalChange,
}: Props) {
  void _isOperator;
  const [counts, setCounts] = useState<number[]>(initialCounts);

  useEffect(() => {
    onTotalChange?.(counts.reduce((a, b) => a + b, 0));
  }, [counts, onTotalChange]);

  // Realtime: escuta INSERT/UPDATE em poll_votes desse slide.
  useEffect(() => {
    if (!channel) return;
    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'poll_votes', filter: `slide_id=eq.${slideId}` },
        () => {
          void refetch();
        },
      )
      .subscribe();
    const refetch = async () => {
      const sb = getSupabaseBrowserClient();
      const { data } = await sb.rpc('get_poll_state', { p_slug: slug, p_slide_id: slideId });
      const rows = (data ?? []) as Array<{ option_index: number; vote_count: number | string }>;
      const next = Array(config.options.length).fill(0) as number[];
      for (const r of rows) {
        if (r.option_index >= 0 && r.option_index < next.length) {
          next[r.option_index] = Number(r.vote_count);
        }
      }
      setCounts(next);
    };
    return () => {
      channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, slideId, slug, config.options.length]);

  // Polling fallback 2s.
  useEffect(() => {
    let cancelled = false;
    const sb = getSupabaseBrowserClient();
    const poll = async () => {
      const { data } = await sb.rpc('get_poll_state', { p_slug: slug, p_slide_id: slideId });
      if (cancelled) return;
      const rows = (data ?? []) as Array<{ option_index: number; vote_count: number | string }>;
      const next = Array(config.options.length).fill(0) as number[];
      for (const r of rows) {
        if (r.option_index >= 0 && r.option_index < next.length) {
          next[r.option_index] = Number(r.vote_count);
        }
      }
      setCounts((prev) =>
        prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next,
      );
    };
    const id = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [slug, slideId, config.options.length]);

  const total = counts.reduce((a, b) => a + b, 0);
  const showResults =
    config.showResults === 'instant' || (config.showResults === 'after_reveal' && config.revealed === true);
  const revealCorrect = showResults && config.correctOption != null;

  const wrapStyle = showBackground
    ? backgroundStyle(config.background ?? { type: 'color', value: '#0A2540' })
    : undefined;

  const joinHost = useMemo(() => {
    if (!joinUrl) return '';
    try {
      return new URL(joinUrl).host;
    } catch {
      return '';
    }
  }, [joinUrl]);
  const qrEnabled = !!joinUrl && showBackground && config.showQr !== false;
  const qrFullscreen = qrEnabled && config.qrFullscreen === true;

  return (
    <div className="absolute inset-0 flex flex-col" style={wrapStyle}>
      {/* Pergunta */}
      <div className="px-16 pt-16 pb-8">
        <h1
          style={{ color: config.textColorOverride ?? '#FFFFFF' }}
          className="text-6xl font-display font-bold leading-tight text-center"
        >
          {config.question}
        </h1>
      </div>

      {/* Opções */}
      <div className="flex-1 flex flex-col justify-center gap-6 px-16 pb-16 pr-12">
        {config.options.map((opt, idx) => {
          const count = counts[idx] ?? 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          const isCorrect = revealCorrect && idx === config.correctOption;
          const isWrong = revealCorrect && config.correctOption != null && idx !== config.correctOption;
          // Cores no modo factCheck: verde pra correta, vermelho pra erradas após reveal.
          const baseBg = config.factCheckMode
            ? idx === 0
              ? '#10b981' // verde "Fato"
              : '#ef4444' // vermelho "Fake"
            : '#3a3a4e';
          const bg = isCorrect ? '#10b981' : isWrong ? '#6b7280' : baseBg;
          const opacity = revealCorrect && isWrong ? 0.4 : 1;
          return (
            <div key={idx} className="relative">
              <div
                className="rounded-2xl px-8 py-8 transition-all duration-500 flex items-center justify-between gap-6"
                style={{ background: bg, opacity }}
              >
                <span className="text-5xl font-bold text-white flex-1">
                  {opt || `Opção ${idx + 1}`}
                </span>
                {showResults ? (
                  <div className="flex items-center gap-4 shrink-0">
                    <span className="text-5xl font-bold text-white tabular-nums">{pct}%</span>
                    <span className="text-2xl text-white/70 tabular-nums">({count})</span>
                  </div>
                ) : (
                  <span className="text-2xl text-white/60">{count} {count === 1 ? 'voto' : 'votos'}</span>
                )}
              </div>
              {/* Barra de progresso visual sob o card. */}
              {showResults && total > 0 ? (
                <div
                  className="absolute bottom-0 left-0 h-1.5 rounded-b-2xl transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: 'rgba(255,255,255,0.8)',
                  }}
                />
              ) : null}
            </div>
          );
        })}

        {!showResults && config.showResults === 'after_reveal' ? (
          <p className="text-center text-2xl text-white/60 mt-4">
            Aguardando o apresentador revelar a resposta...
          </p>
        ) : null}
      </div>

      {/* Total + QR */}
      {showResults ? (
        <div className="absolute top-8 left-8 px-4 py-2 rounded-full bg-white/10 text-white text-xl backdrop-blur">
          <strong className="tabular-nums">{total}</strong> {total === 1 ? 'voto' : 'votos'}
        </div>
      ) : null}

      {qrFullscreen && joinUrl ? (
        <div
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-10"
          style={{ background: '#FFFFFF' }}
        >
          <p className="text-4xl font-semibold text-ink/70">Aponte a câmera</p>
          <div className="bg-white p-6 rounded-2xl shadow-2xl border border-ink/10">
            <QRCodeSVG value={joinUrl} size={760} level="M" />
          </div>
          <p className="text-3xl font-semibold text-ink">{joinHost}</p>
        </div>
      ) : null}
      {qrEnabled && !qrFullscreen && joinUrl ? (
        <div className="absolute right-12 bottom-12 z-20 rounded-2xl p-6 flex flex-col items-center gap-3 shadow-2xl bg-white">
          <div className="bg-white p-2 rounded-lg">
            <QRCodeSVG value={joinUrl} size={180} level="M" />
          </div>
          <p className="text-base font-semibold text-ink">{joinHost}</p>
        </div>
      ) : null}
    </div>
  );
}
