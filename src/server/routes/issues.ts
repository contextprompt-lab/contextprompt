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
import { fetchIssue, listOpenIssues } from '../../github/client.js';
import { scanRepo } from '../../repo/scanner.js';
import type { RepoMap } from '../../repo/types.js';
import { extractTasksFromIssue } from '../../tasks/extractor.js';
import { loadConfig } from '../../config.js';
import { logger } from '../../utils/logger.js';

export const issuesRouter = Router();

// List open issues from GitHub for connected repos
issuesRouter.get('/', async (req, res) => {
  const repoId = req.query.repo_id ? parseInt(req.query.repo_id as string, 10) : undefined;

  try {
    const repos = repoId ? [getRepo(repoId, req.userId)].filter(Boolean) : getRepos(req.userId);
    const connectedRepos = repos.filter((r) => r!.github_owner && r!.github_repo);

    if (connectedRepos.length === 0) {
      res.json([]);
      return;
    }

    const githubToken = getSetting('github_token', req.userId);

    const allIssues: Array<Record<string, unknown>> = [];
    const fetchErrors: string[] = [];
    for (const repo of connectedRepos) {
      try {
        const issues = await listOpenIssues(repo!.github_owner!, repo!.github_repo!, githubToken);
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
        const message = `Failed to fetch issues for ${repo!.github_owner}/${repo!.github_repo}: ${(err as Error).message}`;
        logger.warn(message);
        fetchErrors.push(message);
      }
    }

    if (allIssues.length === 0 && fetchErrors.length > 0) {
      const help = githubToken
        ? 'Check that the connected owner/repo is correct and that the token has access to this repository.'
        : 'If this is a private repository, add a GitHub token in Settings.';
      res.status(502).json({ error: `${fetchErrors.join(' ')} ${help}` });
      return;
    }

    res.json(allIssues);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// List stored analyses
issuesRouter.get('/analyses', (req, res) => {
  const repoId = req.query.repo_id ? parseInt(req.query.repo_id as string, 10) : undefined;
  const analyses = getIssueAnalyses(repoId, req.userId);

  // Enrich with repo name
  const repos = new Map(getRepos(req.userId).map((r) => [r.id, r]));
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
  const { repo_id, issue_number, repo_maps } = req.body as {
    repo_id?: number;
    issue_number?: number;
    repo_maps?: RepoMap[];
  };

  if (!repo_id || !issue_number) {
    res.status(400).json({ error: 'Missing repo_id or issue_number' });
    return;
  }

  const repo = getRepo(repo_id, req.userId);
  if (!repo) {
    res.status(404).json({ error: 'Repo not found' });
    return;
  }

  if (!repo.github_owner || !repo.github_repo) {
    res.status(400).json({ error: 'Repo is not connected to GitHub' });
    return;
  }

  // Get API key
  let apiKey = getSetting('auth_token', req.userId);
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
    user_id: req.userId,
  });

  // Gather server-side repos that exist on disk
  const allRepos = getRepos(req.userId);
  const repoPaths = allRepos
    .filter((r) => existsSync(r.path))
    .map((r) => r.path);

  // Client-provided repo maps (from browser File System Access API)
  const clientRepoMaps = Array.isArray(repo_maps) ? repo_maps as RepoMap[] : [];

  // Return immediately, run analysis async
  res.json({ id: analysisId, status: 'analyzing' });

  // Fire-and-forget analysis
  const model = getSetting('default_model', req.userId) || 'claude-sonnet-4-6';
  const language = getSetting('response_language', req.userId) || undefined;
  const githubToken = getSetting('github_token', req.userId);
  runAnalysis(analysisId, repo.github_owner, repo.github_repo, issue_number, repoPaths, clientRepoMaps, apiKey, model, language, githubToken);
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
  clientRepoMaps: RepoMap[],
  apiKey: string,
  model: string,
  language?: string,
  githubToken?: string,
): Promise<void> {
  try {
    // Fetch full issue details
    logger.info(`Fetching issue ${owner}/${repo}#${issueNumber}...`);
    const issue = await fetchIssue({ owner, repo, number: issueNumber }, githubToken);

    // Update the analysis record with issue details
    const db = await import('../db.js');
    db.updateIssueAnalysisStatus(analysisId, 'analyzing');
    const dbHandle = db.getDb();
    dbHandle.prepare(
      'UPDATE issue_analyses SET issue_title = ?, issue_body = ?, issue_author = ?, issue_labels_json = ? WHERE id = ?'
    ).run(issue.title, issue.body, issue.author, JSON.stringify(issue.labels), analysisId);

    // Combine client-provided repo maps with server-side scanned repos
    const validRepoMaps: RepoMap[] = [...clientRepoMaps];

    // Scan server-side repos that exist on disk
    if (repoPaths.length > 0) {
      logger.info(`Scanning ${repoPaths.length} local repo(s)...`);
      const scanned = await Promise.all(
        repoPaths.map(async (path) => {
          try {
            return await scanRepo(path);
          } catch (err) {
            logger.warn(`Failed to scan repo at ${path}: ${(err as Error).message}`);
            return null;
          }
        })
      );
      validRepoMaps.push(...scanned.filter((m) => m !== null));
    }

    logger.info(`${validRepoMaps.length} repo map(s) available (${clientRepoMaps.length} from browser, ${validRepoMaps.length - clientRepoMaps.length} from server)`);

    if (validRepoMaps.length === 0) {
      throw new Error('No repos could be scanned. Make sure your repos are connected and accessible.');
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
