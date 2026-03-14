import { resolve } from 'node:path';
import { writeFileSync, existsSync } from 'node:fs';
import ora from 'ora';
import chalk from 'chalk';
import { loadConfig } from '../../src/config.js';
import { parseIssueRef, checkGhInstalled, fetchIssue } from '../../src/github/client.js';
import { scanRepo } from '../../src/repo/scanner.js';
import { extractTasksFromIssue } from '../../src/tasks/extractor.js';
import { renderIssueComment, generateOutputFilename } from '../../src/output/markdown.js';
import { logger, setLogLevel } from '../../src/utils/logger.js';

interface IssueOptions {
  repo: string;
  model: string;
  output?: string;
  verbose: boolean;
}

export async function issueCommand(url: string, options: IssueOptions): Promise<void> {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }

  if (options.verbose) {
    setLogLevel('debug');
  }

  const spinner = ora();

  // Parse issue reference
  let ref;
  try {
    ref = parseIssueRef(url);
  } catch (err) {
    logger.error((err as Error).message);
    process.exit(1);
  }

  // Check gh CLI is available
  spinner.start('Checking gh CLI...');
  try {
    await checkGhInstalled();
    spinner.succeed('gh CLI available');
  } catch (err) {
    spinner.fail((err as Error).message);
    process.exit(1);
  }

  // Validate repo path
  const repoPath = resolve(options.repo);
  if (!existsSync(repoPath)) {
    logger.error(`Repo path does not exist: ${repoPath}`);
    process.exit(1);
  }

  // Fetch issue
  const refLabel = ref.owner && ref.repo
    ? `${ref.owner}/${ref.repo}#${ref.number}`
    : `#${ref.number}`;
  spinner.start(`Fetching issue ${refLabel}...`);
  let issue;
  try {
    issue = await fetchIssue(ref);
    spinner.succeed(`Fetched: ${issue.title}`);
  } catch (err) {
    spinner.fail(`Failed to fetch issue: ${(err as Error).message}`);
    process.exit(1);
  }

  // Scan repo
  spinner.start(`Scanning repo at ${repoPath}...`);
  let repoMap;
  try {
    repoMap = await scanRepo(repoPath);
    spinner.succeed(`Scanned ${repoMap.files.length} files`);
  } catch (err) {
    spinner.fail(`Failed to scan repo: ${(err as Error).message}`);
    process.exit(1);
  }

  // Extract tasks via Claude
  spinner.start('Extracting tasks with Claude...');
  let plan;
  try {
    plan = await extractTasksFromIssue(issue, [repoMap], config.anthropicApiKey, options.model);
    spinner.succeed(`Extracted ${plan.tasks.length} task(s)`);
  } catch (err) {
    spinner.fail(`Failed to extract tasks: ${(err as Error).message}`);
    process.exit(1);
  }

  // Render markdown
  const markdown = renderIssueComment(plan, issue.title, issue.number);

  // Write output
  const outputPath = options.output || generateOutputFilename();
  writeFileSync(outputPath, markdown, 'utf-8');
  console.log(chalk.green(`\n✓ Plan written to ${outputPath}`));
  console.log(chalk.dim(`  ${plan.tasks.length} task(s), ${plan.decisions.length} decision(s)`));
}
