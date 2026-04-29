import { Command } from 'commander';

import { pair } from './commands/pair.js';
import { resume } from './commands/resume.js';

const program = new Command();
program
  .name('ucob-h2r-bridge')
  .description('Bridge H2R Graphics ↔ Audience platform')
  .version('0.1.0');

program
  .command('pair <code>')
  .description('Pair this machine with an Audience event using a pairing code')
  .action(async (code: string) => {
    try {
      await pair(code);
    } catch (err) {
      console.error('Erro:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program
  .command('resume')
  .description('Resume a previous pairing (uses saved state.json)')
  .action(async () => {
    try {
      await resume();
    } catch (err) {
      console.error('Erro:', err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program.parse();
