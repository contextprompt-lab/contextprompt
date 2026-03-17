import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { GitHubIssue, GitHubComment, GitHubIssueSummary, IssueRef } from './types.js';

const execFileAsync = promisify(execFile);

const ISSUE_URL_RE = /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/issues\/(\d+)/;
const SHORTHAND_RE = /^([^/]+)\/([^#]+)#(\d+)$/;
const NUMBER_RE = /^(\d+)$/;

export function parseIssueRef(input: string): IssueRef {
  let match = input.match(ISSUE_URL_RE);
  if (match) {
    return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) };
  }

  match = input.match(SHORTHAND_RE);
  if (match) {
    return { owner: match[1], repo: match[2], number: parseInt(match[3], 10) };
  }

  match = input.match(NUMBER_RE);
  if (match) {
    return { owner: '', repo: '', number: parseInt(match[1], 10) };
  }

  throw new Error(
    `Could not parse issue reference: "${input}". ` +
    `Use https://github.com/owner/repo/issues/123 or owner/repo#123 or just a number.`
  );
}

/** Check if gh CLI is available (used by CLI command only) */
export async function checkGhInstalled(): Promise<void> {
  try {
    await execFileAsync('gh', ['--version']);
  } catch {
    throw new Error(
      'The `gh` CLI is required for the issue command. ' +
      'Install it from https://cli.github.com/'
    );
  }
}

async function githubApiFetch(path: string, token?: string): Promise<unknown> {
  const url = `https://api.github.com${path}`;
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'contextprompt',
  };

  // Use provided token, fall back to environment variable
  const authToken = token || process.env.GITHUB_TOKEN;
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GitHub API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

export async function fetchIssue(ref: IssueRef, token?: string): Promise<GitHubIssue> {
  const [issueData, commentsData] = await Promise.all([
    githubApiFetch(`/repos/${ref.owner}/${ref.repo}/issues/${ref.number}`, token) as Promise<Record<string, any>>,
    githubApiFetch(`/repos/${ref.owner}/${ref.repo}/issues/${ref.number}/comments?per_page=100`, token) as Promise<Array<Record<string, any>>>,
  ]);

  return {
    title: issueData.title ?? '',
    body: issueData.body ?? '',
    number: issueData.number ?? ref.number,
    url: issueData.html_url ?? '',
    author: issueData.user?.login ?? '',
    labels: (issueData.labels ?? []).map((l: { name: string } | string) =>
      typeof l === 'string' ? l : l.name
    ),
    comments: (commentsData ?? []).map((c: Record<string, any>) => ({
      author: c.user?.login ?? '',
      body: c.body ?? '',
      createdAt: c.created_at ?? '',
    } satisfies GitHubComment)),
  };
}

const GITHUB_REMOTE_RE = /github\.com[/:]([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i;

export function parseGithubRemote(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim();
  const match = trimmed.match(GITHUB_REMOTE_RE);
  if (!match) return null;

  return {
    owner: match[1],
    repo: match[2],
  };
}

export async function detectGithubRemote(repoPath: string): Promise<{ owner: string; repo: string } | null> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', repoPath, 'remote', 'get-url', 'origin']);
    return parseGithubRemote(stdout);
  } catch {
    return null;
  }
}

export async function listOpenIssues(owner: string, repo: string, token?: string): Promise<GitHubIssueSummary[]> {
  const data = await githubApiFetch(
    `/repos/${owner}/${repo}/issues?state=open&per_page=50&sort=created&direction=desc`,
    token,
  ) as Array<Record<string, any>>;

  // GitHub API returns PRs in the issues endpoint — filter them out
  return data
    .filter((d) => !d.pull_request)
    .map((d) => ({
      number: d.number ?? 0,
      title: d.title ?? '',
      url: d.html_url ?? '',
      author: d.user?.login ?? '',
      labels: (d.labels ?? []).map((l: { name: string } | string) =>
        typeof l === 'string' ? l : l.name
      ),
      createdAt: d.created_at ?? '',
    }));
}
