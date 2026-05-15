import { z } from 'zod';

import { getSupabaseServiceClient } from '@/lib/supabase/service';

const bodySchema = z.object({
  code: z.string().regex(/^AUDIENCE-[A-Z0-9]{4}-[A-Z0-9]{4}$/),
  tunnel_url: z.string().url(),
  source_id: z.string().min(1).max(64),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid_payload' }, { status: 400 });

  const supabase = getSupabaseServiceClient();
  const { data, error } = await supabase
    .rpc('redeem_pairing_code', {
      p_code: parsed.data.code,
      p_tunnel_url: parsed.data.tunnel_url,
      p_source_id: parsed.data.source_id,
    })
    .single();

  if (error) {
    const msg = error.message;
    if (msg.includes('code_not_found'))
      return Response.json({ error: 'code_not_found' }, { status: 404 });
    if (msg.includes('code_consumed'))
      return Response.json({ error: 'code_consumed' }, { status: 410 });
    if (msg.includes('code_expired'))
      return Response.json({ error: 'code_expired' }, { status: 410 });
    return Response.json({ error: 'redeem_failed' }, { status: 500 });
  }

  return Response.json({
    event_id: data?.event_id,
    event_name: data?.event_name,
    heartbeat_secret: data?.heartbeat_secret,
  });
}
