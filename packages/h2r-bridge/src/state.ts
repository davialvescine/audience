import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DIR = join(homedir(), '.ucob-h2r-bridge');
const FILE = join(DIR, 'state.json');

export type BridgeState = {
  event_id: string;
  event_name: string;
  source_id: string;
  heartbeat_secret: string;
};

export function saveState(state: BridgeState): void {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(state, null, 2), 'utf8');
}

export function loadState(): BridgeState | null {
  if (!existsSync(FILE)) return null;
  return JSON.parse(readFileSync(FILE, 'utf8')) as BridgeState;
}
