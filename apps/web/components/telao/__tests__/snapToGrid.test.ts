import { describe, expect, it } from 'vitest';

import { snapToGrid } from '../snapToGrid';

describe('snapToGrid', () => {
  it('snaps to 0 when within threshold', () => {
    expect(snapToGrid(2, 3)).toBe(0);
  });

  it('snaps to 50 when within threshold of center', () => {
    expect(snapToGrid(48.5, 3)).toBe(50);
  });

  it('snaps to 100 when near right/bottom edge', () => {
    expect(snapToGrid(98.2, 3)).toBe(100);
  });

  it('does not snap when outside threshold', () => {
    expect(snapToGrid(40, 3)).toBe(40);
    expect(snapToGrid(60, 3)).toBe(60);
  });

  it('snaps to 25 and 75 when near them', () => {
    expect(snapToGrid(24.5, 3)).toBe(25);
    expect(snapToGrid(75.5, 3)).toBe(75);
  });

  it('clamps result to [0, 100]', () => {
    expect(snapToGrid(-5, 3)).toBe(0);
    expect(snapToGrid(105, 3)).toBe(100);
  });
});
