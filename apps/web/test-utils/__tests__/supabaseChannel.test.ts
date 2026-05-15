import { describe, it, expect, vi } from 'vitest';
import { createFakeChannel } from '../supabaseChannel';

describe('createFakeChannel', () => {
  it('routes emit() to registered postgres_changes callback', () => {
    const ch = createFakeChannel();
    const cb = vi.fn();
    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'wordcloud_words' },
      cb,
    );
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
});
