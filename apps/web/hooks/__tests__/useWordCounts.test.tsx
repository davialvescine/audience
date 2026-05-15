import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

import { useWordCounts } from '../useWordCounts';
import { createFakeChannel } from '../../test-utils/supabaseChannel';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useWordCounts', () => {
  it('aggregates incoming words on the 2s throttle tick', () => {
    const ch = createFakeChannel();
    const { result } = renderHook(() =>
      useWordCounts('evt-1', { channel: ch, initialEntries: [] }),
    );

    act(() => {
      ch.emit({
        eventType: 'INSERT',
        new: { word: 'amor', event_id: 'evt-1' },
        old: {},
        table: 'wordcloud_words',
      });
      ch.emit({
        eventType: 'INSERT',
        new: { word: 'amor', event_id: 'evt-1' },
        old: {},
        table: 'wordcloud_words',
      });
      ch.emit({
        eventType: 'INSERT',
        new: { word: 'paz', event_id: 'evt-1' },
        old: {},
        table: 'wordcloud_words',
      });
    });

    // Before throttle tick: still empty.
    expect(result.current.entries).toEqual([]);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.entries).toEqual([
      { text: 'amor', count: 2 },
      { text: 'paz', count: 1 },
    ]);
    expect(result.current.totalSubmissions).toBe(3);
  });

  it('starts from initialEntries when provided', () => {
    const ch = createFakeChannel();
    const { result } = renderHook(() =>
      useWordCounts('evt-1', {
        channel: ch,
        initialEntries: [
          { text: 'amor', count: 5 },
          { text: 'paz', count: 2 },
        ],
      }),
    );
    expect(result.current.entries).toEqual([
      { text: 'amor', count: 5 },
      { text: 'paz', count: 2 },
    ]);
    expect(result.current.totalSubmissions).toBe(7);
  });

  it('sorts by count desc, then text asc on ties', () => {
    const ch = createFakeChannel();
    const { result } = renderHook(() =>
      useWordCounts('evt-1', { channel: ch, initialEntries: [] }),
    );
    act(() => {
      ch.emit({
        eventType: 'INSERT',
        new: { word: 'banana', event_id: 'evt-1' },
        old: {},
        table: 'wordcloud_words',
      });
      ch.emit({
        eventType: 'INSERT',
        new: { word: 'abacaxi', event_id: 'evt-1' },
        old: {},
        table: 'wordcloud_words',
      });
      ch.emit({
        eventType: 'INSERT',
        new: { word: 'caju', event_id: 'evt-1' },
        old: {},
        table: 'wordcloud_words',
      });
    });
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.entries).toEqual([
      { text: 'abacaxi', count: 1 },
      { text: 'banana', count: 1 },
      { text: 'caju', count: 1 },
    ]);
  });

  it('ignores rows from other events', () => {
    const ch = createFakeChannel();
    const { result } = renderHook(() =>
      useWordCounts('evt-1', { channel: ch, initialEntries: [] }),
    );
    act(() => {
      ch.emit({
        eventType: 'INSERT',
        new: { word: 'fora', event_id: 'evt-OTHER' },
        old: {},
        table: 'wordcloud_words',
      });
      ch.emit({
        eventType: 'INSERT',
        new: { word: 'dentro', event_id: 'evt-1' },
        old: {},
        table: 'wordcloud_words',
      });
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.entries).toEqual([{ text: 'dentro', count: 1 }]);
  });

  it('does not re-render between throttle ticks for new inserts', () => {
    const ch = createFakeChannel();
    let renders = 0;
    renderHook(() => {
      renders += 1;
      return useWordCounts('evt-1', { channel: ch, initialEntries: [] });
    });
    const before = renders;
    act(() => {
      for (let i = 0; i < 10; i += 1) {
        ch.emit({
          eventType: 'INSERT',
          new: { word: `w${i}`, event_id: 'evt-1' },
          old: {},
          table: 'wordcloud_words',
        });
      }
    });
    // No timer advance -> no new render expected.
    expect(renders).toBe(before);
  });
});
