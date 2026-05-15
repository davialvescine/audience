import { describe, expect, it } from 'vitest';

import { detectNewPending } from '../detectNewPending';

const makeItem = (id: string, status: 'pending' | 'sent' | 'approved' | 'rejected' | 'failed') => ({
  id,
  status,
});

describe('detectNewPending', () => {
  it('returns 0 when no items are pending', () => {
    expect(detectNewPending([], [makeItem('1', 'sent'), makeItem('2', 'rejected')])).toBe(0);
  });

  it('returns count of pending ids that are new since prevSeen', () => {
    const prev = ['a', 'b'];
    const curr = [makeItem('a', 'pending'), makeItem('b', 'sent'), makeItem('c', 'pending')];
    expect(detectNewPending(prev, curr)).toBe(1);
  });

  it('returns 0 when all pending ids were already seen', () => {
    expect(detectNewPending(['x', 'y'], [makeItem('x', 'pending'), makeItem('y', 'pending')])).toBe(
      0,
    );
  });

  it('does not count pending items whose id was seen but status changed back', () => {
    // edge: an item was seen, got approved, then operator unrejects → pending again.
    // We don't want to re-beep — id is in prev set.
    expect(detectNewPending(['x'], [makeItem('x', 'pending')])).toBe(0);
  });
});
