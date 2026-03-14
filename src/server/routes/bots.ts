/**
 * Routes for Recall.ai bot-based meeting recording.
 *
 * Flow:
 * 1. POST /api/bots — send a bot to a meeting URL
 * 2. GET /api/bots/:id — poll bot status
 * 3. POST /api/bots/webhook — Recall.ai webhook (bot.done triggers processing)
 */

import { Router } from 'express';
import {
  createBot,
  getBot,
  downloadTranscript,
  formatRecallTranscript,
  isRecallConfigured,
  leaveBotCall,
  type RecallBot,
} from '../recall.js';
import {
  getRepos,
  touchRepo,
  insertMeeting,
  insertTasksForMeeting,
  getSetting,
} from '../db.js';
import { scanRepo } from '../../repo/scanner.js';
import { extractTasks } from '../../tasks/extractor.js';
import { renderMarkdown, generateOutputFilename } from '../../output/markdown.js';
import { loadConfig } from '../../config.js';
import { logger } from '../../utils/logger.js';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const botsRouter = Router();

// Track active bot sessions: botId -> { meetingDbId, repoIds }
const activeBots = new Map<string, { meetingId: number; repoPaths: string[] }>();
// Track bots already being processed (to avoid duplicate processing)
const processingBots = new Set<string>();

// Check if Recall.ai is configured
botsRouter.get('/status', (_req, res) => {
  res.json({ configured: isRecallConfigured() });
});

// Send a bot to a meeting
botsRouter.post('/', async (req, res) => {
  const { meeting_url, repo_ids, bot_name } = req.body;

  if (!meeting_url) {
    res.status(400).json({ error: 'meeting_url is required' });
    return;
  }

  if (!isRecallConfigured()) {
    res.status(400).json({ error: 'RECALL_API_KEY not set in .env file.' });
    return;
  }

  // Resolve repos
  let repoPaths: string[] = [];
  const allRepos = getRepos();
  if (repo_ids && Array.isArray(repo_ids) && repo_ids.length > 0) {
    for (const id of repo_ids) {
      const repo = allRepos.find(r => r.id === id);
      if (repo) {
        repoPaths.push(repo.path);
        touchRepo(repo.path);
      }
    }
  } else {
    repoPaths = allRepos.map(r => r.path);
  }

  if (repoPaths.length === 0) {
    res.status(400).json({ error: 'No repos configured. Add repos first.' });
    return;
  }

  try {
    const bot = await createBot(meeting_url, bot_name || 'contextprompt');

    // Insert a pending meeting in the DB
    const meetingId = insertMeeting({
      date: new Date().toISOString(),
      duration_minutes: 0,
      speaker_count: 0,
      task_count: 0,
      transcript: '',
      plan_json: '{}',
      output_path: '',
      status: 'recording',
    });

    activeBots.set(bot.id, { meetingId, repoPaths });

    res.json({
      bot_id: bot.id,
      meeting_id: meetingId,
      status: 'joining',
    });
  } catch (err) {
    logger.error(`Failed to create bot: ${(err as Error).message}`);
    res.status(500).json({ error: (err as Error).message });
  }
});

