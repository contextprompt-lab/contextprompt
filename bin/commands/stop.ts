import { platform } from 'node:os';
import { readLockfile, writeStopSentinel } from '../../src/utils/lockfile.js';
import { logger } from '../../src/utils/logger.js';

export function stopCommand(): void {
  const pid = readLockfile();

  if (!pid) {
    logger.warn('No running contextprompt session found.');
    process.exit(1);
  }

  try {
    if (platform() === 'win32') {
      // Windows: use sentinel file since SIGUSR2 doesn't exist
      writeStopSentinel();
    } else {
      process.kill(pid, 'SIGUSR2');
    }
    logger.success(`Stop signal sent to contextprompt (PID ${pid})`);
  } catch (err) {
    logger.error(`Failed to send stop signal: ${(err as Error).message}`);
    process.exit(1);
  }
}
