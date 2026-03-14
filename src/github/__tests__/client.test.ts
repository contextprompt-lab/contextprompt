import { describe, it, expect } from 'vitest';
import { parseIssueRef } from '../client.js';

describe('parseIssueRef', () => {
  it('parses full GitHub URL', () => {
    const ref = parseIssueRef('https://github.com/acme/widgets/issues/42');
    expect(ref).toEqual({ owner: 'acme', repo: 'widgets', number: 42 });
  });

  it('parses HTTPS URL with trailing slash', () => {
    const ref = parseIssueRef('https://github.com/acme/widgets/issues/42/');
    expect(ref).toEqual({ owner: 'acme', repo: 'widgets', number: 42 });
  });

  it('parses shorthand owner/repo#number', () => {
    const ref = parseIssueRef('acme/widgets#7');
    expect(ref).toEqual({ owner: 'acme', repo: 'widgets', number: 7 });
  });

  it('parses bare number', () => {
    const ref = parseIssueRef('123');
    expect(ref).toEqual({ owner: '', repo: '', number: 123 });
  });

  it('handles hyphens in owner and repo', () => {
    const ref = parseIssueRef('my-org/my-repo#99');
    expect(ref).toEqual({ owner: 'my-org', repo: 'my-repo', number: 99 });
  });

  it('handles dots in repo name', () => {
    const ref = parseIssueRef('https://github.com/org/repo.js/issues/5');
    expect(ref).toEqual({ owner: 'org', repo: 'repo.js', number: 5 });
  });

  it('throws on invalid input', () => {
    expect(() => parseIssueRef('not-a-ref')).toThrow('Could not parse issue reference');
  });

  it('throws on PR URL', () => {
    expect(() => parseIssueRef('https://github.com/acme/repo/pull/10')).toThrow('Could not parse issue reference');
  });

  it('throws on empty string', () => {
    expect(() => parseIssueRef('')).toThrow('Could not parse issue reference');
  });
});
