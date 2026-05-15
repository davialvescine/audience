import { describe, it, expect, vi } from 'vitest';
import { runLayout, __resetWorkerSingleton } from '../runLayout';
import type { WorkerLike } from '../runLayout';
import type { LayoutResponse } from '../types';

function makeFakeWorker(): WorkerLike & { dispatchMessage: (data: LayoutResponse) => void } {
  let handler: ((e: { data: LayoutResponse }) => void) | null = null;
  return {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn((event: string, cb: (e: { data: LayoutResponse }) => void) => {
      if (event === 'message') handler = cb;
    }),
    removeEventListener: vi.fn(),
    dispatchMessage: (data) => {
      handler?.({ data });
    },
  };
}

describe('runLayout', () => {
  it('resolves with words posted back by the worker', async () => {
    __resetWorkerSingleton();
    const w = makeFakeWorker();
    const promise = runLayout(
      { entries: [{ text: 'amor', count: 3 }], width: 1920, height: 1080, paletteSize: 8 },
      () => w,
    );
    w.dispatchMessage({
      ok: true,
      words: [{ text: 'amor', x: 0, y: 0, fontSize: 100, rotate: 0, count: 3, colorIdx: 0 }],
    });
    await expect(promise).resolves.toEqual([
      { text: 'amor', x: 0, y: 0, fontSize: 100, rotate: 0, count: 3, colorIdx: 0 },
    ]);
  });

  it('rejects when worker returns an error envelope', async () => {
    __resetWorkerSingleton();
    const w = makeFakeWorker();
    const promise = runLayout(
      { entries: [{ text: 'amor', count: 3 }], width: 1920, height: 1080, paletteSize: 8 },
      () => w,
    );
    w.dispatchMessage({ ok: false, error: 'boom' });
    await expect(promise).rejects.toThrow('boom');
  });

  it('reuses the worker singleton across calls', async () => {
    __resetWorkerSingleton();
    const w = makeFakeWorker();
    const factory = vi.fn(() => w);
    const p1 = runLayout({ entries: [], width: 1, height: 1, paletteSize: 1 }, factory);
    w.dispatchMessage({ ok: true, words: [] });
    await p1;
    const p2 = runLayout({ entries: [], width: 1, height: 1, paletteSize: 1 }, factory);
    w.dispatchMessage({ ok: true, words: [] });
    await p2;
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it('posts the request payload verbatim', async () => {
    __resetWorkerSingleton();
    const w = makeFakeWorker();
    const req = { entries: [{ text: 'a', count: 1 }], width: 800, height: 600, paletteSize: 4 };
    const p = runLayout(req, () => w);
    w.dispatchMessage({ ok: true, words: [] });
    await p;
    expect(w.postMessage).toHaveBeenCalledWith(req);
  });
});
