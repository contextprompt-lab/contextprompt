import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderMarkdown, renderIssueComment, generateOutputFilename } from '../markdown.js';
import { Transcript } from '../../transcription/transcript.js';
import type { ExtractedPlan, Task } from '../../tasks/types.js';

function makePlan(overrides: Partial<ExtractedPlan> = {}): ExtractedPlan {
  return {
    decisions: [],
    fix_summary: '',
    execution_buckets: { ready_now: [], review_before_execution: [], needs_clarification: [] },
    tasks: [],
    assumptions: [],
    incomplete_items: [],
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'T1',
    title: 'Test task',
    status: 'ready',
    confidence: 'high',
    confidence_reason: '',
    why_this_task_exists: '',
    proposed_change: '',
    high_confidence_files: [],
    possible_related_files: [],
    evidence: '',
    ambiguities: [],
    task_assumptions: [],
    dependencies: [],
    agent_steps: [],
    ...overrides,
  };
}

function makeTranscript(): Transcript {
  const t = new Transcript();
  t.addUtterance({
    speaker: 'speaker_0',
    text: 'Hello everyone',
    startTime: 0,
    endTime: 2,
  });
  return t;
}

describe('renderMarkdown', () => {
  it('renders basic structure with title and decisions', () => {
    const md = renderMarkdown(makePlan({ decisions: ['Fix the bug'] }), makeTranscript(), 30);
    expect(md).toContain('# Execution Plan');
    expect(md).toContain('## Decisions Made');
    expect(md).toContain('Fix the bug');
    expect(md).toContain('30m');
  });

  it('shows no-tasks message when no tasks', () => {
    const md = renderMarkdown(makePlan({ tasks: [] }), makeTranscript(), 5);
    expect(md).toContain('No coding tasks were identified');
  });

  it('renders tasks table with status and confidence columns', () => {
    const plan = makePlan({
      decisions: ['Do the thing'],
      tasks: [makeTask({
        id: 'T1',
        title: 'Fix the bug',
        status: 'ready',
        confidence: 'high',
        confidence_reason: 'Speaker named the file',
        proposed_change: 'Remove the broken handler',
        high_confidence_files: [{ path: 'src/foo.ts', reason: 'Directly mentioned' }],
        agent_steps: ['Open src/foo.ts', 'Remove the handler'],
      })],
    });
    const md = renderMarkdown(plan, makeTranscript(), 10);
    expect(md).toContain('| T1 |');
    expect(md).toContain('Fix the bug');
    expect(md).toContain('### T1: Fix the bug');
    expect(md).toContain('**Status:** ready');
    expect(md).toContain('**Confidence:** high');
    expect(md).toContain('**High-confidence files:**');
    expect(md).toContain('`src/foo.ts`');
    expect(md).toContain('Directly mentioned');
  });

  it('renders high-confidence and possible files separately', () => {
    const plan = makePlan({
      tasks: [makeTask({
        id: 'T1',
        title: 'Update screen',
        status: 'review',
        confidence: 'medium',
        high_confidence_files: [{ path: 'src/a.ts', reason: 'Named by speaker' }],
        possible_related_files: [{ path: 'src/b.ts', reason: 'Same directory' }],
        ambiguities: ['Which screen?'],
      })],
    });
    const md = renderMarkdown(plan, makeTranscript(), 10);
    expect(md).toContain('**High-confidence files:**');
    expect(md).toContain('Named by speaker');
    expect(md).toContain('**Possible related files**');
    expect(md).toContain('Same directory');
    expect(md).toContain('**Ambiguities:**');
    expect(md).toContain('Which screen?');
  });

  it('escapes pipe characters in table cells', () => {
    const plan = makePlan({
      tasks: [makeTask({
        id: 'T1',
        title: 'Fix | pipe | title',
      })],
    });
    const md = renderMarkdown(plan, makeTranscript(), 10);
    expect(md).toContain('Fix \\| pipe \\| title');
  });

  it('escapes newlines in table cells', () => {
    const plan = makePlan({
      tasks: [makeTask({
        id: 'T1',
        title: 'Line1\nLine2',
      })],
    });
    const md = renderMarkdown(plan, makeTranscript(), 10);
    const tableLines = md.split('\n').filter(l => l.startsWith('| T1'));
    expect(tableLines).toHaveLength(1);
  });

  it('renders collapsible transcript section', () => {
    const md = renderMarkdown(makePlan(), makeTranscript(), 5);
    expect(md).toContain('<details>');
    expect(md).toContain('Full meeting transcript');
    expect(md).toContain('</details>');
  });

  it('formats duration in hours and minutes', () => {
    const md = renderMarkdown(makePlan(), makeTranscript(), 90);
    expect(md).toContain('1h 30m');
  });

  it('renders speaker count in header', () => {
    const t = new Transcript(['Alice']);
    t.addUtterance({ speaker: 'speaker_0', text: 'Hi', startTime: 0, endTime: 1 });
    const md = renderMarkdown(makePlan(), t, 5);
    expect(md).toContain('1 speaker(s)');
  });

  it('renders assumptions section', () => {
    const plan = makePlan({
      assumptions: ['App uses React Native', 'onClose is already wired'],
    });
    const md = renderMarkdown(plan, makeTranscript(), 5);
    expect(md).toContain('## Assumptions');
    expect(md).toContain('App uses React Native');
    expect(md).toContain('onClose is already wired');
  });

  it('renders incomplete items as structured objects', () => {
    const plan = makePlan({
      incomplete_items: [{
        text: 'Speaker started a 4th item but was cut off',
        evidence: '[01:49] Speaker 1: And then lastly...',
        why_incomplete: 'Not specific enough to execute',
      }],
    });
    const md = renderMarkdown(plan, makeTranscript(), 5);
    expect(md).toContain('## Incomplete Items');
    expect(md).toContain('Speaker started a 4th item but was cut off');
    expect(md).toContain('And then lastly');
    expect(md).toContain('Not specific enough to execute');
  });

  it('renders execution status section with buckets', () => {
    const plan = makePlan({
      execution_buckets: {
        ready_now: ['T1', 'T3'],
        review_before_execution: ['T2'],
        needs_clarification: [],
      },
      tasks: [
        makeTask({ id: 'T1', title: 'Ready task', status: 'ready' }),
        makeTask({ id: 'T2', title: 'Review task', status: 'review', confidence: 'medium' }),
        makeTask({ id: 'T3', title: 'Another ready', status: 'ready' }),
      ],
    });
    const md = renderMarkdown(plan, makeTranscript(), 10);
    expect(md).toContain('## Execution Status');
    expect(md).toContain('**Ready now:** T1, T3');
    expect(md).toContain('**Review before execution:** T2');
    expect(md).not.toContain('**Needs clarification:**');
  });

  it('renders self-contained agent execution blocks for ready/review tasks', () => {
    const plan = makePlan({
      tasks: [
        makeTask({
          id: 'T1', title: 'High conf task', status: 'ready', confidence: 'high',
          proposed_change: 'Remove the month nav controls',
          high_confidence_files: [{ path: 'src/Calendar.tsx', reason: 'Only calendar component' }],
          agent_steps: ['Open Calendar.tsx', 'Remove nav controls'],
          ambiguities: ['Global or dashboard-only?'],
        }),
        makeTask({
          id: 'T2', title: 'Needs clarification', status: 'clarify', confidence: 'low',
          proposed_change: 'Unknown change',
          agent_steps: ['Confirm requirements first'],
        }),
      ],
    });
    const md = renderMarkdown(plan, makeTranscript(), 10);
    expect(md).toContain('## Agent Execution Blocks');
    expect(md).toContain('Copy-paste any block below directly into Claude Code');
    expect(md).toContain('T1: High conf task');
    expect(md).toContain('ready — paste and run');
    // Agent block should be self-contained
    expect(md).toContain('Goal: Remove the month nav controls');
    expect(md).toContain('src/Calendar.tsx (primary)');
    expect(md).toContain('1. Open Calendar.tsx');
    expect(md).toContain('Watch out for:');
    expect(md).toContain('Global or dashboard-only?');
    // T2 should NOT have an agent block (clarify status)
    const agentSection = md.split('## Agent Execution Blocks')[1]?.split('## Transcript')[0] ?? '';
    expect(agentSection).not.toContain('T2:');
  });

  it('renders execution order for multiple tasks', () => {
    const plan = makePlan({
      tasks: [
        makeTask({ id: 'T1', title: 'First' }),
        makeTask({ id: 'T2', title: 'Second' }),
      ],
    });
    const md = renderMarkdown(plan, makeTranscript(), 10);
    expect(md).toContain('## Execution Order');
    expect(md).toContain('independent — can be executed in parallel');
  });

  it('renders proposed_change and why_this_task_exists in task detail', () => {
    const plan = makePlan({
      tasks: [makeTask({
        id: 'T1',
        title: 'Fix calendar',
        why_this_task_exists: 'Meeting explicitly requested removing month nav',
        proposed_change: 'Remove month navigation and lock to current month',
      })],
    });
    const md = renderMarkdown(plan, makeTranscript(), 10);
    expect(md).toContain('**Why:** Meeting explicitly requested removing month nav');
    expect(md).toContain('**Proposed change:** Remove month navigation and lock to current month');
  });

  it('renders task_assumptions in task detail', () => {
    const plan = makePlan({
      tasks: [makeTask({
        id: 'T1',
        title: 'Fix thing',
        task_assumptions: ['Dashboard refers to profile screen'],
      })],
    });
    const md = renderMarkdown(plan, makeTranscript(), 10);
    expect(md).toContain('**Task assumptions:**');
    expect(md).toContain('Dashboard refers to profile screen');
  });
});

