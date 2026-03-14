import express from 'express';
import cors from 'cors';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { meetingsRouter } from './routes/meetings.js';
import { reposRouter } from './routes/repos.js';
import { settingsRouter } from './routes/settings.js';
import { recordingRouter, getRecordingStatus } from './routes/recording.js';
import { issuesRouter } from './routes/issues.js';
import { closeDb } from './db.js';
import { logger } from '../utils/logger.js';

export const DEFAULT_PORT = 3847;

export function createServer() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // API routes
  app.use('/api/meetings', meetingsRouter);
  app.use('/api/repos', reposRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/recording', recordingRouter);
  app.use('/api/issues', issuesRouter);

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', recording: getRecordingStatus() });
  });

  // Serve website + dashboard static files (built output)
  // Try website/dist first (contains both marketing site and /app dashboard)
  // Fall back to standalone dashboard/dist for dev
  const websiteDist = join(import.meta.dirname, '..', '..', 'website', 'dist');
  const dashboardDist = join(import.meta.dirname, '..', '..', 'dashboard', 'dist');
  const staticRoot = existsSync(websiteDist) ? websiteDist : dashboardDist;

  if (existsSync(staticRoot)) {
    app.use(express.static(staticRoot));
    // SPA fallback for /app routes (Express v5 syntax)
    app.get('/app/', (_req, res) => {
      const appIndex = join(staticRoot, 'app', 'index.html');
      if (existsSync(appIndex)) {
        res.sendFile(appIndex);
      } else {
        res.sendFile(join(staticRoot, 'index.html'));
      }
    });
    app.get('/app/{*path}', (_req, res) => {
      const appIndex = join(staticRoot, 'app', 'index.html');
      if (existsSync(appIndex)) {
        res.sendFile(appIndex);
      } else {
        // Standalone dashboard fallback
        res.sendFile(join(staticRoot, 'index.html'));
      }
    });
  }

  return app;
}

export async function startServer(port = DEFAULT_PORT): Promise<void> {
  const app = createServer();

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      logger.success(`Dashboard running at http://localhost:${port}`);
      resolve();
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        logger.info(`Port ${port} in use — dashboard may already be running at http://localhost:${port}`);
        resolve();
      } else {
        reject(err);
      }
    });

    // Cleanup on exit
    const cleanup = () => {
      server.close();
      closeDb();
    };
    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);
  });
}
