import { Router } from 'express';
import { getMeetings, getMeeting, deleteMeeting, getTasksForMeeting, updateTaskGithubIssue, deleteTasksForMeeting, insertTasksForMeeting, insertMeeting, getRepos, getSetting } from '../db.js';
import { scanRepo } from '../../repo/scanner.js';
import { extractTasks } from '../../tasks/extractor.js';
import { loadConfig } from '../../config.js';
import { logger } from '../../utils/logger.js';
import type { RepoMap } from '../../repo/types.js';

export const meetingsRouter = Router();

// List all meetings
meetingsRouter.get('/', (req, res) => {
  const meetings = getMeetings(req.userId);
  res.json(meetings.map(m => ({
    ...m,
    // Don't send full transcript/plan in list view
    transcript: undefined,
    plan_json: undefined,
  })));
});

// Get single meeting with full details
meetingsRouter.get('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid meeting ID' });
    return;
  }

  const meeting = getMeeting(id, req.userId);
  if (!meeting) {
    res.status(404).json({ error: 'Meeting not found' });
    return;
  }

  const tasks = getTasksForMeeting(id);
  const plan = meeting.plan_json ? JSON.parse(meeting.plan_json) : null;

  res.json({
    ...meeting,
    plan: plan,
    tasks: tasks.map(t => ({
      ...t,
      files: t.files_json ? JSON.parse(t.files_json) : [],
      steps: t.steps_json ? JSON.parse(t.steps_json) : [],
      dependencies: t.dependencies_json ? JSON.parse(t.dependencies_json) : [],
      ambiguities: t.ambiguities_json ? JSON.parse(t.ambiguities_json) : [],
    })),
  });
});

// Rerun analysis on an existing meeting's transcript
meetingsRouter.post('/:id/rerun', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid meeting ID' });
    return;
  }

  const meeting = getMeeting(id, req.userId);
  if (!meeting) {
    res.status(404).json({ error: 'Meeting not found' });
    return;
  }

  if (!meeting.transcript) {
    res.status(400).json({ error: 'Meeting has no transcript to analyze' });
    return;
  }

  // Respond immediately, process in background
  res.json({ ok: true, status: 'processing' });

  try {
    const { getDb } = await import('../db.js');
    const db = getDb();
    db.prepare('UPDATE meetings SET status = ? WHERE id = ?').run('processing', id);

    // Scan all repos
    const repos = getRepos(req.userId);
    const repoMaps: RepoMap[] = [];
    for (const repo of repos) {
      if (repo.path.startsWith('browser://')) continue;
      try {
        const map = await scanRepo(repo.path);
        repoMaps.push(map);
      } catch (err) {
        logger.warn(`Skipping repo ${repo.path}: ${(err as Error).message}`);
      }
    }

    // Extract tasks
    const config = loadConfig();
    const model = getSetting('default_model', req.userId) || 'claude-sonnet-4-6';
    const language = getSetting('response_language', req.userId) || undefined;
    logger.info(`Rerunning analysis for meeting ${id} with ${model}...`);

    const plan = await extractTasks(
      meeting.transcript,
      repoMaps,
      config.anthropicApiKey,
      model,
      language,
    );

    // Clear old tasks and insert new ones
    deleteTasksForMeeting(id);

    db.prepare(`
      UPDATE meetings
      SET task_count = ?, plan_json = ?, status = ?
      WHERE id = ?
    `).run(plan.tasks.length, JSON.stringify(plan), 'completed', id);

    if (plan.tasks.length > 0) {
      insertTasksForMeeting(id, plan.tasks.map(t => ({
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

    logger.success(`Rerun complete for meeting ${id}: ${plan.tasks.length} tasks`);
  } catch (err) {
    logger.error(`Rerun failed for meeting ${id}: ${(err as Error).message}`);
    const { getDb } = await import('../db.js');
    const db = getDb();
    db.prepare('UPDATE meetings SET status = ? WHERE id = ?').run('failed', id);
  }
});

// Test analysis from a pasted transcript
meetingsRouter.post('/test-analysis', async (req, res) => {
  const { transcript, repo_maps } = req.body;
  if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
    res.status(400).json({ error: 'Transcript is required' });
    return;
  }
  const clientRepoMaps = Array.isArray(repo_maps) ? repo_maps as RepoMap[] : undefined;

  // Create a meeting record immediately
  const meetingId = insertMeeting({
    date: new Date().toISOString(),
    duration_minutes: 0,
    speaker_count: 0,
    task_count: 0,
    transcript: transcript.trim(),
    plan_json: '{}',
    output_path: '',
    status: 'processing',
    user_id: req.userId,
  });

  res.json({ ok: true, meeting_id: meetingId, status: 'processing' });

  // Process in background
  try {
    const { getDb } = await import('../db.js');
    const db = getDb();

    const repoMaps: RepoMap[] = [];

    // Use client-provided repo maps (from browser File System Access API)
    if (clientRepoMaps && clientRepoMaps.length > 0) {
      repoMaps.push(...clientRepoMaps);
      logger.info(`Test analysis: using ${clientRepoMaps.length} client-provided repo map(s)`);
    }

    // Also scan any local (non-browser) repos
    const repos = getRepos(req.userId);
    for (const repo of repos) {
      if (repo.path.startsWith('browser://')) continue;
      try {
        const map = await scanRepo(repo.path);
        repoMaps.push(map);
        logger.info(`  Scanned ${repo.name}: ${map.files.length} files`);
      } catch (err) {
        logger.warn(`  Skipping repo ${repo.path}: ${(err as Error).message}`);
      }
    }

    const config = loadConfig();
    const model = getSetting('default_model', req.userId) || 'claude-sonnet-4-6';
    const language = getSetting('response_language', req.userId) || undefined;
    logger.info(`Test analysis for meeting ${meetingId} with ${model} (${repoMaps.length} repos)...`);

    const plan = await extractTasks(
      transcript.trim(),
      repoMaps,
      config.anthropicApiKey,
      model,
      language,
    );

    db.prepare(`
      UPDATE meetings
      SET task_count = ?, plan_json = ?, status = ?
      WHERE id = ?
    `).run(plan.tasks.length, JSON.stringify(plan), 'completed', meetingId);

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

    logger.success(`Test analysis complete for meeting ${meetingId}: ${plan.tasks.length} tasks`);
  } catch (err) {
    logger.error(`Test analysis failed for meeting ${meetingId}: ${(err as Error).message}`);
    const { getDb } = await import('../db.js');
    const db = getDb();
    db.prepare('UPDATE meetings SET status = ? WHERE id = ?').run('failed', meetingId);
  }
});

// Delete a meeting
meetingsRouter.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid meeting ID' });
    return;
  }

  deleteMeeting(id);
  res.json({ ok: true });
});

// Update task's GitHub issue URL
meetingsRouter.patch('/tasks/:taskId/github', (req, res) => {
  const taskId = parseInt(req.params.taskId, 10);
  const { issue_url } = req.body;

  if (isNaN(taskId) || !issue_url) {
    res.status(400).json({ error: 'Invalid task ID or missing issue_url' });
    return;
  }

  updateTaskGithubIssue(taskId, issue_url);
  res.json({ ok: true });
});
