/// <reference lib="webworker" />
// Wordcloud layout Web Worker.
// Runs d3-cloud off the main thread — layout of 100+ words is expensive
// and would jank the telão if we ran it synchronously in React.
//
// Communication contract: see lib/wordcloud/types.ts (LayoutRequest/LayoutResponse).

import cloud from 'd3-cloud';

import type { LaidOutWord, LayoutRequest, LayoutResponse } from '@/lib/wordcloud/types';

type CloudWord = {
  text: string;
  count: number;
  size: number;
  // d3-cloud writes layout coords back onto each word object
  x?: number;
  y?: number;
  rotate?: number;
  font?: string;
  padding?: number;
};

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = (e: MessageEvent<LayoutRequest>) => {
  const { entries, width, height, paletteSize } = e.data;
  if (!entries || entries.length === 0) {
    const empty: LayoutResponse = { ok: true, words: [] };
    self.postMessage(empty);
    return;
  }

  try {
    const max = Math.max(...entries.map((w) => w.count));
    const sized: CloudWord[] = entries.map((w) => ({
      text: w.text,
      count: w.count,
      size: 16 + (w.count / max) * 96,
    }));

    cloud<CloudWord>()
      .size([width, height])
      .words(sized)
      .padding(8)
      .rotate(() => (Math.random() < 0.25 ? (Math.random() < 0.5 ? -90 : 90) : 0))
      .font('Inter')
      .fontSize((d) => d.size ?? 16)
      .on('end', (laid) => {
        const words: LaidOutWord[] = laid.map((w, i) => ({
          text: w.text ?? '',
          count: w.count,
          x: w.x ?? 0,
          y: w.y ?? 0,
          fontSize: w.size ?? 16,
          rotate: w.rotate ?? 0,
          colorIdx: i % paletteSize,
        }));
        const response: LayoutResponse = { ok: true, words };
        self.postMessage(response);
      })
      .start();
  } catch (err) {
    const response: LayoutResponse = {
      ok: false,
      error: err instanceof Error ? err.message : 'layout_failed',
    };
    self.postMessage(response);
  }
};
