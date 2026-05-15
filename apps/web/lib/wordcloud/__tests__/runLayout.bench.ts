import { bench, describe } from 'vitest';

// d3-cloud is layout-only. We bench the algorithm against a synthetic dataset
// of 100 words without going through the Web Worker plumbing — Worker IPC
// is irrelevant to layout performance, and jsdom doesn't provide real Workers.
//
// Target p95 < 500ms on CI hardware for 100 words.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const cloud = require('d3-cloud') as typeof import('d3-cloud');

function fakeEntries(n: number): Array<{ text: string; size: number }> {
  return Array.from({ length: n }, (_, i) => ({
    text: `word${i.toString(36)}`,
    size: 16 + ((n - i) / n) * 96,
  }));
}

describe('d3-cloud layout perf', () => {
  bench(
    '100 words / 1920x1080',
    async () => {
      await new Promise<void>((resolve) => {
        cloud()
          .size([1920, 1080])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .words(fakeEntries(100) as any)
          .padding(8)
          .rotate(() => 0)
          .font('Inter')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .fontSize((d: any) => d.size ?? 16)
          .on('end', () => resolve())
          .start();
      });
    },
    { time: 2000 },
  );

  bench(
    '50 words / 1920x1080',
    async () => {
      await new Promise<void>((resolve) => {
        cloud()
          .size([1920, 1080])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .words(fakeEntries(50) as any)
          .padding(8)
          .rotate(() => 0)
          .font('Inter')
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .fontSize((d: any) => d.size ?? 16)
          .on('end', () => resolve())
          .start();
      });
    },
    { time: 2000 },
  );
});
