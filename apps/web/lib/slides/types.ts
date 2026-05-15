import type { Database } from '@audience/shared-types';

import type { WordcloudConfig } from '@/hooks/useWordcloudActive';

export type SlideType = Database['public']['Enums']['slide_type'];

/** Discriminated union de configs por tipo de slide. V1 só implementa wordcloud. */
export type SlideConfigByType = {
  wordcloud: WordcloudConfig;
  poll: { question: string; options: string[]; allowMultiple: boolean };
  open_ended: { question: string; maxLength: number };
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
