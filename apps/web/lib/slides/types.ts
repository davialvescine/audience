import type { Database } from '@audience/shared-types';

import type { WordcloudBackground, WordcloudConfig } from '@/hooks/useWordcloudActive';

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
  maxLength: 150,
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

/** Discriminated union de configs por tipo de slide. */
export type SlideConfigByType = {
  wordcloud: WordcloudConfig;
  poll: { question: string; options: string[]; allowMultiple: boolean };
  open_ended: OpenEndedConfig;
  rating: { question: string; scaleMin: number; scaleMax: number };
  qa: { question: string };
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
