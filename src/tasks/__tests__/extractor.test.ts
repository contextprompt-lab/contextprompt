import { describe, it, expect, vi } from 'vitest';
import { parseClaudeResponse, describeRepo } from '../extractor.js';
import type { RepoMap } from '../../repo/types.js';

describe('parseClaudeResponse', () => {
  it('parses valid JSON response with new schema', () => {
    const json = JSON.stringify({
      decisions: ['Fix the login bug', 'Add dark mode'],
      execution_buckets: {
        ready_now: ['T1'],
        review_before_execution: [],
        needs_clarification: [],
      },
      tasks: [{
        id: 'T1',
        title: 'Do something',
        status: 'ready',
        confidence: 'high',
        confidence_reason: 'Speaker explicitly named the file',
        why_this_task_exists: 'Meeting requested it',
        proposed_change: 'Change the thing',
        high_confidence_files: [{ path: 'src/foo.ts', reason: 'Directly referenced' }],
        possible_related_files: [{ path: 'src/bar.ts', reason: 'Same directory' }],
        evidence: 'They said to do it',
        ambiguities: ['Unclear which variant'],
        task_assumptions: ['Assuming React Native'],
        dependencies: [],
        agent_steps: ['Open src/foo.ts', 'Make the change'],
      }],
      assumptions: ['App uses React'],
      incomplete_items: [],
    });

    const result = parseClaudeResponse(json);
    expect(result.decisions).toEqual(['Fix the login bug', 'Add dark mode']);
    expect(result.execution_buckets.ready_now).toEqual(['T1']);
    expect(result.tasks).toHaveLength(1);
    expect(result.tasks[0].title).toBe('Do something');
    expect(result.tasks[0].status).toBe('ready');
    expect(result.tasks[0].confidence).toBe('high');
    expect(result.tasks[0].confidence_reason).toBe('Speaker explicitly named the file');
    expect(result.tasks[0].why_this_task_exists).toBe('Meeting requested it');
    expect(result.tasks[0].proposed_change).toBe('Change the thing');
    expect(result.tasks[0].high_confidence_files).toEqual([{ path: 'src/foo.ts', reason: 'Directly referenced' }]);
    expect(result.tasks[0].possible_related_files).toEqual([{ path: 'src/bar.ts', reason: 'Same directory' }]);
    expect(result.tasks[0].ambiguities).toEqual(['Unclear which variant']);
    expect(result.tasks[0].task_assumptions).toEqual(['Assuming React Native']);
    expect(result.tasks[0].agent_steps).toEqual(['Open src/foo.ts', 'Make the change']);
    expect(result.assumptions).toEqual(['App uses React']);
  });

  it('parses JSON wrapped in markdown fences', () => {
    const text = '```json\n{"decisions": [], "tasks": [], "assumptions": [], "incomplete_items": []}\n```';
    const result = parseClaudeResponse(text);
    expect(result.decisions).toEqual([]);
    expect(result.tasks).toEqual([]);
  });

  it('parses JSON with surrounding text', () => {
    const text = 'Here is the output:\n\n{"decisions": ["Do X"], "tasks": [{"id": "T1", "title": "Task one", "status": "ready", "confidence": "medium"}], "assumptions": [], "incomplete_items": []}\n\nHope this helps!';
    const result = parseClaudeResponse(text);
    expect(result.decisions).toEqual(['Do X']);
    expect(result.tasks).toHaveLength(1);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseClaudeResponse('not json at all')).toThrow('Failed to parse Claude response');
  });

  it('throws on completely empty input', () => {
    expect(() => parseClaudeResponse('')).toThrow();
  });

  it('applies defaults for missing task fields', () => {
    const json = JSON.stringify({
      decisions: [],
      tasks: [{ id: 'T1' }],
      assumptions: [],
      incomplete_items: [],
    });
    const result = parseClaudeResponse(json);
    const task = result.tasks[0];
    expect(task.title).toBe('Untitled task');
    expect(task.status).toBe('review');
    expect(task.confidence).toBe('medium');
    expect(task.confidence_reason).toBe('');
    expect(task.why_this_task_exists).toBe('');
    expect(task.proposed_change).toBe('');
    expect(task.high_confidence_files).toEqual([]);
    expect(task.possible_related_files).toEqual([]);
    expect(task.evidence).toBe('');
    expect(task.ambiguities).toEqual([]);
    expect(task.task_assumptions).toEqual([]);
    expect(task.dependencies).toEqual([]);
    expect(task.agent_steps).toEqual([]);
  });

  it('applies defaults when top-level fields are missing', () => {
    const json = JSON.stringify({ tasks: [] });
    const result = parseClaudeResponse(json);
    expect(result.decisions).toEqual([]);
    expect(result.assumptions).toEqual([]);
    expect(result.incomplete_items).toEqual([]);
    expect(result.execution_buckets).toEqual({
      ready_now: [],
      review_before_execution: [],
      needs_clarification: [],
    });
  });

  it('validates confidence enum and rejects invalid values', () => {
    const json = JSON.stringify({
      decisions: [],
      tasks: [{ id: 'T1', title: 'Task', confidence: 'critical' }],
      assumptions: [],
      incomplete_items: [],
    });
    expect(() => parseClaudeResponse(json)).toThrow();
  });

  it('validates status enum and rejects invalid values', () => {
    const json = JSON.stringify({
      decisions: [],
      tasks: [{ id: 'T1', title: 'Task', status: 'blocked' }],
      assumptions: [],
      incomplete_items: [],
    });
    expect(() => parseClaudeResponse(json)).toThrow();
  });

  it('parses file references with path and reason', () => {
    const json = JSON.stringify({
      decisions: [],
      tasks: [{
        id: 'T1',
        title: 'Fix it',
        status: 'ready',
        confidence: 'high',
        confidence_reason: 'Clear reference',
        proposed_change: 'Fix the thing',
        high_confidence_files: [
          { path: 'src/a.ts', reason: 'Speaker named it' },
          { path: 'src/b.ts', reason: 'Only match for described behavior' },
        ],
        possible_related_files: [
          { path: 'src/c.ts', reason: 'Same directory, might be related' },
        ],
        evidence: '',
        ambiguities: [],
        task_assumptions: [],
        dependencies: [],
        agent_steps: [],
      }],
      assumptions: [],
      incomplete_items: [],
    });

    const result = parseClaudeResponse(json);
    expect(result.tasks[0].high_confidence_files).toHaveLength(2);
    expect(result.tasks[0].high_confidence_files[0].reason).toBe('Speaker named it');
    expect(result.tasks[0].possible_related_files).toHaveLength(1);
  });

  it('parses incomplete items as objects', () => {
    const json = JSON.stringify({
      decisions: [],
      tasks: [],
      assumptions: [],
      incomplete_items: [{
        text: 'Speaker started describing a header task',
        evidence: '[01:49] Speaker 1: And then lastly, the header for the AI...',
        why_incomplete: 'The intended change is not specific enough',
      }],
    });

    const result = parseClaudeResponse(json);
    expect(result.incomplete_items).toHaveLength(1);
    expect(result.incomplete_items[0].text).toBe('Speaker started describing a header task');
    expect(result.incomplete_items[0].evidence).toContain('header for the AI');
    expect(result.incomplete_items[0].why_incomplete).toContain('not specific enough');
  });
});

