'use client';

import type { Database } from '@audience/shared-types';
import { createBrowserClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function getSupabaseBrowserClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// Singleton client puro para Realtime. @supabase/ssr embrulha o storage
// em cookies — em produção (Vercel) isso parece causar transport
// failure no WebSocket subscribe. Usando createClient direto pra
// channels evita esse problema.
let realtimeClient: SupabaseClient<Database> | null = null;
export function getSupabaseRealtimeClient(): SupabaseClient<Database> {
  if (!realtimeClient) {
    realtimeClient = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );
  }
  return realtimeClient;
}
