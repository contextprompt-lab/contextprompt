import { Router } from 'express';
import { spawn, type ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { getRepos, touchRepo } from '../db.js';
import { logger } from '../../utils/logger.js';

export const recordingRouter = Router();

interface RecordingState {
  status: 'idle' | 'recording' | 'processing';
  startedAt: string | null;
  pid: number | null;
  repos: string[];
  logs: string[];
}

let recordingState: RecordingState = {
  status: 'idle',
  startedAt: null,
  pid: null,
  repos: [],
  logs: [],
};

let recordingProcess: ChildProcess | null = null;

export function getRecordingStatus(): RecordingState {
  return { ...recordingState };
}

// Get recording status (includes recent logs)
recordingRouter.get('/status', (_req, res) => {
  res.json(getRecordingStatus());
});

// Start recording
recordingRouter.post('/start', (req, res) => {
  if (recordingState.status !== 'idle') {
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
  const entryScript = join(projectRoot, 'bin', 'meetcode.ts');

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
  recordingState = {
    status: 'recording',
    startedAt: new Date().toISOString(),
    pid: child.pid ?? null,
    repos: repoPaths,
    logs: [],
  };

  const addLog = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    recordingState.logs.push(trimmed);
    // Keep last 50 lines
    if (recordingState.logs.length > 50) {
      recordingState.logs = recordingState.logs.slice(-50);
    }
    logger.debug(`[recording] ${trimmed}`);
  };

  child.stdout?.on('data', (data: Buffer) => {
    for (const line of data.toString().split('\n')) {
      addLog(line);
    }
  });

  child.stderr?.on('data', (data: Buffer) => {
    for (const line of data.toString().split('\n')) {
      addLog(line);
    }
  });

  child.on('error', (err) => {
    logger.error(`Recording process error: ${err.message}`);
    addLog(`Error: ${err.message}`);
    recordingState.status = 'idle';
    recordingState.pid = null;
    recordingProcess = null;
  });

  child.on('exit', (code, signal) => {
    logger.debug(`Recording process exited (code=${code}, signal=${signal})`);
    addLog(`Process exited (code=${code})`);
    recordingState = {
      status: 'idle',
      startedAt: null,
      pid: null,
      repos: [],
      logs: recordingState.logs, // Preserve logs so dashboard can show them
    };
    recordingProcess = null;
  });

  res.json({ ok: true, pid: child.pid, repos: repoPaths });
});

// Stop recording
recordingRouter.post('/stop', (_req, res) => {
  if (recordingState.status !== 'recording' || !recordingProcess) {
    res.status(409).json({ error: 'Not recording' });
    return;
  }

  recordingState.status = 'processing';

  // Send SIGINT to trigger graceful shutdown (same as Ctrl+C)
  recordingProcess.kill('SIGINT');

  res.json({ ok: true });
});
