// File kept ONLY for the WordcloudConfig + WordcloudBackground types that
// are widely used across the slides system. The original useWordcloudActive
// hook (legacy events.wordcloud_active/_config polling) was removed — every
// wordcloud now lives in a slide row.

export type WordcloudBackground =
  | { type: 'none' }
  | { type: 'color'; value: string }
  | { type: 'gradient'; from: string; to: string }
  | { type: 'image'; url: string; fit?: 'cover' | 'contain'; opacity?: number; blurPx?: number };

export type WordcloudConfig = {
  question: string;
  /** Quantas palavras o participante pode enviar por slide.
   *  - 1..5: número fixo de campos visíveis na audiência.
   *  - 'unlimited': mostra 3 campos iniciais + audiência pode enviar
   *    quantas quiser repetindo o envio. */
  maxWordsPerSubmission: 1 | 2 | 3 | 4 | 5 | 'unlimited';
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
