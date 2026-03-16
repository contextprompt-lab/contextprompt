import express from 'express';
import cors from 'cors';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { meetingsRouter } from './routes/meetings.js';
import { reposRouter } from './routes/repos.js';
import { settingsRouter } from './routes/settings.js';
import { recordingRouter, getRecordingStatus } from './routes/recording.js';
import { issuesRouter } from './routes/issues.js';
import { botsRouter, botsWebhookRouter } from './routes/bots.js';
import { authRouter } from './routes/auth.js';
import { stripeRouter, stripeWebhookRouter } from './routes/stripe.js';
import { adminRouter } from './routes/admin.js';
import { supportRouter } from './routes/support.js';
import { requireAuth, requirePro } from './middleware/auth.js';
import { blogRouter } from './routes/blog.js';
import { closeDb, getBlogPostCount } from './db.js';
import { attachWebSocket } from './ws.js';
import { logger } from '../utils/logger.js';
import cron from 'node-cron';

export const DEFAULT_PORT = 3847;

export function createServer() {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '100mb' }));

  // --- Public routes (no auth required) ---
  app.use('/api/auth', authRouter);
  app.use('/api/stripe/webhook', stripeWebhookRouter);
  app.use('/api/bots/webhook', botsWebhookRouter);
  app.use('/api/support', supportRouter);

  // Health check (public)
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', recording: getRecordingStatus() });
  });

  // --- Protected routes (auth required) ---
  app.use('/api', requireAuth);

  app.use('/api/meetings', meetingsRouter);
  app.use('/api/repos', reposRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/recording', recordingRouter);
  app.use('/api/issues', requirePro, issuesRouter);
  app.use('/api/bots', botsRouter);
  app.use('/api/stripe', stripeRouter);
  app.use('/api/admin', adminRouter);

  // --- Public blog routes (no auth, dynamic HTML) ---
  app.use('/blog', blogRouter);

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

  // 404 catch-all for non-API, non-app routes
  app.use((_req, res) => {
    const notFoundPath = staticRoot ? join(staticRoot, '404.html') : '';
    if (notFoundPath && existsSync(notFoundPath)) {
      res.status(404).sendFile(notFoundPath);
    } else {
      res.status(404).send('Not found');
    }
  });

  return app;
}

export async function startServer(port = DEFAULT_PORT): Promise<void> {
  const app = createServer();

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      attachWebSocket(server);
      logger.success(`Dashboard running at http://localhost:${port}`);

      // Blog generation cron — runs daily at 9am and 3pm UTC by default
      // Set BLOG_CRON_SCHEDULE to customize, or BLOG_CRON_ENABLED=false to disable
      const cronEnabled = process.env.BLOG_CRON_ENABLED !== 'false' && !!process.env.OPENAI_API_KEY;
      const cronSchedule = process.env.BLOG_CRON_SCHEDULE || '0 14 * * *';

      if (cronEnabled) {
        let blogRunning = false;
        cron.schedule(cronSchedule, async () => {
          if (blogRunning) {
            logger.info('Blog pipeline already running, skipping');
            return;
          }
          blogRunning = true;
          try {
            logger.info('Blog cron: starting pipeline...');
            const { runPipeline } = await import('../blog/pipeline.js');
            await runPipeline();
            logger.success('Blog cron: pipeline complete');
          } catch (err) {
            logger.error(`Blog cron: pipeline failed — ${err}`);
          } finally {
            blogRunning = false;
          }
        });
        logger.info(`Blog cron scheduled: "${cronSchedule}" (2 posts per run)`);

        // Seed blog on first deploy if empty
        if (getBlogPostCount() === 0) {
          logger.info('Blog is empty — seeding initial posts...');
          blogRunning = true;
          import('../blog/pipeline.js')
            .then(m => m.runPipeline())
            .then(() => logger.success('Blog seed complete'))
            .catch(err => logger.error(`Blog seed failed — ${err}`))
            .finally(() => { blogRunning = false; });
        }
      } else if (!process.env.OPENAI_API_KEY) {
        logger.info('Blog cron disabled — OPENAI_API_KEY not set');
      }

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
