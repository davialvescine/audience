import type { LaidOutWord, LayoutRequest, LayoutResponse } from './types';

export type WorkerLike = {
  postMessage: (data: LayoutRequest) => void;
  terminate: () => void;
  addEventListener: (
    event: 'message',
    cb: (e: { data: LayoutResponse }) => void,
  ) => void;
  removeEventListener: (
    event: 'message',
    cb: (e: { data: LayoutResponse }) => void,
  ) => void;
};

export type WorkerFactory = () => WorkerLike;

const defaultFactory: WorkerFactory = () =>
  new Worker(
    new URL('../../workers/wordcloud.worker.ts', import.meta.url),
    { type: 'module' },
  ) as unknown as WorkerLike;

let singleton: WorkerLike | null = null;

function getWorker(factory: WorkerFactory): WorkerLike {
  if (!singleton) singleton = factory();
  return singleton;
}

/** Test-only: drop the cached worker so each test starts fresh. */
export function __resetWorkerSingleton(): void {
  singleton?.terminate();
  singleton = null;
}

export function runLayout(
  req: LayoutRequest,
  factory: WorkerFactory = defaultFactory,
): Promise<LaidOutWord[]> {
  const worker = getWorker(factory);
  return new Promise<LaidOutWord[]>((resolve, reject) => {
    const handler = (e: { data: LayoutResponse }) => {
      worker.removeEventListener('message', handler);
      if (e.data.ok) resolve(e.data.words);
      else reject(new Error(e.data.error));
    };
    worker.addEventListener('message', handler);
    worker.postMessage(req);
  });
}
