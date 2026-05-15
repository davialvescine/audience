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

type Callback = (payload: Payload) => void;
type StatusCallback = (status: string) => void;

type Listener = {
  event: string;
  filter: Filter;
  cb: Callback;
};

export type FakeChannel = ReturnType<typeof createFakeChannel>;

export function createFakeChannel() {
  const listeners: Listener[] = [];
  let subscribed = false;

  const channel = {
    on(event: string, filter: Filter, cb: Callback) {
      listeners.push({ event, filter, cb });
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
        if (l.filter.table && l.filter.table !== payload.table) continue;
        l.cb(payload);
      }
    },
    get listenerCount() {
      return listeners.length;
    },
  };
  return channel;
}
