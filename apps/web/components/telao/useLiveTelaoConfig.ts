'use client';

import { useEffect, useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { TelaoConfig } from '@/lib/telao/config';

// Subscribes to a Realtime broadcast on `telao:${eventId}` so the /telao
// page (browser source / chrome PiP / desktop) re-renders with the new
// visual config when the admin TelaoTab autosaves.
//
// We use broadcast instead of postgres_changes because RLS on `events`
// only allows owner_id = auth.uid() — anon clients on /telao can't SELECT
// the row, so postgres_changes never delivers. Broadcast bypasses that
// since it doesn't read DB rows.
export function useLiveTelaoConfig(
  eventId: string,
  initial: TelaoConfig,
  enabled = true,
): TelaoConfig {
  const [config, setConfig] = useState<TelaoConfig>(initial);

  useEffect(() => {
    if (!enabled) return;
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`telao:${eventId}`)
      .on(
        'broadcast',
        { event: 'config-updated' },
        (payload: { payload: { config?: TelaoConfig } }) => {
          if (payload.payload.config) {
            setConfig(payload.payload.config);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, enabled]);

  return config;
}
