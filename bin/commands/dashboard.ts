import { exec } from 'node:child_process';
import { platform } from 'node:os';
import { startServer, DEFAULT_PORT } from '../../src/server/index.js';
import { logger } from '../../src/utils/logger.js';

interface DashboardOptions {
  port: number;
}

export async function dashboardCommand(options: DashboardOptions): Promise<void> {
  const port = options.port;

  try {
    await startServer(port);

    // Open browser
    const url = `http://localhost:${port}/app/`;
    const os = platform();
    const cmd = os === 'darwin' ? `open "${url}"`
      : os === 'win32' ? `start "${url}"`
      : `xdg-open "${url}"`;

    exec(cmd, (err) => {
      if (err) {
        logger.info(`Open ${url} in your browser`);
      }
    });

    // Keep process alive
    await new Promise(() => {});
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }
}
