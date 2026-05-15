import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

import { usePresenceJoin, __resetClientId } from '../usePresenceJoin';
import { createFakeChannel } from '../../test-utils/supabaseChannel';

beforeEach(() => {
  __resetClientId();
  window.localStorage.clear();
});

describe('usePresenceJoin', () => {
  it('calls track with the local clientId after subscribe', async () => {
    const ch = createFakeChannel();
    renderHook(() => usePresenceJoin({ channel: ch }));
    // Wait a microtask for track() to fire.
    await Promise.resolve();
    await Promise.resolve();
    const tracked = ch.lastTrack();
    expect(tracked).not.toBeNull();
    expect(typeof tracked!.clientId).toBe('string');
    expect((tracked!.clientId as string).length).toBeGreaterThan(0);
  });

  it('reuses clientId from localStorage across mounts', async () => {
    const ch1 = createFakeChannel();
    const { unmount } = renderHook(() => usePresenceJoin({ channel: ch1 }));
    await Promise.resolve();
    await Promise.resolve();
    const first = ch1.lastTrack()!.clientId as string;
    unmount();

    __resetClientId(); // simulate module re-import; localStorage persists
    const ch2 = createFakeChannel();
    renderHook(() => usePresenceJoin({ channel: ch2 }));
    await Promise.resolve();
    await Promise.resolve();
    expect(ch2.lastTrack()!.clientId).toBe(first);
  });

  it('untracks on unmount', async () => {
    const ch = createFakeChannel();
    const { unmount } = renderHook(() => usePresenceJoin({ channel: ch }));
    await Promise.resolve();
    await Promise.resolve();
    expect(ch.lastTrack()).not.toBeNull();
    unmount();
    await Promise.resolve();
    expect(ch.lastTrack()).toBeNull();
  });

  it('includes joinedAt timestamp', async () => {
    const ch = createFakeChannel();
    const before = Date.now();
    renderHook(() => usePresenceJoin({ channel: ch }));
    await Promise.resolve();
    await Promise.resolve();
    const tracked = ch.lastTrack();
    expect(tracked).not.toBeNull();
    expect(typeof tracked!.joinedAt).toBe('number');
    expect(tracked!.joinedAt as number).toBeGreaterThanOrEqual(before);
  });

  it('uses provided clientId when passed (override for tests / SSR hydration)', async () => {
    const ch = createFakeChannel();
    renderHook(() => usePresenceJoin({ channel: ch, clientId: 'forced-id' }));
    await Promise.resolve();
    await Promise.resolve();
    expect(ch.lastTrack()!.clientId).toBe('forced-id');
  });

  it('does not throw if localStorage is unavailable (SSR / privacy mode)', () => {
    const orig = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      value: undefined,
      configurable: true,
    });
    try {
      const ch = createFakeChannel();
      expect(() => renderHook(() => usePresenceJoin({ channel: ch }))).not.toThrow();
    } finally {
      Object.defineProperty(window, 'localStorage', { value: orig, configurable: true });
    }
  });
});
