import kleur from 'kleur';
import prompts from 'prompts';

import { redeemPairing, sendHeartbeat } from '../api.js';
import { ensureCloudflared, startTunnel } from '../cloudflared.js';
import { saveState } from '../state.js';

const H2R_PORT = 4001;

export async function pair(code: string): Promise<void> {
  if (!/^AUDIENCE-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
    console.error(kleur.red('✗ Código inválido. Esperado AUDIENCE-XXXX-XXXX.'));
    process.exit(1);
  }

  console.log(kleur.cyan('? Verificando H2R Graphics local...'));
  const probe = await fetch(`http://localhost:${H2R_PORT}/`).catch(() => null);
  if (!probe) console.warn(kleur.yellow('⚠  H2R não respondeu — verifique se está aberto.'));

  const { sourceId } = (await prompts({
    type: 'text',
    name: 'sourceId',
    message: 'Source-id do HTTP Listener (encontra no H2R em Data Sources):',
    validate: (v: string) => v.length >= 4 || 'mínimo 4 caracteres',
  })) as { sourceId?: string };
  if (!sourceId) process.exit(1);

  console.log(kleur.cyan('↓ Garantindo cloudflared...'));
  const bin = await ensureCloudflared();

  console.log(kleur.cyan('↗ Iniciando tunnel...'));
  const tunnel = await startTunnel(bin, H2R_PORT);
  console.log(kleur.green(`✓ Tunnel ativo: ${tunnel.url}`));

  console.log(kleur.cyan('↗ Validando código de pareamento...'));
  const result = await redeemPairing(code, tunnel.url, sourceId);
  saveState({
    event_id: result.event_id,
    event_name: result.event_name,
    source_id: sourceId,
    heartbeat_secret: result.heartbeat_secret,
  });
  console.log(kleur.green(`✓ Conectado ao evento "${result.event_name}"`));
  console.log(
    kleur.dim('Pressione Ctrl+C para encerrar. Mantenha este terminal aberto durante o evento.'),
  );

  const heartbeatTimer = setInterval(() => {
    void sendHeartbeat(result.event_id, result.heartbeat_secret);
  }, 30_000);
  void sendHeartbeat(result.event_id, result.heartbeat_secret);

  const cleanup = () => {
    clearInterval(heartbeatTimer);
    tunnel.process.kill('SIGTERM');
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}
