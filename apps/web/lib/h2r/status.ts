export type H2RStatus = 'never_paired' | 'online' | 'offline';

const HEARTBEAT_TIMEOUT_MS = 90_000;

// Pure function: derives the H2R bridge status from pairing timestamps.
// nowMs is injected so the caller (client UI tick) can recompute as time
// passes without re-fetching from the server.
export function computeH2RStatus(
  pairedAt: string | null,
  lastHeartbeat: string | null,
  nowMs: number,
): H2RStatus {
  if (!pairedAt) return 'never_paired';
  if (!lastHeartbeat) return 'offline';
  const last = new Date(lastHeartbeat).getTime();
  return nowMs - last < HEARTBEAT_TIMEOUT_MS ? 'online' : 'offline';
}
