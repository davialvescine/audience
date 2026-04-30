import { headers } from 'next/headers';

import { getSupabaseServiceClient } from '@/lib/supabase/service';

/**
 * vMix uses .vmix preset files (XML). This generates a minimal preset with one Browser input
 * pointed at our /telao/[slug] page. User imports via vMix → "Open Preset".
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = getSupabaseServiceClient();
  const { data: events } = await supabase.rpc('get_event_by_slug', { p_slug: slug });
  const event = events?.[0];
  if (!event) return new Response('Not found', { status: 404 });

  const reqHeaders = await headers();
  const host = reqHeaders.get('host') ?? 'localhost:3000';
  const proto = reqHeaders.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  const telaoUrl = `${proto}://${host}/telao/${event.slug}?mode=browser_source`;

  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<vmix>
  <preset>
    <name>Audience — ${escape(event.name)}</name>
  </preset>
  <inputs>
    <input Number="1" Title="Audience Comentários" Type="Browser" Loop="False" Audio="False">
      <Browser Url="${escape(telaoUrl)}" Width="1920" Height="1080" Css="body { background: transparent !important; margin: 0; }" />
    </input>
  </inputs>
</vmix>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml',
      'Content-Disposition': `attachment; filename="audience-${event.slug}.vmix"`,
    },
  });
}
