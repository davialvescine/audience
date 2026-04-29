const API = process.env.AUDIENCE_API_URL ?? 'https://audience.app';

export async function redeemPairing(
  code: string,
  tunnelUrl: string,
  sourceId: string,
): Promise<{ event_id: string; event_name: string; heartbeat_secret: string }> {
  const res = await fetch(`${API}/api/pair/redeem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, tunnel_url: tunnelUrl, source_id: sourceId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `redeem_failed_${res.status}`);
  }
  return res.json() as Promise<{ event_id: string; event_name: string; heartbeat_secret: string }>;
}

export async function sendHeartbeat(eventId: string, secret: string): Promise<void> {
  await fetch(`${API}/api/pair/heartbeat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event_id: eventId, secret }),
  });
}
