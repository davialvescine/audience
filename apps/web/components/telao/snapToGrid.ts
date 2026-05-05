const SNAP_POINTS = [0, 25, 50, 75, 100];

// Snaps a percentage value to nearby grid points (0/25/50/75/100) when
// within `threshold` of one. Otherwise clamps to [0, 100] and returns
// the original value. Used during drag in the telão preview so the card
// "agarra" no centro/cantos sem requerer mira pixel-perfect.
export function snapToGrid(value: number, threshold: number): number {
  const clamped = Math.max(0, Math.min(100, value));
  for (const point of SNAP_POINTS) {
    if (Math.abs(clamped - point) <= threshold) return point;
  }
  return clamped;
}
