'use client';

import { useEffect, useState } from 'react';

type TauriBridge = {
  invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
};

declare global {
  interface Window {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: { invoke: TauriBridge['invoke'] };
  }
}

/**
 * Detects whether the current webview is running inside the Audience Desktop
 * Tauri shell and exposes a typed invoke() bridge to call our Rust commands.
 *
 * Returns { isTauri: false } in any browser (Vercel preview, prod web, dev).
 */
export function useTauri(): {
  isTauri: boolean;
  invoke: TauriBridge['invoke'] | null;
} {
  const [isTauri, setIsTauri] = useState(false);
  const [invoke, setInvoke] = useState<TauriBridge['invoke'] | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const internals = window.__TAURI_INTERNALS__;
    if (internals && typeof internals.invoke === 'function') {
      setIsTauri(true);
      setInvoke(() => internals.invoke);
      return;
    }
    // Older Tauri 2 builds expose window.__TAURI__ with no invoke directly;
    // dynamic-import the API package only when running inside the shell.
    if (window.__TAURI__) {
      setIsTauri(true);
      void import('@tauri-apps/api/core')
        .then((mod) => setInvoke(() => mod.invoke as TauriBridge['invoke']))
        .catch(() => setInvoke(null));
    }
  }, []);

  return { isTauri, invoke };
}
