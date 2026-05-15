type Payload = {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  new: Record<string, unknown>;
  old: Record<string, unknown>;
  table: string;
  schema?: string;
};

type Filter = {
  event?: string;
  schema?: string;
  table?: string;
  filter?: string;
};

type ChangesCallback = (payload: Payload) => void;
type PresenceCallback = () => void;
type StatusCallback = (status: string) => void;

type Listener =
  | { type: 'postgres_changes'; filter: Filter; cb: ChangesCallback }
  | { type: 'presence'; filter: Filter; cb: PresenceCallback };

type PresenceState = Record<string, Array<Record<string, unknown>>>;

export type FakeChannel = ReturnType<typeof createFakeChannel>;

export function createFakeChannel() {
  const listeners: Listener[] = [];
  let subscribed = false;
  let presence: PresenceState = {};
  let localTrack: Record<string, unknown> | null = null;

  const channel = {
    on(event: string, filter: Filter, cb: ChangesCallback | PresenceCallback) {
      if (event === 'presence') {
        listeners.push({ type: 'presence', filter, cb: cb as PresenceCallback });
      } else {
        listeners.push({ type: 'postgres_changes', filter, cb: cb as ChangesCallback });
      }
      return channel;
    },
    subscribe(statusCb?: StatusCallback) {
      subscribed = true;
      statusCb?.('SUBSCRIBED');
      return channel;
    },
    unsubscribe() {
      subscribed = false;
      return channel;
    },
    emit(payload: Payload) {
      if (!subscribed) return;
      for (const l of listeners) {
        if (l.type !== 'postgres_changes') continue;
        if (l.filter.table && l.filter.table !== payload.table) continue;
        l.cb(payload);
      }
    },
    /** Simulate a presence sync. Updates internal state and fires listeners. */
    simulatePresence(next: PresenceState) {
      presence = next;
      if (!subscribed) return;
      for (const l of listeners) {
        if (l.type !== 'presence') continue;
        if (l.filter.event && l.filter.event !== 'sync') continue;
        l.cb();
      }
    },
    presenceState(): PresenceState {
      return presence;
    },
    track(payload: Record<string, unknown>): Promise<'ok' | 'error'> {
      localTrack = payload;
      return Promise.resolve('ok');
    },
    untrack(): Promise<'ok' | 'error'> {
      localTrack = null;
      return Promise.resolve('ok');
    },
    lastTrack(): Record<string, unknown> | null {
      return localTrack;
    },
    get listenerCount() {
      return listeners.length;
    },
  };
  return channel;
}
