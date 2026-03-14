import { createInterface } from 'node:readline';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { getConfigDir, getEnvPath } from '../../src/config.js';
import { logger } from '../../src/utils/logger.js';

function prompt(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

export async function configCommand(): Promise<void> {
  const configDir = getConfigDir();
  const envPath = getEnvPath();

  // Load existing values
  let existingDeepgram = '';
  let existingAnthropic = '';

  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    const deepgramMatch = content.match(/DEEPGRAM_API_KEY=(.+)/);
    const anthropicMatch = content.match(/ANTHROPIC_API_KEY=(.+)/);
    if (deepgramMatch) existingDeepgram = deepgramMatch[1];
    if (anthropicMatch) existingAnthropic = anthropicMatch[1];
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('\nmeetcode configuration\n');

  const deepgramHint = existingDeepgram ? ` (current: ${mask(existingDeepgram)})` : '';
  const anthropicHint = existingAnthropic ? ` (current: ${mask(existingAnthropic)})` : '';

  const deepgramKey = await prompt(rl, `Deepgram API key${deepgramHint}: `);
  const anthropicKey = await prompt(rl, `Anthropic API key${anthropicHint}: `);

  rl.close();

  const finalDeepgram = deepgramKey || existingDeepgram;
  const finalAnthropic = anthropicKey || existingAnthropic;

  if (!finalDeepgram || !finalAnthropic) {
    logger.error('Both API keys are required.');
    process.exit(1);
  }

  // Write config
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true });
  }

  const envContent = `DEEPGRAM_API_KEY=${finalDeepgram}\nANTHROPIC_API_KEY=${finalAnthropic}\n`;
  writeFileSync(envPath, envContent, 'utf-8');

  console.log('');
  logger.success(`Configuration saved to ${envPath}`);
}

function mask(key: string): string {
  if (key.length <= 8) return '****';
  return key.slice(0, 4) + '...' + key.slice(-4);
}
