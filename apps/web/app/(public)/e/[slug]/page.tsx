import { notFound } from 'next/navigation';

import { PublicEventShell } from '@/components/audience/PublicEventShell';
import { ThemeProvider } from '@/components/ui/ThemeProvider';
import type { OpenEndedResponse } from '@/hooks/useOpenEndedResponses';
import type { WordcloudConfig } from '@/hooks/useWordcloudActive';
import { DEFAULT_OPEN_ENDED_CONFIG, type OpenEndedConfig } from '@/lib/slides/types';
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
  let activeSlideType: 'wordcloud' | 'open_ended' | null = null;
  let openEndedConfig: OpenEndedConfig | null = null;
  let openEndedInitialResponses: OpenEndedResponse[] = [];
  if (activeSlideId) {
    const { data: slideRow } = await supabase
      .from('slides')
      .select('config, type')
      .eq('id', activeSlideId)
      .maybeSingle();
    if (slideRow?.type === 'wordcloud') {
      activeSlideConfig = (slideRow.config as WordcloudConfig | null) ?? null;
      activeSlideType = 'wordcloud';
    } else if (slideRow?.type === 'open_ended') {
      openEndedConfig = {
        ...DEFAULT_OPEN_ENDED_CONFIG,
        ...((slideRow.config as Partial<OpenEndedConfig>) ?? {}),
      };
      activeSlideType = 'open_ended';
      type RpcRow = { id: string; text: string; author_name: string | null; vote_count: number; created_at: string };
      const { data: rows } = (await (supabase.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: RpcRow[] | null; error: { message: string } | null }>)('get_open_ended_state', {
        p_slug: slug,
        p_slide_id: activeSlideId,
      })) as { data: RpcRow[] | null };
      openEndedInitialResponses = (rows ?? []).map((r) => ({
        id: r.id,
        text: r.text,
        authorName: r.author_name,
        voteCount: Number(r.vote_count),
        createdAt: r.created_at,
      }));
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
        activeSlideType={activeSlideType}
        activeSlideConfig={activeSlideConfig}
        openEndedConfig={openEndedConfig}
        openEndedInitialResponses={openEndedInitialResponses}
        forceMode={forceMode}
      />
    </ThemeProvider>
  );
}
