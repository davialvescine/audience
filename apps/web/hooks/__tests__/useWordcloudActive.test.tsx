import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useWordcloudActive } from '../useWordcloudActive';
import { createFakeChannel } from '../../test-utils/supabaseChannel';

const baseConfig = {
  question: 'q',
  maxWordsPerSubmission: 1,
  filterStopwords: true,
  filterProfanity: true,
  palette: ['#fff'],
  showTotal: true,
};

describe('useWordcloudActive', () => {
  it('returns the initial state when no events come through', () => {
    const ch = createFakeChannel();
    const { result } = renderHook(() =>
      useWordcloudActive('evt-1', {
        initialActive: false,
        initialConfig: baseConfig,
        channel: ch,
      }),
    );
    expect(result.current.active).toBe(false);
    expect(result.current.config).toEqual(baseConfig);
  });

  it('updates active when an UPDATE event arrives for this event', () => {
    const ch = createFakeChannel();
    const { result } = renderHook(() =>
      useWordcloudActive('evt-1', {
        initialActive: false,
        initialConfig: baseConfig,
        channel: ch,
      }),
    );
    act(() => {
      ch.emit({
        eventType: 'UPDATE',
        new: { id: 'evt-1', wordcloud_active: true, wordcloud_config: baseConfig },
        old: { id: 'evt-1', wordcloud_active: false, wordcloud_config: baseConfig },
        table: 'events',
      });
    });
    expect(result.current.active).toBe(true);
  });

  it('updates config when wordcloud_config changes', () => {
    const ch = createFakeChannel();
    const { result } = renderHook(() =>
      useWordcloudActive('evt-1', {
        initialActive: true,
        initialConfig: baseConfig,
        channel: ch,
      }),
    );
    const next = { ...baseConfig, question: 'nova pergunta' };
    act(() => {
      ch.emit({
        eventType: 'UPDATE',
        new: { id: 'evt-1', wordcloud_active: true, wordcloud_config: next },
        old: { id: 'evt-1', wordcloud_active: true, wordcloud_config: baseConfig },
        table: 'events',
      });
    });
    expect(result.current.config).toEqual(next);
  });

  it('ignores events for a different event id', () => {
    const ch = createFakeChannel();
    const { result } = renderHook(() =>
      useWordcloudActive('evt-1', {
        initialActive: false,
        initialConfig: baseConfig,
        channel: ch,
      }),
    );
    act(() => {
      ch.emit({
        eventType: 'UPDATE',
        new: { id: 'evt-OTHER', wordcloud_active: true, wordcloud_config: baseConfig },
        old: {},
        table: 'events',
      });
    });
    expect(result.current.active).toBe(false);
  });

  it('subscribes the channel after mount', () => {
    const ch = createFakeChannel();
    renderHook(() =>
      useWordcloudActive('evt-1', {
        initialActive: false,
        initialConfig: baseConfig,
        channel: ch,
      }),
    );
    // emit only delivers when subscribed — verifies subscribe() was called
    let called = false;
    ch.on('postgres_changes', { table: 'events' }, () => {
      called = true;
    });
    ch.emit({ eventType: 'UPDATE', new: { id: 'evt-1', wordcloud_active: true, wordcloud_config: baseConfig }, old: {}, table: 'events' });
    expect(called).toBe(true);
  });
});
