import type { Database } from '@audience/shared-types';
import { createClient } from '@supabase/supabase-js';

export function getSupabaseServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        // Email-based flows (invite, recovery, magic link) need 'implicit' so
        // the generated token_hash is verifyOtp-compatible. With 'pkce' the
        // token gets a pkce_ prefix and only works via exchangeCodeForSession,
        // which requires a verifier the email-clicker browser doesn't have.
        flowType: 'implicit',
      },
    },
  );
}
