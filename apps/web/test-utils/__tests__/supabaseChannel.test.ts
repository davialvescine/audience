import { describe, it, expect, vi } from 'vitest';
import { createFakeChannel } from '../supabaseChannel';

describe('createFakeChannel', () => {
  it('routes emit() to registered postgres_changes callback', () => {
    const ch = createFakeChannel();
    const cb = vi.fn();
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'wordcloud_words' }, cb);
    ch.subscribe();
    ch.emit({
      eventType: 'INSERT',
      new: { word: 'amor' },
      old: {},
      table: 'wordcloud_words',
    });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith({
      eventType: 'INSERT',
      new: { word: 'amor' },
      old: {},
      table: 'wordcloud_words',
    });
  });

  it('does not fire callbacks until subscribe() is called', () => {
    const ch = createFakeChannel();
    const cb = vi.fn();
    ch.on('postgres_changes', { table: 'events' }, cb);
    ch.emit({ eventType: 'UPDATE', new: {}, old: {}, table: 'events' });
    expect(cb).not.toHaveBeenCalled();
  });

  it('filters by table when filter.table is set', () => {
    const ch = createFakeChannel();
    const cbA = vi.fn();
    const cbB = vi.fn();
    ch.on('postgres_changes', { table: 'events' }, cbA);
    ch.on('postgres_changes', { table: 'wordcloud_words' }, cbB);
    ch.subscribe();
    ch.emit({ eventType: 'INSERT', new: {}, old: {}, table: 'wordcloud_words' });
    expect(cbA).not.toHaveBeenCalled();
    expect(cbB).toHaveBeenCalledTimes(1);
  });

  it('reports status via subscribe callback', () => {
    const ch = createFakeChannel();
    const status = vi.fn();
    ch.subscribe(status);
    expect(status).toHaveBeenCalledWith('SUBSCRIBED');
  });

  it('stops delivering after unsubscribe()', () => {
    const ch = createFakeChannel();
    const cb = vi.fn();
    ch.on('postgres_changes', { table: 'events' }, cb);
    ch.subscribe();
    ch.unsubscribe();
    ch.emit({ eventType: 'INSERT', new: {}, old: {}, table: 'events' });
    expect(cb).not.toHaveBeenCalled();
  });

  describe('presence support', () => {
    it('delivers sync event to subscribers with current presenceState', () => {
      const ch = createFakeChannel();
      const sync = vi.fn();
      ch.on('presence', { event: 'sync' }, sync);
      ch.subscribe();
      ch.simulatePresence({ k1: [{ joinedAt: 1 }], k2: [{ joinedAt: 2 }] });
      expect(sync).toHaveBeenCalledTimes(1);
      expect(ch.presenceState()).toEqual({
        k1: [{ joinedAt: 1 }],
        k2: [{ joinedAt: 2 }],
      });
    });

    it('does not fire sync until subscribe()', () => {
      const ch = createFakeChannel();
      const sync = vi.fn();
      ch.on('presence', { event: 'sync' }, sync);
      ch.simulatePresence({ k1: [{}] });
      expect(sync).not.toHaveBeenCalled();
    });

    it('track() records the local payload', async () => {
      const ch = createFakeChannel();
      ch.subscribe();
      const result = await ch.track({ joinedAt: 42 });
      expect(result).toBe('ok');
      expect(ch.lastTrack()).toEqual({ joinedAt: 42 });
    });

    it('untrack() clears the local payload', async () => {
      const ch = createFakeChannel();
      ch.subscribe();
      await ch.track({ joinedAt: 1 });
      await ch.untrack();
      expect(ch.lastTrack()).toBeNull();
    });
  });
});