describe('renderIssueComment', () => {
  it('renders header with issue number and title', () => {
    const md = renderIssueComment(makePlan(), 'Fix login bug', 42);
    expect(md).toContain('# Execution Plan — Issue #42');
    expect(md).toContain('**Fix login bug**');
  });

  it('shows task count', () => {
    const plan = makePlan({ tasks: [makeTask()] });
    const md = renderIssueComment(plan, 'Test', 1);
    expect(md).toContain('1 task(s)');
  });

  it('shows no-tasks message when empty', () => {
    const md = renderIssueComment(makePlan(), 'Empty issue', 5);
    expect(md).toContain('No coding tasks were identified in this issue');
  });

  it('does not include transcript section', () => {
    const md = renderIssueComment(makePlan(), 'Test', 1);
    expect(md).not.toContain('## Transcript');
    expect(md).not.toContain('Full meeting transcript');
  });

  it('does not include speaker count or duration', () => {
    const md = renderIssueComment(makePlan(), 'Test', 1);
    expect(md).not.toContain('speaker(s)');
    expect(md).not.toContain('meeting');
  });

  it('renders decisions', () => {
    const plan = makePlan({ decisions: ['Use JWT auth'] });
    const md = renderIssueComment(plan, 'Auth', 10);
    expect(md).toContain('## Decisions');
    expect(md).toContain('Use JWT auth');
  });

  it('renders task table', () => {
    const plan = makePlan({
      tasks: [makeTask({ id: 'T1', title: 'Fix it', status: 'ready', confidence: 'high' })],
    });
    const md = renderIssueComment(plan, 'Bug', 7);
    expect(md).toContain('| T1 |');
    expect(md).toContain('Fix it');
    expect(md).toContain('### T1: Fix it');
  });

  it('renders agent execution blocks', () => {
    const plan = makePlan({
      tasks: [makeTask({
        id: 'T1', title: 'Do thing', status: 'ready',
        proposed_change: 'Change the code',
        agent_steps: ['Step 1', 'Step 2'],
      })],
    });
    const md = renderIssueComment(plan, 'Feature', 3);
    expect(md).toContain('## Agent Execution Blocks');
    expect(md).toContain('Goal: Change the code');
  });

  it('includes footer', () => {
    const md = renderIssueComment(makePlan(), 'Test', 1);
    expect(md).toContain('> Generated by contextprompt');
  });
});

describe('generateOutputFilename', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('generates filename with date and time including seconds', () => {
    vi.setSystemTime(new Date(2026, 2, 12, 14, 30, 45));
    const name = generateOutputFilename();
    expect(name).toBe('contextprompt-2026-03-12-143045.md');
  });

  it('pads single digit values', () => {
    vi.setSystemTime(new Date(2026, 0, 5, 9, 5, 3));
    const name = generateOutputFilename();
    expect(name).toBe('contextprompt-2026-01-05-090503.md');
  });
});
