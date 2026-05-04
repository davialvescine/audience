'use client';

import { useEffect, useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import type { TelaoConfig } from '@/lib/telao/config';

// Subscribes to postgres_changes UPDATE on the event row so the /telao
// page (browser source / chrome PiP / desktop) re-renders with the new
// visual config without requiring a manual refresh.
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
      .channel(`event-config:${eventId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'events',
          filter: `id=eq.${eventId}`,
        },
        (payload: { new: { telao_config?: TelaoConfig } }) => {
          if (payload.new.telao_config) {
            setConfig(payload.new.telao_config);
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
