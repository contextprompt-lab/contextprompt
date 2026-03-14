#!/usr/bin/env node

import { Command } from 'commander';
import { startCommand } from './commands/start.js';
import { stopCommand } from './commands/stop.js';
import { configCommand } from './commands/config.js';
import { issueCommand } from './commands/issue.js';
import { dashboardCommand } from './commands/dashboard.js';

const program = new Command();

program
  .name('contextprompt')
  .description('Capture meeting conversations, understand your codebase, output structured coding tasks')
  .version('0.1.0');

program
  .command('start')
  .description('Start recording a meeting')
  .option('--repos <paths...>', 'Repo paths to scan', ['.'])
  .option('--output <path>', 'Output file path')
  .option('--speakers <labels...>', 'Speaker labels in order of appearance')
  .option('--model <model>', 'Claude model for task extraction', 'claude-sonnet-4-6')
  .option('--mic', 'Also capture microphone input (bidirectional)', false)
  .option('--mic-only', 'Capture microphone only, skip system audio', false)
  .option('--audio-device <name>', 'Audio device name for system capture (Windows)')
  .option('--verbose', 'Show real-time transcript in terminal', false)
  .action(startCommand);

program
  .command('stop')
  .description('Stop a running contextprompt session')
  .action(stopCommand);

program
  .command('config')
  .description('Configure API keys')
  .action(configCommand);

program
  .command('issue <url>')
  .description('Analyze a GitHub issue and generate an execution plan')
  .option('--repo <path>', 'Local repo path to scan', '.')
  .option('--model <model>', 'Claude model for task extraction', 'claude-sonnet-4-6')
  .option('--output <path>', 'Output file path')
  .option('--verbose', 'Show debug output', false)
  .action(issueCommand);

program
  .command('dashboard')
  .description('Open the contextprompt web dashboard')
  .option('--port <port>', 'Port for the dashboard server', '3847')
  .action((opts) => dashboardCommand({ port: parseInt(opts.port, 10) }));

// Default to dashboard when run with no args
if (process.argv.length <= 2) {
  process.argv.push('dashboard');
}

program.parse();
