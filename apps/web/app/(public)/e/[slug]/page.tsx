import { notFound } from 'next/navigation';

import { PublicEventShell } from '@/components/audience/PublicEventShell';
import { ThemeProvider } from '@/components/ui/ThemeProvider';
import type { WordcloudConfig } from '@/hooks/useWordcloudActive';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import { loadTheme } from '@/lib/themes/loadTheme';

type Params = { slug: string };
type SearchParams = { mode?: string };

const DEFAULT_WORDCLOUD_CONFIG: WordcloudConfig = {
  question: 'Em uma palavra, o que você espera deste evento?',
  maxWordsPerSubmission: 1,
  filterStopwords: true,
  filterProfanity: true,
  palette: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3', '#A8E6CF'],
  showTotal: true,
};

export default async function PublicEventPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<SearchParams>;
}) {
  const { slug } = await params;
  const { mode } = await searchParams;
  const forceMode: 'auto' | 'comments' | 'slides' =
    mode === 'comments' ? 'comments' : mode === 'slides' ? 'slides' : 'auto';
  const supabase = getSupabaseServiceClient();
  const { data: events } = await supabase.rpc('get_event_by_slug', { p_slug: slug });
  const event = events?.[0];
  if (!event) notFound();

  const { data: wcRow } = await supabase
    .from('events')
    .select('wordcloud_active, wordcloud_config, active_slide_id')
    .eq('slug', slug)
    .maybeSingle();

  const wordcloudActive = wcRow?.wordcloud_active ?? false;
  const wordcloudConfig =
    (wcRow?.wordcloud_config as WordcloudConfig | null) ?? DEFAULT_WORDCLOUD_CONFIG;
  const activeSlideId = wcRow?.active_slide_id ?? null;

  let activeSlideConfig: WordcloudConfig | null = null;
  if (activeSlideId) {
    const { data: slideRow } = await supabase
      .from('slides')
      .select('config, type')
      .eq('id', activeSlideId)
      .maybeSingle();
    if (slideRow && slideRow.type === 'wordcloud') {
      activeSlideConfig = (slideRow.config as WordcloudConfig | null) ?? null;
    }
  }

  const theme = await loadTheme(event.theme_id);
  if (!theme) notFound();

  return (
    <ThemeProvider tokens={theme}>
      <PublicEventShell
        eventName={event.name}
        slug={event.slug}
        eventId={event.id}
        submissionsOpen={event.submissions_open}
        wordcloudActive={wordcloudActive}
        wordcloudConfig={wordcloudConfig}
        activeSlideId={activeSlideId}
        activeSlideConfig={activeSlideConfig}
        forceMode={forceMode}
      />
    </ThemeProvider>
  );
}