// Tell bot to leave the meeting early
botsRouter.post('/:id/leave', async (req, res) => {
  try {
    await leaveBotCall(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Get bot status — also triggers processing when bot is done (fallback for no webhook)
botsRouter.get('/:id', async (req, res) => {
  try {
    const bot = await getBot(req.params.id);
    const latestStatus = bot.status_changes[bot.status_changes.length - 1];
    const session = activeBots.get(req.params.id);
    const statusCode = latestStatus?.code ?? 'unknown';

    // If bot is done and we haven't started processing yet, trigger it
    if (statusCode === 'done' && session && !processingBots.has(req.params.id)) {
      processingBots.add(req.params.id);
      processCompletedBot(req.params.id).catch(err => {
        logger.error(`Failed to process bot ${req.params.id}: ${err.message}`);
        processingBots.delete(req.params.id);
      });
    }

    res.json({
      bot_id: bot.id,
      meeting_id: session?.meetingId ?? null,
      status: statusCode,
      status_changes: bot.status_changes,
      has_recording: bot.recordings.length > 0,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// Recall.ai webhook handler
botsRouter.post('/webhook', async (req, res) => {
  // Acknowledge immediately (Recall has 15s timeout)
  res.json({ ok: true });

  const { event, data } = req.body;
  const botId = data?.bot?.id;

  if (!botId) return;

  logger.info(`Recall.ai webhook: ${event} for bot ${botId}`);

  if (event === 'bot.done') {
    // Bot finished — download transcript and process
    processCompletedBot(botId).catch(err => {
      logger.error(`Failed to process bot ${botId}: ${err.message}`);
    });
  } else if (event === 'bot.fatal') {
    // Bot failed
    const session = activeBots.get(botId);
    if (session) {
      const { getDb } = await import('../db.js');
      const db = getDb();
      db.prepare('UPDATE meetings SET status = ? WHERE id = ?').run('failed', session.meetingId);
      activeBots.delete(botId);
    }
  }
});

async function waitForTranscript(botId: string, maxRetries = 10): Promise<RecallBot> {
  for (let i = 0; i < maxRetries; i++) {
    const bot = await getBot(botId);
    if (bot.recordings.length > 0 && bot.recordings[0].media_shortcuts.transcript?.data?.download_url) {
      return bot;
    }
    logger.info(`Waiting for transcript to be ready (attempt ${i + 1}/${maxRetries})...`);
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  return getBot(botId);
}

async function processCompletedBot(botId: string): Promise<void> {
  const session = activeBots.get(botId);
  if (!session) {
    logger.warn(`No active session for bot ${botId}, skipping`);
    return;
  }

  const { meetingId, repoPaths } = session;

  try {
    // 1. Wait for recording + transcript to be ready (may take a few seconds after 'done')
    const bot = await waitForTranscript(botId);

    if (bot.recordings.length === 0) {
      logger.error(`Bot ${botId} has no recordings after waiting`);
      const { getDb } = await import('../db.js');
      const db = getDb();
      db.prepare('UPDATE meetings SET status = ? WHERE id = ?').run('failed', meetingId);
      activeBots.delete(botId);
      return;
    }

    const recording = bot.recordings[0];
    const transcriptUrl = recording.media_shortcuts.transcript?.data?.download_url;

    if (!transcriptUrl) {
      logger.error(`Bot ${botId} has no transcript URL. Available media: ${JSON.stringify(recording.media_shortcuts)}`);
      const { getDb } = await import('../db.js');
      const db = getDb();
      db.prepare('UPDATE meetings SET status = ? WHERE id = ?').run('failed', meetingId);
      activeBots.delete(botId);
      return;
    }

    // 2. Download and format transcript
    logger.info(`Downloading transcript for bot ${botId}...`);
    const rawTranscript = await downloadTranscript(transcriptUrl);
    const { text: formattedTranscript, speakerCount, wordCount } = formatRecallTranscript(rawTranscript);

    if (wordCount === 0) {
      logger.warn(`Bot ${botId} transcript is empty`);
      const { getDb } = await import('../db.js');
      const db = getDb();
      db.prepare('UPDATE meetings SET status = ?, transcript = ? WHERE id = ?')
        .run('completed', '', meetingId);
      activeBots.delete(botId);
      return;
    }

    logger.info(`Transcript: ${wordCount} words, ${speakerCount} speakers`);

    // Calculate duration from status changes
    const startedAt = bot.status_changes.find(s => s.code === 'in_call_recording')?.created_at;
    const endedAt = bot.status_changes.find(s => s.code === 'call_ended')?.created_at;
    let durationMinutes = 0;
    if (startedAt && endedAt) {
      durationMinutes = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000);
    }

    // Update meeting status to processing
    const { getDb } = await import('../db.js');
    const db = getDb();
    db.prepare('UPDATE meetings SET status = ? WHERE id = ?').run('processing', meetingId);

    // 3. Scan repos
    logger.info(`Scanning ${repoPaths.length} repo(s)...`);
    const repoMaps = [];
    for (const repoPath of repoPaths) {
      const map = await scanRepo(repoPath);
      repoMaps.push(map);
    }

    // 4. Extract tasks with Claude
    const config = loadConfig();
    const model = getSetting('default_model') || 'claude-sonnet-4-6';
    const language = getSetting('response_language') || undefined;
    logger.info(`Extracting tasks with ${model}...`);

    const plan = await extractTasks(
      formattedTranscript,
      repoMaps,
      config.anthropicApiKey,
      model,
      language,
    );
    logger.info(`Extracted ${plan.tasks.length} task(s)`);

    // 5. Generate output markdown
    const outputPath = generateOutputFilename();
    const resolvedOutput = resolve(outputPath);
    const markdown = renderMarkdown(plan, null, durationMinutes);
    writeFileSync(resolvedOutput, markdown, 'utf-8');

    // 6. Update meeting in DB
    db.prepare(`
      UPDATE meetings
      SET duration_minutes = ?, speaker_count = ?, task_count = ?,
          transcript = ?, plan_json = ?, output_path = ?, status = ?
      WHERE id = ?
    `).run(
      durationMinutes,
      speakerCount,
      plan.tasks.length,
      formattedTranscript,
      JSON.stringify(plan),
      resolvedOutput,
      'completed',
      meetingId,
    );

    if (plan.tasks.length > 0) {
      insertTasksForMeeting(meetingId, plan.tasks.map(t => ({
        task_id: t.id,
        title: t.title,
        status: t.status,
        confidence: t.confidence,
        confidence_reason: t.confidence_reason,
        proposed_change: t.proposed_change,
        evidence: t.evidence,
        files_json: JSON.stringify([...t.high_confidence_files, ...t.possible_related_files]),
        steps_json: JSON.stringify(t.agent_steps),
        dependencies_json: JSON.stringify(t.dependencies),
        ambiguities_json: JSON.stringify(t.ambiguities),
      })));
    }

    logger.success(`Meeting ${meetingId} processed: ${plan.tasks.length} tasks`);
  } catch (err) {
    logger.error(`Processing failed for bot ${botId}: ${(err as Error).message}`);
    const { getDb } = await import('../db.js');
    const db = getDb();
    db.prepare('UPDATE meetings SET status = ? WHERE id = ?').run('failed', meetingId);
  } finally {
    activeBots.delete(botId);
    processingBots.delete(botId);
  }
}
