import { describe, it, expectTypeOf } from 'vitest';
import type { LaidOutWord, LayoutRequest, LayoutResponse, WordEntry } from '../types';

describe('wordcloud types', () => {
  it('WordEntry has text + count', () => {
    expectTypeOf<WordEntry>().toEqualTypeOf<{ text: string; count: number }>();
  });

  it('LaidOutWord includes layout coords', () => {
    expectTypeOf<LaidOutWord>().toHaveProperty('x');
    expectTypeOf<LaidOutWord>().toHaveProperty('y');
    expectTypeOf<LaidOutWord>().toHaveProperty('fontSize');
    expectTypeOf<LaidOutWord>().toHaveProperty('rotate');
    expectTypeOf<LaidOutWord>().toHaveProperty('colorIdx');
  });

  it('LayoutResponse is a tagged union', () => {
    const ok: LayoutResponse = { ok: true, words: [] };
    const err: LayoutResponse = { ok: false, error: 'boom' };
    expectTypeOf(ok).toMatchTypeOf<LayoutResponse>();
    expectTypeOf(err).toMatchTypeOf<LayoutResponse>();
  });

  it('LayoutRequest carries dimensions + palette size', () => {
    const req: LayoutRequest = { entries: [], width: 1920, height: 1080, paletteSize: 8 };
    expectTypeOf(req).toMatchTypeOf<LayoutRequest>();
  });
});