describe('describeRepo', () => {
  function makeRepo(overrides: Partial<RepoMap> = {}): RepoMap {
    return {
      name: 'test-repo',
      rootPath: '/tmp/nonexistent-repo-path',
      fileTree: '',
      files: [],
      readme: null,
      ...overrides,
    };
  }

  it('returns empty string for repo with no signals', () => {
    const repo = makeRepo();
    expect(describeRepo(repo)).toBe('');
  });

  it('detects frontend patterns from file tree', () => {
    const repo = makeRepo({ fileTree: 'src/\n  components/\n    Button.tsx\n  screens/\n    HomeScreen.tsx' });
    expect(describeRepo(repo)).toBe('Frontend application');
  });

  it('detects backend patterns from file tree', () => {
    const repo = makeRepo({ fileTree: 'src/\n  routes/\n    users.ts\n  controllers/\n    auth.ts\n  migrations/' });
    expect(describeRepo(repo)).toBe('Backend API server');
  });

  it('detects fullstack from file tree with both signals', () => {
    const repo = makeRepo({ fileTree: 'src/\n  components/\n  screens/\n  routes/\n  controllers/' });
    expect(describeRepo(repo)).toBe('Fullstack application');
  });

  it('detects Python Django from file tree', () => {
    const repo = makeRepo({ fileTree: 'manage.py\napp/\n  models.py\n  views.py' });
    expect(describeRepo(repo)).toBe('Python Django app');
  });

  it('detects Go service from file tree', () => {
    const repo = makeRepo({ fileTree: 'go.mod\ngo.sum\nmain.go\npkg/' });
    expect(describeRepo(repo)).toBe('Go service');
  });

  it('detects Rust project from file tree', () => {
    const repo = makeRepo({ fileTree: 'Cargo.toml\nsrc/\n  main.rs' });
    expect(describeRepo(repo)).toBe('Rust project');
  });
});
