'use client';

import { useEffect, useState } from 'react';

export type WordcloudBackground =
  | { type: 'none' }
  | { type: 'color'; value: string }
  | { type: 'gradient'; from: string; to: string }
  | { type: 'image'; url: string; fit?: 'cover' | 'contain'; opacity?: number; blurPx?: number };

export type WordcloudConfig = {
  question: string;
  maxWordsPerSubmission: 1 | 2 | 3;
  filterStopwords: boolean;
  filterProfanity: boolean;
  palette: string[];
  showTotal: boolean;
  /** Mostra QR code + URL pra audiência entrar no canto direito do telão. */
  showQr?: boolean | undefined;
  background?: WordcloudBackground | undefined;
  /** Quando 'instant' (default), palavras aparecem assim que enviadas.
   *  'private' esconde palavras do telão (operador vê em Results) — útil
   *  pra coletar antes de revelar. 'on_click' renderiza só após interação
   *  do operador (placeholder por enquanto, V2). */
  showResponsesMode?: 'instant' | 'private' | 'on_click' | undefined;
  /** Override da cor do texto (pergunta + palavras). Se undefined,
   *  contraste automático em cima do fundo. */
  textColorOverride?: string | undefined;
  /** Imagem opcional sobre o slide (canto / centro) — Menti 'content image'. */
  contentImageUrl?: string | undefined;
  /** Tipo de 'join info' mostrado no telão. */
  joinInfoType?: 'qr' | 'url' | 'code' | 'qr_and_url' | undefined;
  /** Notas privadas do apresentador — só visível no admin. */
  speakerNotes?: string | undefined;
  /** Quando true (default), mostra nuvem de exemplo no telão enquanto a
   *  audiência ainda não enviou palavras. Útil pra demonstrar o que vai
   *  acontecer. Operador pode esconder via toolbar pra ficar limpo. */
  showSampleWords?: boolean | undefined;
  /** Quando true, sobrepõe um QR code GIGANTE centralizado no telão pra
   *  audiência escanear de longe. Esconde o resto do slide. Operador
   *  liga via toolbar antes do evento, depois desliga pra começar. */
  qrFullscreen?: boolean | undefined;
};

type ChannelLike = {
  on: (
    event: string,
    filter: { table?: string; event?: string; schema?: string; filter?: string },
    cb: (payload: {
      eventType: string;
      new: Record<string, unknown>;
      old: Record<string, unknown>;
      table: string;
    }) => void,
  ) => ChannelLike;
  subscribe: (statusCb?: (status: string) => void) => ChannelLike;
  unsubscribe: () => void;
};

export type UseWordcloudActiveOptions = {
  initialActive: boolean;
  initialConfig: WordcloudConfig;
  /**
   * Optional pre-built channel. Tests inject a fake channel; production code
   * builds a real Supabase channel inside this hook (via factory).
   */
  channel?: ChannelLike | undefined;
};

export function useWordcloudActive(
  eventId: string,
  opts: UseWordcloudActiveOptions,
): { active: boolean; config: WordcloudConfig } {
  const [active, setActive] = useState(opts.initialActive);
  const [config, setConfig] = useState<WordcloudConfig>(opts.initialConfig);

  useEffect(() => {
    const channel = opts.channel;
    if (!channel) return;

    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'events', filter: `id=eq.${eventId}` },
        (payload) => {
          const row = payload.new as {
            id?: string;
            wordcloud_active?: boolean;
            wordcloud_config?: WordcloudConfig;
          };
          if (!row || row.id !== eventId) return;
          if (typeof row.wordcloud_active === 'boolean') setActive(row.wordcloud_active);
          if (row.wordcloud_config) setConfig(row.wordcloud_config);
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [eventId, opts.channel]);

  return { active, config };
}
