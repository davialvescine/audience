import { randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHIJKLMNPQRSTUVWXYZ23456789';

export function generatePairingCode(): string {
  const bytes = randomBytes(8);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
  return `AUDIENCE-${chars.slice(0, 4)}-${chars.slice(4, 8)}`;
}

export function generateHeartbeatSecret(): string {
  return randomBytes(32).toString('hex');
}
