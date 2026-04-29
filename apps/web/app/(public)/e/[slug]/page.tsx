import { notFound } from 'next/navigation';

import { SubmissionForm } from '@/components/audience/SubmissionForm';
import { BrandHeader } from '@/components/ui/BrandHeader';
import { Card } from '@/components/ui/Card';
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
      <div className="min-h-screen bg-surface">
        <BrandHeader title={event.name} subtitle="Mande sua mensagem para o telão" />
        <main className="max-w-md mx-auto px-4 py-8 -mt-8 relative z-10">
          <Card>
            {event.submissions_open ? (
              <SubmissionForm slug={event.slug} />
            ) : (
              <p className="text-center text-ink/60">Submissões encerradas.</p>
            )}
          </Card>
        </main>
      </div>
    </ThemeProvider>
  );
}
