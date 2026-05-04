type Pickable = { id: string; status: string };

// Counts how many items in `current` are pending AND their id is NOT in
// `prevSeen`. Used to decide when to beep / increment notification badge.
export function detectNewPending(prevSeen: readonly string[], current: readonly Pickable[]): number {
  const seen = new Set(prevSeen);
  let n = 0;
  for (const it of current) {
    if (it.status === 'pending' && !seen.has(it.id)) n += 1;
  }
  return n;
}
