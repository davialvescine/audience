import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, mkdirSync, createWriteStream } from 'node:fs';
import { homedir, platform, arch } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export function parseTunnelUrl(line: string): string | null {
  const m = line.match(/(https:\/\/[a-z0-9-]+\.trycloudflare\.com)/i);
  return m?.[1] ?? null;
}

const BRIDGE_DIR = join(homedir(), '.ucob-h2r-bridge');

function binaryName(): string {
  const p = platform();
  const a = arch();
  if (p === 'darwin') return a === 'arm64' ? 'cloudflared-darwin-arm64' : 'cloudflared-darwin-amd64';
  if (p === 'linux') return a === 'arm64' ? 'cloudflared-linux-arm64' : 'cloudflared-linux-amd64';
  if (p === 'win32') return 'cloudflared-windows-amd64.exe';
  throw new Error(`platform_unsupported: ${p}/${a}`);
}

const DOWNLOAD_BASE = 'https://github.com/cloudflare/cloudflared/releases/latest/download';

export async function ensureCloudflared(): Promise<string> {
  if (!existsSync(BRIDGE_DIR)) mkdirSync(BRIDGE_DIR, { recursive: true });
  const name = binaryName();
  const dest = join(BRIDGE_DIR, name);
  if (existsSync(dest)) return dest;
  const res = await fetch(`${DOWNLOAD_BASE}/${name}`);
  if (!res.ok || !res.body) throw new Error(`download_failed: ${res.status}`);
  const nodeStream = Readable.fromWeb(res.body as never);
  await pipeline(nodeStream, createWriteStream(dest, { mode: 0o755 }));
  return dest;
}

export type TunnelHandle = { url: string; process: ChildProcess };

export function startTunnel(binPath: string, port: number): Promise<TunnelHandle> {
  return new Promise((resolve, reject) => {
    const proc = spawn(binPath, ['tunnel', '--url', `http://localhost:${port}`], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      const url = parseTunnelUrl(text);
      if (url) {
        proc.stderr?.off('data', onData);
        proc.stdout?.off('data', onData);
        resolve({ url, process: proc });
      }
    };
    proc.stdout?.on('data', onData);
    proc.stderr?.on('data', onData);
    proc.on('error', reject);
    proc.on('exit', (code) => {
      if (code !== 0) reject(new Error(`cloudflared_exit_${code}`));
    });
    setTimeout(() => reject(new Error('cloudflared_timeout')), 30_000);
  });
}
