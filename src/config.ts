import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface MeetcodeConfig {
  deepgramApiKey: string;
  anthropicApiKey: string;
}

const CONFIG_DIR = join(homedir(), '.meetcode');
const ENV_PATH = join(CONFIG_DIR, '.env');

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getEnvPath(): string {
  return ENV_PATH;
}

export interface LoadConfigOptions {
  requireDeepgram?: boolean;
}

export function loadConfig(options: LoadConfigOptions = {}): MeetcodeConfig {
  const { requireDeepgram = true } = options;

  // Load from ~/.meetcode/.env first, then fall back to process.env
  if (existsSync(ENV_PATH)) {
    config({ path: ENV_PATH });
  } else {
    config(); // Try .env in cwd
  }

  const deepgramApiKey = process.env.DEEPGRAM_API_KEY ?? '';
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (requireDeepgram && !deepgramApiKey) {
    throw new Error(
      'DEEPGRAM_API_KEY not found. Run `meetcode config` to set up your API keys.'
    );
  }

  if (!anthropicApiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY not found. Run `meetcode config` to set up your API keys.'
    );
  }

  return { deepgramApiKey, anthropicApiKey };
}
