import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import fc from 'fast-check';

import { useOnlinePresence } from '../useOnlinePresence';
import { createFakeChannel } from '../../test-utils/supabaseChannel';

describe('useOnlinePresence', () => {
  it('starts at 0 with no presence', () => {
    const ch = createFakeChannel();
    const { result } = renderHook(() => useOnlinePresence({ channel: ch }));
    expect(result.current.count).toBe(0);
  });

  it('counts top-level keys in presenceState (one bucket = one client)', () => {
    const ch = createFakeChannel();
    const { result } = renderHook(() => useOnlinePresence({ channel: ch }));
    act(() => {
      ch.simulatePresence({
        'client-a': [{ joinedAt: 1 }],
        'client-b': [{ joinedAt: 2 }],
        'client-c': [{ joinedAt: 3 }],
      });
    });
    expect(result.current.count).toBe(3);
  });

  it('updates when presence changes', () => {
    const ch = createFakeChannel();
    const { result } = renderHook(() => useOnlinePresence({ channel: ch }));
    act(() => {
      ch.simulatePresence({ a: [{}], b: [{}] });
    });
    expect(result.current.count).toBe(2);
    act(() => {
      ch.simulatePresence({ a: [{}] });
    });
    expect(result.current.count).toBe(1);
  });

  it('count is always >= 0 (property)', () => {
    fc.assert(
      fc.property(fc.dictionary(fc.string(), fc.array(fc.object())), (state) => {
        const ch = createFakeChannel();
        const { result, unmount } = renderHook(() => useOnlinePresence({ channel: ch }));
        act(() => {
          ch.simulatePresence(state as Record<string, Array<Record<string, unknown>>>);
        });
        const ok = result.current.count >= 0;
        unmount();
        return ok;
      }),
    );
  });

  it('reports isConnected after subscribe', () => {
    const ch = createFakeChannel();
    const { result } = renderHook(() => useOnlinePresence({ channel: ch }));
    expect(result.current.isConnected).toBe(true);
  });
});
