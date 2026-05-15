import { describe, it, expect } from 'vitest';

import { parseTunnelUrl } from '../src/cloudflared';

describe('parseTunnelUrl', () => {
  it('extracts trycloudflare URL from log line', () => {
    const line =
      '2026-04-29T12:34:56Z INF +-------------------------+ Your quick Tunnel has been created! Visit it at: |  https://abc-xyz-123.trycloudflare.com  |';
    expect(parseTunnelUrl(line)).toBe('https://abc-xyz-123.trycloudflare.com');
  });

  it('returns null when no URL present', () => {
    expect(parseTunnelUrl('regular log line')).toBeNull();
  });
});
