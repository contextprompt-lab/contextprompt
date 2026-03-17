import { Router } from 'express';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, basename, join } from 'node:path';
import { homedir } from 'node:os';
import { getRepos, getRepo, addRepo, removeRepo, updateRepoGithub } from '../db.js';
import { detectGithubRemote } from '../../github/client.js';

export const reposRouter = Router();

// List all repos
reposRouter.get('/', (req, res) => {
  const repos = getRepos(req.userId);
  res.json(repos.map(r => ({
    ...r,
    // Browser repos are always "exists" — they live on the user's machine
    exists: r.path.startsWith('browser://') || existsSync(r.path),
  })));
});

// Add a repo (local disk path — used when running locally)
reposRouter.post('/', (req, res) => {
  const { path: rawPath } = req.body;

  if (!rawPath || typeof rawPath !== 'string') {
    res.status(400).json({ error: 'Missing path' });
    return;
  }

  const fullPath = resolve(rawPath);
  if (!existsSync(fullPath)) {
    res.status(400).json({ error: `Path does not exist: ${fullPath}` });
    return;
  }

  const name = basename(fullPath);
  const id = addRepo(fullPath, name, req.userId);
  res.json({ id, path: fullPath, name });
});

// Register a browser-connected repo (no files on server — scanned client-side)
reposRouter.post('/register', (req, res) => {
  const { name, github_owner, github_repo } = req.body as {
    name?: string;
    github_owner?: string;
    github_repo?: string;
  };

  if (!name || typeof name !== 'string') {
    res.status(400).json({ error: 'Missing name' });
    return;
  }

  const safeName = name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const browserPath = `browser://${safeName}`;
  const id = addRepo(browserPath, safeName, req.userId);

  // Auto-connect GitHub if detected client-side from .git/config
  if (github_owner && github_repo) {
    const cleanOwner = github_owner.split(/[\s/]/)[0];
    const cleanRepo = github_repo.split(/[\s/]/)[0].replace(/\.git$/, '');
    updateRepoGithub(id, cleanOwner, cleanRepo);
  }

  res.json({ id, path: browserPath, name: safeName });
});

// Browse directories on disk
reposRouter.get('/browse', (req, res) => {
  const rawPath = (req.query.path as string) || homedir();
  const dirPath = resolve(rawPath);

  if (!existsSync(dirPath)) {
    res.status(400).json({ error: `Path does not exist: ${dirPath}` });
    return;
  }

  try {
    const entries = readdirSync(dirPath);
    const dirs: Array<{ name: string; path: string; isGitRepo: boolean }> = [];

    for (const entry of entries) {
      // Skip hidden files/dirs except .git check
      if (entry.startsWith('.') && entry !== '.git') continue;
      if (entry === '.git') continue;
      if (entry === 'node_modules') continue;

      const fullPath = join(dirPath, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          const isGitRepo = existsSync(join(fullPath, '.git'));
          dirs.push({ name: entry, path: fullPath, isGitRepo });
        }
      } catch {
        // Skip entries we can't stat (permission errors etc.)
      }
    }

    // Sort: git repos first, then alphabetical
    dirs.sort((a, b) => {
      if (a.isGitRepo !== b.isGitRepo) return a.isGitRepo ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    res.json({
      current: dirPath,
      parent: resolve(dirPath, '..'),
      dirs,
    });
  } catch (err) {
    res.status(500).json({ error: `Cannot read directory: ${(err as Error).message}` });
  }
});

// Connect or update GitHub remote for a repo
reposRouter.patch('/:id/github', async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid repo ID' });
    return;
  }

  const repo = getRepo(id, req.userId);
  if (!repo) {
    res.status(404).json({ error: 'Repo not found' });
    return;
  }

  let { owner, repo: repoName } = req.body as { owner?: string; repo?: string };

  // Auto-detect from git remote if not provided
  if (!owner || !repoName) {
    const detected = await detectGithubRemote(repo.path);
    if (!detected) {
      res.status(400).json({ error: 'Could not detect GitHub remote. Please provide owner and repo manually.' });
      return;
    }
    owner = detected.owner;
    repoName = detected.repo;
  }

  // Sanitize — strip anything after the repo/owner name
  owner = owner.split(/[\s/]/)[0];
  repoName = repoName.split(/[\s/]/)[0].replace(/\.git$/, '');

  updateRepoGithub(id, owner, repoName);
  res.json({ ok: true, github_owner: owner, github_repo: repoName });
});

// Disconnect GitHub remote
reposRouter.delete('/:id/github', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid repo ID' });
    return;
  }

  updateRepoGithub(id, null, null);
  res.json({ ok: true });
});

// Remove a repo
reposRouter.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: 'Invalid repo ID' });
    return;
  }

  removeRepo(id);
  res.json({ ok: true });
});
