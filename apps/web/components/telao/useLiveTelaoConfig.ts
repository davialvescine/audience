'use client';

import { useEffect, useState } from 'react';

import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { DEFAULT_TELAO_CONFIG, type TelaoConfig } from '@/lib/telao/config';

const POLL_MS = 3000;

// Polls get_telao_config every few seconds so /telao tabs (browser source,
// PiP, desktop) re-render with the latest config without F5.
//
// Polling beats Realtime here because:
// - Realtime postgres_changes is blocked by RLS on `events` (anon can't
//   SELECT, so updates never reach /telao).
// - Realtime broadcast works but requires the admin tab to stay open and
//   actively dispatch on every save — fragile and requires extra plumbing.
// - 3s latency is fine for visual config changes (not for live messages).
export function useLiveTelaoConfig(
  slug: string,
  initial: TelaoConfig,
  enabled = true,
): TelaoConfig {
  const [config, setConfig] = useState<TelaoConfig>(initial);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const supabase = getSupabaseBrowserClient();

    const fetchOnce = async () => {
      const { data, error } = await supabase.rpc('get_telao_config', {
        p_slug: slug,
      });
      if (!alive || error) return;
      const event = data?.[0];
      if (event?.config) {
        setConfig({
          ...DEFAULT_TELAO_CONFIG,
          ...(event.config as Partial<TelaoConfig>),
        });
      }
    };

    const interval = setInterval(fetchOnce, POLL_MS);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [slug, enabled]);

  return config;
}
