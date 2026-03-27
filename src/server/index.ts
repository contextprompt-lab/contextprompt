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
import { closeDb, getBlogPostCount, getDb, logError, pruneErrorLog } from './db.js';
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

  // Public config (PostHog key, etc. — safe to expose)
  app.get('/api/public-config', (_req, res) => {
    res.json({
      posthogKey: process.env.POSTHOG_PUBLIC_KEY || null,
    });
  });

  // Health check (public)
  app.get('/api/health', (req, res) => {
    const basic = { status: 'ok', recording: getRecordingStatus() };

    // Detailed mode: requires HEALTH_SECRET query param
    if (req.query.detailed === 'true') {
      const secret = process.env.HEALTH_SECRET;
      if (!secret || req.query.secret !== secret) {
        return res.json(basic);
      }

      try {
        const db = getDb();
        const totalUsers = (db.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number }).c;
        const proUsers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE plan = 'pro'").get() as { c: number }).c;
        const freeUsers = (db.prepare("SELECT COUNT(*) as c FROM users WHERE plan = 'free'").get() as { c: number }).c;

        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const meetingsThisWeek = (db.prepare('SELECT COUNT(*) as c FROM meetings WHERE created_at >= ?').get(weekAgo) as { c: number }).c;

        const blogPostCount = getBlogPostCount();

        const recentErrors = db.prepare(
          'SELECT error_type, message, created_at FROM error_log ORDER BY created_at DESC LIMIT 20'
        ).all() as Array<{ error_type: string; message: string; created_at: string }>;

        const errorsLast24h = (db.prepare(
          'SELECT COUNT(*) as c FROM error_log WHERE created_at >= ?'
        ).get(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) as { c: number }).c;

        return res.json({
          ...basic,
          users: { total: totalUsers, pro: proUsers, free: freeUsers },
          meetingsThisWeek,
          blogPostCount,
          errorsLast24h,
          recentErrors,
        });
      } catch {
        return res.json(basic);
      }
    }

    res.json(basic);
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

  // Dynamic sitemap — merges static pages + blog posts into one file
  app.get('/sitemap.xml', (_req, res) => {
    const { getAllBlogSlugs } = require('./db.js');
    const slugs: string[] = getAllBlogSlugs();
    const staticPages = [
      { loc: '/', changefreq: 'weekly', priority: '1.0' },
      { loc: '/playground/', changefreq: 'monthly', priority: '0.7' },
      { loc: '/faq/', changefreq: 'monthly', priority: '0.8' },
      { loc: '/privacy/', changefreq: 'yearly', priority: '0.3' },
      { loc: '/terms/', changefreq: 'yearly', priority: '0.3' },
      { loc: '/blog/', changefreq: 'daily', priority: '0.9' },
      { loc: '/use-cases/meeting-transcription-to-coding-tasks/', changefreq: 'monthly', priority: '0.8' },
      { loc: '/use-cases/ai-meeting-assistant-for-developers/', changefreq: 'monthly', priority: '0.8' },
      { loc: '/use-cases/sprint-planning-automation/', changefreq: 'monthly', priority: '0.8' },
    ];

    const urls = [
      ...staticPages.map(p =>
        `  <url><loc>https://contextprompt.app${p.loc}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`
      ),
      ...slugs.map(slug =>
        `  <url><loc>https://contextprompt.app/blog/${slug}/</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>`
      ),
    ].join('\n');

    res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`);
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

  // 404 catch-all for non-API, non-app routes
  app.use((_req, res) => {
    const notFoundPath = staticRoot ? join(staticRoot, '404.html') : '';
    if (notFoundPath && existsSync(notFoundPath)) {
      res.status(404).sendFile(notFoundPath);
    } else {
      res.status(404).send('Not found');
    }
  });

  // Global error handler — logs to error_log table
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logError('unhandled', err.message, err.stack, { url: _req.originalUrl, method: _req.method });
    logger.error(`Unhandled error: ${err.message}`);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

export async function startServer(port = DEFAULT_PORT): Promise<void> {
  const app = createServer();

  return new Promise((resolve, reject) => {
    const server = app.listen(port, () => {
      attachWebSocket(server);
      logger.success(`Dashboard running at http://localhost:${port}`);

      // Prune old error logs on startup and weekly
      pruneErrorLog(30);
      cron.schedule('0 0 * * 0', () => pruneErrorLog(30));

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
