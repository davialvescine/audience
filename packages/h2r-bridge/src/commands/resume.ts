import kleur from 'kleur';

import { sendHeartbeat } from '../api.js';
import { ensureCloudflared, startTunnel } from '../cloudflared.js';
import { loadState } from '../state.js';

const H2R_PORT = 4001;

export async function resume(): Promise<void> {
  const state = loadState();
  if (!state) {
    console.error(
      kleur.red('✗ Nenhum pareamento anterior encontrado. Rode "pair <CODE>" primeiro.'),
    );
    process.exit(1);
  }

  console.log(kleur.cyan('↓ Garantindo cloudflared...'));
  const bin = await ensureCloudflared();

  console.log(kleur.cyan('↗ Iniciando tunnel...'));
  const tunnel = await startTunnel(bin, H2R_PORT);
  console.log(kleur.green(`✓ Tunnel ativo: ${tunnel.url}`));
  console.log(
    kleur.yellow(
      '⚠  Atenção: a URL do tunnel mudou. O bridge anterior precisa ser re-pareado se o evento depender da URL antiga.',
    ),
  );

  console.log(kleur.green(`✓ Heartbeating evento "${state.event_name}"`));
  const heartbeatTimer = setInterval(() => {
    void sendHeartbeat(state.event_id, state.heartbeat_secret);
  }, 30_000);
  void sendHeartbeat(state.event_id, state.heartbeat_secret);

  const cleanup = () => {
    clearInterval(heartbeatTimer);
    tunnel.process.kill('SIGTERM');
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
