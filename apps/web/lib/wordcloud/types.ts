// Shared wordcloud layout types — used by the Web Worker, the runLayout
// helper, the useWordCounts hook, and the telão display component.

export type WordEntry = {
  text: string;
  count: number;
};

export type LaidOutWord = {
  text: string;
  count: number;
  x: number;
  y: number;
  fontSize: number;
  rotate: number;
  colorIdx: number;
};

export type LayoutRequest = {
  entries: WordEntry[];
  width: number;
  height: number;
  paletteSize: number;
};

export type LayoutResponse =
  | { ok: true; words: LaidOutWord[] }
  | { ok: false; error: string };
