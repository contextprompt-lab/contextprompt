import { Router } from 'express';
import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { getRepos, touchRepo } from '../db.js';
import { logger } from '../../utils/logger.js';
import {
  getRecordingState,
  setRecordingState,
  addRecordingLog,
  resetRecordingState,
} from '../recording-state.js';

export const recordingRouter = Router();

let recordingProcess: ChildProcess | null = null;

export function getRecordingStatus() {
  return getRecordingState();
}

// Get recording status (includes recent logs)
recordingRouter.get('/status', (_req, res) => {
  res.json(getRecordingState());
});

// Start recording (CLI-spawned mode)
recordingRouter.post('/start', (req, res) => {
  const state = getRecordingState();
  if (state.status !== 'idle') {
    res.status(409).json({ error: 'Already recording' });
    return;
  }

  const { repos: repoIds, mic, micOnly, model, speakers } = req.body;

  // Resolve repo paths from IDs or use provided paths
  let repoPaths: string[] = [];
  if (repoIds && Array.isArray(repoIds)) {
    const allRepos = getRepos();
    for (const id of repoIds) {
      const repo = allRepos.find(r => r.id === id);
      if (repo) {
        repoPaths.push(repo.path);
        touchRepo(repo.path);
      }
    }
  }

  if (repoPaths.length === 0) {
    const allRepos = getRepos();
    repoPaths = allRepos.map(r => r.path);
  }

  if (repoPaths.length === 0) {
    res.status(400).json({ error: 'No repos configured. Add repos first.' });
    return;
  }

  // Build CLI args — always verbose so logs are captured
  const cliArgs = ['start', '--repos', ...repoPaths, '--verbose'];
  if (mic) cliArgs.push('--mic');
  if (micOnly) cliArgs.push('--mic-only');
  if (model) cliArgs.push('--model', model);
  if (speakers && Array.isArray(speakers)) cliArgs.push('--speakers', ...speakers);

  // Use local tsx binary directly to avoid nvm/PATH issues
  const projectRoot = join(import.meta.dirname, '..', '..', '..');
  const tsxBin = join(projectRoot, 'node_modules', '.bin', 'tsx');
  const entryScript = join(projectRoot, 'bin', 'contextprompt.ts');

  logger.debug(`Spawning: ${tsxBin} ${entryScript} ${cliArgs.join(' ')}`);

  const child = spawn(tsxBin, [entryScript, ...cliArgs], {
    cwd: projectRoot,
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: false,
    env: {
      ...process.env,
      // Ensure homebrew binaries (sox/rec) are available
      PATH: `/opt/homebrew/bin:/usr/local/bin:${process.env.PATH || ''}`,
    },
  });

  recordingProcess = child;
  setRecordingState({
    status: 'recording',
    startedAt: new Date().toISOString(),
    pid: child.pid ?? null,
    repos: repoPaths,
    logs: [],
  });

  child.stdout?.on('data', (data: Buffer) => {
    for (const line of data.toString().split('\n')) {
      addRecordingLog(line);
      logger.debug(`[recording] ${line.trim()}`);
    }
  });

  child.stderr?.on('data', (data: Buffer) => {
    for (const line of data.toString().split('\n')) {
      addRecordingLog(line);
      logger.debug(`[recording] ${line.trim()}`);
    }
  });

  child.on('error', (err) => {
    logger.error(`Recording process error: ${err.message}`);
    addRecordingLog(`Error: ${err.message}`);
    resetRecordingState();
    recordingProcess = null;
  });

  child.on('exit', (code, signal) => {
    logger.debug(`Recording process exited (code=${code}, signal=${signal})`);
    addRecordingLog(`Process exited (code=${code})`);
    resetRecordingState();
    recordingProcess = null;
  });

  res.json({ ok: true, pid: child.pid, repos: repoPaths });
});

// Stop recording
recordingRouter.post('/stop', (_req, res) => {
  const state = getRecordingState();
  if (state.status !== 'recording' || !recordingProcess) {
    res.status(409).json({ error: 'Not recording' });
    return;
  }

  setRecordingState({ status: 'processing' });

  // Send SIGINT to trigger graceful shutdown (same as Ctrl+C)
  recordingProcess.kill('SIGINT');

  res.json({ ok: true });
});
