import { notFound } from 'next/navigation';

import { PublicEventShell } from '@/components/audience/PublicEventShell';
import { ThemeProvider } from '@/components/ui/ThemeProvider';
import type { WordcloudConfig } from '@/hooks/useWordcloudActive';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import { loadTheme } from '@/lib/themes/loadTheme';

type Params = { slug: string };

const DEFAULT_WORDCLOUD_CONFIG: WordcloudConfig = {
  question: 'Em uma palavra, o que você espera deste evento?',
  maxWordsPerSubmission: 1,
  filterStopwords: true,
  filterProfanity: true,
  palette: ['#FF6B6B', '#4ECDC4', '#FFE66D', '#95E1D3', '#F38181', '#AA96DA', '#FCBAD3', '#A8E6CF'],
  showTotal: true,
};

export default async function PublicEventPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const supabase = getSupabaseServiceClient();
  const { data: events } = await supabase.rpc('get_event_by_slug', { p_slug: slug });
  const event = events?.[0];
  if (!event) notFound();

  // Wordcloud fields are not yet in generated DB types; fetch via direct
  // table query with a cast until `pnpm db:types` is re-run after the
  // 00330000/00340000 migrations are applied.
  const { data: wcRow } = await (supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          maybeSingle: () => Promise<{
            data: { wordcloud_active?: boolean; wordcloud_config?: WordcloudConfig } | null;
          }>;
        };
      };
    };
  })
    .from('events')
    .select('wordcloud_active, wordcloud_config')
    .eq('slug', slug)
    .maybeSingle();

  const wordcloudActive = wcRow?.wordcloud_active ?? false;
  const wordcloudConfig = wcRow?.wordcloud_config ?? DEFAULT_WORDCLOUD_CONFIG;

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
      />
    </ThemeProvider>
  );
}
