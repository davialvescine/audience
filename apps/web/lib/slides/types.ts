import type { Database } from '@audience/shared-types';

import type { WordcloudBackground, WordcloudConfig } from '@/hooks/useWordcloudActive';
import { DEFAULT_TELAO_CONFIG, type TelaoConfig } from '@/lib/telao/config';

export type SlideType = Database['public']['Enums']['slide_type'];

export type OpenEndedConfig = {
  question: string;
  maxLength: number; // default 150
  numberOfResponses: 'unlimited' | 1 | 2 | 3 | 4 | 5; // default 'unlimited'
  autoScroll?: boolean; // default true
  allowVoting?: boolean; // default false
  askForName?: boolean; // default false
  showSampleResponses?: boolean; // admin-only preview toggle
  // Mesmo bloco visual/UX que wordcloud reusa.
  showResponsesMode?: 'instant' | 'on_click' | 'private';
  showQr?: boolean;
  qrFullscreen?: boolean;
  joinInfoType?: 'qr' | 'url' | 'code' | 'qr_and_url';
  background?: WordcloudBackground;
  textColorOverride?: string;
  contentImageUrl?: string;
  showTotal?: boolean;
};

export const DEFAULT_OPEN_ENDED_CONFIG: OpenEndedConfig = {
  question: 'Compartilhe sua resposta',
  // 200 chars — cabe uma frase confortável (média 100-150) com folga pra
  // 2 frases curtas. Slido usa 160, Mentimeter 250; 200 fica no meio
  // sem incentivar respostas longas demais que viram muros de texto no telão.
  maxLength: 200,
  numberOfResponses: 'unlimited',
  autoScroll: true,
  allowVoting: false,
  askForName: false,
  showSampleResponses: true,
  showResponsesMode: 'instant',
  showQr: true,
  qrFullscreen: false,
  joinInfoType: 'qr_and_url',
  showTotal: true,
};

/**
 * Config do slide "Cards rotativos" (`comments`). Reaproveita 100% do TelaoConfig
 * existente (fonte, cor, posição, animação, duração) + 2 flags próprias:
 * - showTitle: se mostra um título acima do card (default false)
 * - title: texto do título quando showTitle=true
 * - background: fundo do slide (default sem fundo pra OBS funcionar)
 *
 * Mesmo slide vira overlay OBS ou fullscreen só mudando toggles no painel —
 * sem variantes de tipo. background opcional reusa WordcloudBackground.
 */
export type CommentsConfig = TelaoConfig & {
  showTitle?: boolean;
  title?: string;
  /** Cor do título — separada de cardText pra não somer no fundo transparente. */
  titleColor?: string;
  background?: WordcloudBackground;
  /** Quando false, o card flutua com texto puro (sem caixa de fundo). Útil
   *  pra overlay no OBS onde só os textos devem aparecer sobre a apresentação. */
  showCardBackground?: boolean;
  /** Mostra overlay de QR + URL no canto pra audiência escanear durante o slide. */
  showQr?: boolean;
  /** Quando ligado, QR ocupa a tela toda (chamada à ação grande). */
  qrFullscreen?: boolean;
  /** Quando false, omite o host/URL abaixo do QR — útil pra slide mais clean. */
  showJoinUrl?: boolean;
  /** Pausa a rotação automática dos cards no telão (útil pra dar tempo de ler). */
  paused?: boolean;
};

export const DEFAULT_COMMENTS_CONFIG: CommentsConfig = {
  ...DEFAULT_TELAO_CONFIG,
  maxConcurrent: 1,
  showTitle: false,
  title: '',
  showCardBackground: true,
  // Default escuro funciona bem em fundo branco/transparente do OBS.
  // Operador pode mudar pra contraste com fundo customizado.
  titleColor: '#0A2540',
};

/** Discriminated union de configs por tipo de slide. */
export type SlideConfigByType = {
  wordcloud: WordcloudConfig;
  poll: { question: string; options: string[]; allowMultiple: boolean };
  open_ended: OpenEndedConfig;
  rating: { question: string; scaleMin: number; scaleMax: number };
  qa: { question: string };
  comments: CommentsConfig;
};

export type Slide<T extends SlideType = SlideType> = {
  id: string;
  event_id: string;
  type: T;
  position: number;
  config: SlideConfigByType[T];
  created_at: string;
  updated_at: string;
};

export type ActiveSlide = {
  slide_id: string | null;
  slide_type: SlideType | null;
  config: unknown;
  event_id: string;
  event_name: string;
};
