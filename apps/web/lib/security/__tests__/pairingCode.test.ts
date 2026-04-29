import { describe, it, expect } from 'vitest';

import { generatePairingCode, generateHeartbeatSecret } from '../pairingCode';

describe('generatePairingCode', () => {
  it('matches AUDIENCE-XXXX-XXXX with alphanumerics', () => {
    const code = generatePairingCode();
    expect(code).toMatch(/^AUDIENCE-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });
  it('generates unique codes', () => {
    const set = new Set(Array.from({ length: 1000 }, () => generatePairingCode()));
    expect(set.size).toBe(1000);
  });
});

describe('generateHeartbeatSecret', () => {
  it('produces 64-hex-char string', () => {
    expect(generateHeartbeatSecret()).toMatch(/^[a-f0-9]{64}$/);
  });
});
