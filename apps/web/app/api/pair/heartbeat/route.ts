import { z } from 'zod';

import { getSupabaseServiceClient } from '@/lib/supabase/service';

const bodySchema = z.object({
  event_id: z.string().uuid(),
  secret: z.string().length(64),
});

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'invalid_payload' }, { status: 400 });

  const supabase = getSupabaseServiceClient();
  const { data: ok, error } = await supabase.rpc('record_heartbeat', {
    p_event_id: parsed.data.event_id,
    p_secret: parsed.data.secret,
  });

  if (error || !ok) return Response.json({ error: 'forbidden' }, { status: 403 });
  return Response.json({ ok: true });
}
