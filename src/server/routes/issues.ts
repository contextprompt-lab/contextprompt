import { Router } from 'express';
import { existsSync } from 'node:fs';
import {
  getRepo,
  getRepos,
  getIssueAnalyses,
  getIssueAnalysis,
  insertIssueAnalysis,
  updateIssueAnalysisStatus,
  deleteIssueAnalysis,
  getSetting,
} from '../db.js';
import { checkGhInstalled, fetchIssue, listOpenIssues } from '../../github/client.js';
import { scanRepo } from '../../repo/scanner.js';
import { extractTasksFromIssue } from '../../tasks/extractor.js';
import { loadConfig } from '../../config.js';
import { logger } from '../../utils/logger.js';

export const issuesRouter = Router();

// List open issues from GitHub for connected repos
issuesRouter.get('/', async (req, res) => {
  const repoId = req.query.repo_id ? parseInt(req.query.repo_id as string, 10) : undefined;

  try {
    await checkGhInstalled();
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }

  try {
    const repos = repoId ? [getRepo(repoId)].filter(Boolean) : getRepos();
    const connectedRepos = repos.filter((r) => r!.github_owner && r!.github_repo);

    if (connectedRepos.length === 0) {
      res.json([]);
      return;
    }

    const allIssues: Array<Record<string, unknown>> = [];
    for (const repo of connectedRepos) {
      try {
        const issues = await listOpenIssues(repo!.github_owner!, repo!.github_repo!);
        for (const issue of issues) {
          allIssues.push({
            ...issue,
            repo_id: repo!.id,
            repo_name: repo!.name,
            github_owner: repo!.github_owner,
            github_repo: repo!.github_repo,
          });
        }
      } catch (err) {
        logger.warn(`Failed to fetch issues for ${repo!.github_owner}/${repo!.github_repo}: ${(err as Error).message}`);
      }
    }

    res.json(allIssues);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// List stored analyses
issuesRouter.get('/analyses', (req, res) => {
  const repoId = req.query.repo_id ? parseInt(req.query.repo_id as string, 10) : undefined;
  const analyses = getIssueAnalyses(repoId);

  // Enrich with repo name
  const repos = new Map(getRepos().map((r) => [r.id, r]));
  const enriched = analyses.map((a) => ({
    ...a,
    repo_name: repos.get(a.repo_id)?.name ?? 'Unknown',
  }));

  res.json(enriched);
});

// Get single analysis with full plan
issuesRouter.get('/analyses/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid analysis ID' });
    return;
  }

  const analysis = getIssueAnalysis(id);
  if (!analysis) {
    res.status(404).json({ error: 'Analysis not found' });
    return;
  }

  const repo = getRepo(analysis.repo_id);
  let plan = null;
  if (analysis.plan_json) {
    try {
      plan = JSON.parse(analysis.plan_json);
    } catch {
      // corrupted JSON
    }
  }

  let labels: string[] = [];
  if (analysis.issue_labels_json) {
    try {
      labels = JSON.parse(analysis.issue_labels_json);
    } catch {
      // ignore
    }
  }

  res.json({
    ...analysis,
    plan,
    labels,
    repo_name: repo?.name ?? 'Unknown',
  });
});

// Poll analysis status
issuesRouter.get('/analyses/:id/status', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid analysis ID' });
    return;
  }

  const analysis = getIssueAnalysis(id);
  if (!analysis) {
    res.status(404).json({ error: 'Analysis not found' });
    return;
  }

  res.json({ id: analysis.id, status: analysis.status, error: analysis.error });
});

// Trigger analysis for an issue
issuesRouter.post('/analyze', async (req, res) => {
  const { repo_id, issue_number } = req.body as { repo_id?: number; issue_number?: number };

  if (!repo_id || !issue_number) {
    res.status(400).json({ error: 'Missing repo_id or issue_number' });
    return;
  }

  const repo = getRepo(repo_id);
  if (!repo) {
    res.status(404).json({ error: 'Repo not found' });
    return;
  }

  if (!repo.github_owner || !repo.github_repo) {
    res.status(400).json({ error: 'Repo is not connected to GitHub' });
    return;
  }

  // Get API key
  let apiKey = getSetting('auth_token');
  if (!apiKey) {
    try {
      const config = loadConfig();
      apiKey = config.anthropicApiKey;
    } catch {
      res.status(400).json({ error: 'No Anthropic API key configured. Set it in Settings.' });
      return;
    }
  }

  // Create analysis record
  const analysisId = insertIssueAnalysis({
    repo_id,
    issue_number,
    issue_url: `https://github.com/${repo.github_owner}/${repo.github_repo}/issues/${issue_number}`,
    issue_title: `Issue #${issue_number}`,
    status: 'analyzing',
  });

  // Gather all dashboard repos for cross-referencing
  const allRepos = getRepos();
  const repoPaths = allRepos
    .filter((r) => existsSync(r.path))
    .map((r) => r.path);

  // Return immediately, run analysis async
  res.json({ id: analysisId, status: 'analyzing' });

  // Fire-and-forget analysis
  const model = getSetting('default_model') || 'claude-sonnet-4-6';
  const language = getSetting('response_language') || undefined;
  runAnalysis(analysisId, repo.github_owner, repo.github_repo, issue_number, repoPaths, apiKey, model, language);
});

// Delete an analysis
issuesRouter.delete('/analyses/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid analysis ID' });
    return;
  }

  deleteIssueAnalysis(id);
  res.json({ ok: true });
});

async function runAnalysis(
  analysisId: number,
  owner: string,
  repo: string,
  issueNumber: number,
  repoPaths: string[],
  apiKey: string,
  model: string,
  language?: string,
): Promise<void> {
  try {
    // Fetch full issue details
    logger.info(`Fetching issue ${owner}/${repo}#${issueNumber}...`);
    const issue = await fetchIssue({ owner, repo, number: issueNumber });

    // Update the analysis record with issue details
    const db = await import('../db.js');
    db.updateIssueAnalysisStatus(analysisId, 'analyzing');
    const dbHandle = db.getDb();
    dbHandle.prepare(
      'UPDATE issue_analyses SET issue_title = ?, issue_body = ?, issue_author = ?, issue_labels_json = ? WHERE id = ?'
    ).run(issue.title, issue.body, issue.author, JSON.stringify(issue.labels), analysisId);

    // Scan all repos for cross-referencing
    logger.info(`Scanning ${repoPaths.length} repo(s)...`);
    const repoMaps = await Promise.all(
      repoPaths.map(async (path) => {
        try {
          return await scanRepo(path);
        } catch (err) {
          logger.warn(`Failed to scan repo at ${path}: ${(err as Error).message}`);
          return null;
        }
      })
    );
    const validRepoMaps = repoMaps.filter((m) => m !== null);

    if (validRepoMaps.length === 0) {
      throw new Error('No repos could be scanned');
    }

    // Extract tasks via Claude with all repo context
    logger.info(`Analyzing issue with Claude (${model}) across ${validRepoMaps.length} repo(s)...`);
    const plan = await extractTasksFromIssue(issue, validRepoMaps, apiKey, model, language);

    // Update with results
    updateIssueAnalysisStatus(
      analysisId,
      'completed',
      JSON.stringify(plan),
      plan.tasks.length,
    );
    logger.info(`Analysis complete: ${plan.tasks.length} task(s) extracted`);
  } catch (err) {
    logger.error(`Analysis failed: ${(err as Error).message}`);
    updateIssueAnalysisStatus(analysisId, 'failed', undefined, undefined, (err as Error).message);
  }
}
