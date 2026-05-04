import { describe, expect, it } from 'vitest';

import { computeH2RStatus } from '../status';

const HEARTBEAT_TIMEOUT_MS = 90_000;

describe('computeH2RStatus', () => {
  const now = new Date('2026-05-04T13:00:00Z').getTime();
  const recent = new Date(now - 30_000).toISOString();
  const stale = new Date(now - HEARTBEAT_TIMEOUT_MS - 1).toISOString();

  it('returns "never_paired" when h2r was never paired', () => {
    expect(computeH2RStatus(null, null, now)).toBe('never_paired');
  });

  it('returns "online" when paired and heartbeat is recent', () => {
    expect(computeH2RStatus('2026-04-01T00:00:00Z', recent, now)).toBe('online');
  });

  it('returns "offline" when paired but heartbeat is stale', () => {
    expect(computeH2RStatus('2026-04-01T00:00:00Z', stale, now)).toBe('offline');
  });

  it('returns "offline" when paired but no heartbeat at all', () => {
    expect(computeH2RStatus('2026-04-01T00:00:00Z', null, now)).toBe('offline');
  });
});
