'use client';

import { useEffect, useState } from 'react';

type PresenceState = Record<string, Array<Record<string, unknown>>>;

type ChannelLike = {
  on: (event: string, filter: { event?: string }, cb: () => void) => ChannelLike;
  subscribe: (statusCb?: (status: string) => void) => ChannelLike;
  unsubscribe: () => void;
  presenceState: () => PresenceState;
};

export type UseOnlinePresenceOptions = {
  channel: ChannelLike;
};

export type UseOnlinePresenceResult = {
  count: number;
  isConnected: boolean;
};

export function useOnlinePresence(opts: UseOnlinePresenceOptions): UseOnlinePresenceResult {
  const [count, setCount] = useState(0);
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    const channel = opts.channel;

    const onSync = () => {
      setCount(Object.keys(channel.presenceState()).length);
    };

    channel.on('presence', { event: 'sync' }, onSync).subscribe((status) => {
      setIsConnected(status === 'SUBSCRIBED');
    });

    // Pick up the current state in case sync already fired before mount.
    setCount(Object.keys(channel.presenceState()).length);

    return () => {
      channel.unsubscribe();
    };
  }, [opts.channel]);

  return { count, isConnected };
}
