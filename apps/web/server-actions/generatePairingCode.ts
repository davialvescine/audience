'use server';

import { requireUser } from '@/lib/auth/requireUser';
import { generatePairingCode, generateHeartbeatSecret } from '@/lib/security/pairingCode';
import { getSupabaseServerClient } from '@/lib/supabase/server';

type Result = { ok: true; code: string; expiresAt: string } | { ok: false; error: string };

export async function generatePairingCodeForEvent(eventId: string): Promise<Result> {
  await requireUser();
  const supabase = await getSupabaseServerClient();
  const code = generatePairingCode();
  const heartbeatSecret = generateHeartbeatSecret();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  const { error } = await supabase.from('pairing_codes').insert({
    code,
    event_id: eventId,
    heartbeat_secret: heartbeatSecret,
    expires_at: expiresAt,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, code, expiresAt };
}
