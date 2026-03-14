import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export interface ContextPromptConfig {
  anthropicApiKey: string;
}

const CONFIG_DIR = join(homedir(), '.contextprompt');
const ENV_PATH = join(CONFIG_DIR, '.env');

export function getConfigDir(): string {
  return CONFIG_DIR;
}

export function getEnvPath(): string {
  return ENV_PATH;
}

export function loadConfig(): ContextPromptConfig {
  // Load from ~/.contextprompt/.env first, then fall back to process.env
  if (existsSync(ENV_PATH)) {
    config({ path: ENV_PATH });
  } else {
    config(); // Try .env in cwd
  }

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!anthropicApiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY not found. Run `contextprompt config` to set up your API keys.'
    );
  }

  return { anthropicApiKey };
}
