import { notFound } from 'next/navigation';

import { PublicEventShell } from '@/components/audience/PublicEventShell';
import { ThemeProvider } from '@/components/ui/ThemeProvider';
import { getSupabaseServiceClient } from '@/lib/supabase/service';
import { loadTheme } from '@/lib/themes/loadTheme';

type Params = { slug: string };

export default async function PublicEventPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const supabase = getSupabaseServiceClient();
  const { data: events } = await supabase.rpc('get_event_by_slug', { p_slug: slug });
  const event = events?.[0];
  if (!event) notFound();

  const theme = await loadTheme(event.theme_id);
  if (!theme) notFound();

  return (
    <ThemeProvider tokens={theme}>
      <PublicEventShell
        eventName={event.name}
        slug={event.slug}
        submissionsOpen={event.submissions_open}
      />
    </ThemeProvider>
  );
}
