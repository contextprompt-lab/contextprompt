import { describe, it, expect } from 'vitest';
import { buildIssueUserPrompt } from '../extractor.js';
import type { GitHubIssue } from '../../github/types.js';
import type { RepoMap } from '../../repo/types.js';

function makeIssue(overrides: Partial<GitHubIssue> = {}): GitHubIssue {
  return {
    title: 'Fix login bug',
    body: 'The login button does not work on mobile.',
    number: 42,
    url: 'https://github.com/acme/app/issues/42',
    author: 'alice',
    labels: ['bug'],
    comments: [],
    ...overrides,
  };
}

function makeRepoMap(overrides: Partial<RepoMap> = {}): RepoMap {
  return {
    name: 'app',
    rootPath: '/projects/app',
    fileTree: 'src/\n  login.ts\n  app.ts',
    files: [],
    readme: null,
    ...overrides,
  };
}

describe('buildIssueUserPrompt', () => {
  it('includes issue title and number', () => {
    const prompt = buildIssueUserPrompt(makeIssue(), [makeRepoMap()]);
    expect(prompt).toContain('## GitHub Issue #42: Fix login bug');
  });

  it('includes issue body', () => {
    const prompt = buildIssueUserPrompt(makeIssue(), [makeRepoMap()]);
    expect(prompt).toContain('The login button does not work on mobile.');
  });

  it('includes author', () => {
    const prompt = buildIssueUserPrompt(makeIssue(), [makeRepoMap()]);
    expect(prompt).toContain('**Author:** alice');
  });

  it('includes labels', () => {
    const prompt = buildIssueUserPrompt(makeIssue({ labels: ['bug', 'urgent'] }), [makeRepoMap()]);
    expect(prompt).toContain('**Labels:** bug, urgent');
  });

  it('omits labels line when empty', () => {
    const prompt = buildIssueUserPrompt(makeIssue({ labels: [] }), [makeRepoMap()]);
    expect(prompt).not.toContain('**Labels:**');
  });

  it('includes comments', () => {
    const issue = makeIssue({
      comments: [
        { author: 'bob', body: 'I can reproduce this on iOS.', createdAt: '2026-01-01T00:00:00Z' },
      ],
    });
    const prompt = buildIssueUserPrompt(issue, [makeRepoMap()]);
    expect(prompt).toContain('**bob**');
    expect(prompt).toContain('I can reproduce this on iOS.');
  });

  it('includes repo context', () => {
    const prompt = buildIssueUserPrompt(makeIssue(), [makeRepoMap()]);
    expect(prompt).toContain('## Codebase Map');
    expect(prompt).toContain('### Repo: app');
  });

  it('shows (empty) for missing body', () => {
    const prompt = buildIssueUserPrompt(makeIssue({ body: '' }), [makeRepoMap()]);
    expect(prompt).toContain('(empty)');
  });
});
