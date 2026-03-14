import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync, watchFile, unwatchFile } from 'node:fs';
import { join } from 'node:path';
import { getConfigDir } from '../config.js';

const LOCKFILE_NAME = 'contextprompt.pid';
const STOP_SENTINEL = 'contextprompt.stop';

function getLockfilePath(): string {
  return join(getConfigDir(), LOCKFILE_NAME);
}

function getStopSentinelPath(): string {
  return join(getConfigDir(), STOP_SENTINEL);
}

export function writeLockfile(): void {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(getLockfilePath(), String(process.pid), 'utf-8');
  // Clean up any stale stop sentinel
  removeStopSentinel();
}

export function readLockfile(): number | null {
  const path = getLockfilePath();
  if (!existsSync(path)) return null;

  const pid = parseInt(readFileSync(path, 'utf-8').trim(), 10);
  if (isNaN(pid)) return null;

  // Check if process is still running
  try {
    process.kill(pid, 0);
    return pid;
  } catch {
    // Process not running, stale lockfile
    removeLockfile();
    return null;
  }
}

export function removeLockfile(): void {
  const path = getLockfilePath();
  if (existsSync(path)) {
    unlinkSync(path);
  }
}

/**
 * Write a stop sentinel file to signal the running process to shut down.
 * Used on Windows where SIGUSR2 is not available.
 */
export function writeStopSentinel(): void {
  const dir = getConfigDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(getStopSentinelPath(), String(Date.now()), 'utf-8');
}

export function removeStopSentinel(): void {
  const path = getStopSentinelPath();
  if (existsSync(path)) {
    unlinkSync(path);
  }
}

/**
 * Watch for the stop sentinel file to appear.
 * Calls the callback once when detected, then cleans up.
 */
export function watchForStopSentinel(callback: () => void): () => void {
  const path = getStopSentinelPath();

  // Poll every 500ms — fs.watchFile is more reliable cross-platform than fs.watch
  watchFile(path, { interval: 500 }, (curr) => {
    if (curr.size > 0) {
      unwatchFile(path);
      removeStopSentinel();
      callback();
    }
  });

  // Return cleanup function
  return () => {
    unwatchFile(path);
    removeStopSentinel();
  };
}
