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

export async function fetchIssue(ref: IssueRef): Promise<GitHubIssue> {
  const target = ref.owner && ref.repo
    ? `${ref.owner}/${ref.repo}`
    : undefined;

  const args = ['issue', 'view', String(ref.number),
    '--json', 'title,body,number,url,author,labels,comments',
  ];
  if (target) {
    args.push('--repo', target);
  }

  const { stdout } = await execFileAsync('gh', args);
  const data = JSON.parse(stdout);

  return {
    title: data.title ?? '',
    body: data.body ?? '',
    number: data.number ?? ref.number,
    url: data.url ?? '',
    author: data.author?.login ?? data.author ?? '',
    labels: (data.labels ?? []).map((l: { name: string } | string) =>
      typeof l === 'string' ? l : l.name
    ),
    comments: (data.comments ?? []).map((c: { author?: { login?: string }; body?: string; createdAt?: string }) => ({
      author: c.author?.login ?? '',
      body: c.body ?? '',
      createdAt: c.createdAt ?? '',
    } satisfies GitHubComment)),
  };
}

const GITHUB_HTTPS_RE = /github\.com[/:]([^/]+)\/([^/.]+)/;

export async function detectGithubRemote(repoPath: string): Promise<{ owner: string; repo: string } | null> {
  try {
    const { stdout } = await execFileAsync('git', ['-C', repoPath, 'remote', 'get-url', 'origin']);
    const url = stdout.trim();
    const match = url.match(GITHUB_HTTPS_RE);
    if (match) {
      return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
    }
    return null;
  } catch {
    return null;
  }
}

export async function listOpenIssues(owner: string, repo: string): Promise<GitHubIssueSummary[]> {
  const { stdout } = await execFileAsync('gh', [
    'issue', 'list',
    '--repo', `${owner}/${repo}`,
    '--state', 'open',
    '--json', 'number,title,url,author,labels,createdAt',
    '--limit', '50',
  ]);

  const data = JSON.parse(stdout);
  return (data as Array<Record<string, unknown>>).map((d) => ({
    number: (d.number as number) ?? 0,
    title: (d.title as string) ?? '',
    url: (d.url as string) ?? '',
    author: (d.author as { login?: string })?.login ?? '',
    labels: ((d.labels ?? []) as Array<{ name: string } | string>).map((l) =>
      typeof l === 'string' ? l : l.name
    ),
    createdAt: (d.createdAt as string) ?? '',
  }));
}
