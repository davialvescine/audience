'use client';

import { useEffect } from 'react';

const STORAGE_KEY = 'audience.clientId';

type ChannelLike = {
  subscribe: (statusCb?: (status: string) => void) => ChannelLike;
  unsubscribe: () => void;
  track: (payload: Record<string, unknown>) => Promise<'ok' | 'error'>;
  untrack: () => Promise<'ok' | 'error'>;
};

export type UsePresenceJoinOptions = {
  channel: ChannelLike;
  /** Override the stored clientId (useful for tests). */
  clientId?: string;
};

let cachedClientId: string | null = null;

/** Test-only: drop the in-memory clientId cache. */
export function __resetClientId(): void {
  cachedClientId = null;
}

function getOrCreateClientId(): string {
  if (cachedClientId) return cachedClientId;
  let id: string | null = null;
  try {
    id = window.localStorage?.getItem(STORAGE_KEY) ?? null;
  } catch {
    // localStorage unavailable (SSR, privacy mode) — fall through to generate ephemeral
  }
  if (!id) {
    id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `cid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      window.localStorage?.setItem(STORAGE_KEY, id);
    } catch {
      // ignore
    }
  }
  cachedClientId = id;
  return id;
}

export function usePresenceJoin(opts: UsePresenceJoinOptions): void {
  useEffect(() => {
    const channel = opts.channel;
    const clientId = opts.clientId ?? getOrCreateClientId();

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        void channel.track({ clientId, joinedAt: Date.now() });
      }
    });

    return () => {
      void channel.untrack();
      channel.unsubscribe();
    };
  }, [opts.channel, opts.clientId]);
}
