import type { ExtractedPlan, Task, FileReference, IncompleteItem } from '../tasks/types.js';
import type { Transcript } from '../transcription/transcript.js';

function escapeTableCell(text: string): string {
  return text.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function renderMarkdown(
  plan: ExtractedPlan,
  transcript: Transcript | null,
  durationMinutes: number
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const durationStr = durationMinutes >= 60
    ? `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`
    : `${durationMinutes}m`;

  const speakerCount = transcript ? transcript.getSpeakerMap().length : 0;
  const speakerStr = speakerCount > 0 ? ` · ${speakerCount} speaker(s)` : '';

  let md = `# Execution Plan — ${dateStr} ${timeStr}\n\n`;
  md += `> ${plan.tasks.length} task(s) from ${durationStr} meeting${speakerStr}\n\n`;

  // Decisions
  if (plan.decisions.length > 0) {
    md += `## Decisions Made\n\n`;
    for (let i = 0; i < plan.decisions.length; i++) {
      md += `${i + 1}. ${plan.decisions[i]}\n`;
    }
    md += '\n';
  }

  // Execution buckets
  const { execution_buckets } = plan;
  const hasReadyNow = execution_buckets.ready_now.length > 0;
  const hasReview = execution_buckets.review_before_execution.length > 0;
  const hasClarify = execution_buckets.needs_clarification.length > 0;

  if (hasReadyNow || hasReview || hasClarify) {
    md += `## Execution Status\n\n`;
    if (hasReadyNow) {
      md += `**Ready now:** ${execution_buckets.ready_now.join(', ')}\n`;
    }
    if (hasReview) {
      md += `**Review before execution:** ${execution_buckets.review_before_execution.join(', ')}\n`;
    }
    if (hasClarify) {
      md += `**Needs clarification:** ${execution_buckets.needs_clarification.join(', ')}\n`;
    }
    md += '\n';
  }

  // Execution order
  if (plan.tasks.length > 1) {
    md += `## Execution Order\n\n`;
    const hasDeps = plan.tasks.some(t => t.dependencies.length > 0);
    if (hasDeps) {
      const order = plan.tasks.map(t => {
        const deps = t.dependencies.length > 0 ? ` (after ${t.dependencies.join(', ')})` : '';
        return `${t.id}${deps}`;
      });
      md += order.join(' → ') + '\n\n';
    } else {
      md += plan.tasks.map(t => t.id).join(', ') + ' (independent — can be executed in parallel)\n\n';
    }
  }

  md += `---\n\n`;

  // Tasks
  if (plan.tasks.length === 0) {
    md += `*No coding tasks were identified in this meeting.*\n\n`;
  } else {
    // Quick reference table
    md += `| ID | Task | Status | Confidence | Files | Depends on |\n`;
    md += `|----|------|--------|------------|-------|------------|\n`;
    for (const task of plan.tasks) {
      const fileCount = task.high_confidence_files.length + task.possible_related_files.length;
      const files = fileCount > 0 ? fileCount + ' file(s)' : '—';
      const deps = task.dependencies.length > 0 ? task.dependencies.join(', ') : '—';
      md += `| ${escapeTableCell(task.id)} | ${escapeTableCell(task.title)} | ${escapeTableCell(task.status)} | ${escapeTableCell(task.confidence)} | ${escapeTableCell(files)} | ${escapeTableCell(deps)} |\n`;
    }
    md += '\n---\n\n';

    for (const task of plan.tasks) {
      md += renderTask(task);
    }
  }

  // Incomplete items
  if (plan.incomplete_items.length > 0) {
    md += `## Incomplete Items\n\n`;
    for (const item of plan.incomplete_items) {
      md += `- **${item.text}**\n`;
      if (item.evidence) {
        md += `  > ${item.evidence}\n`;
      }
      if (item.why_incomplete) {
        md += `  _${item.why_incomplete}_\n`;
      }
      md += '\n';
    }
  }

  // Assumptions
  if (plan.assumptions.length > 0) {
    md += `## Assumptions\n\n`;
    for (let i = 0; i < plan.assumptions.length; i++) {
      md += `${i + 1}. ${plan.assumptions[i]}\n`;
    }
    md += '\n';
  }

  // Agent execution blocks — self-contained, copy-paste ready
  const executableTasks = plan.tasks.filter(t => t.status !== 'clarify');
  if (executableTasks.length > 0) {
    md += `## Agent Execution Blocks\n\n`;
    md += `> Copy-paste any block below directly into Claude Code.\n\n`;
    for (const task of executableTasks) {
      md += renderAgentBlock(task);
    }
  }

  // Raw transcript
  if (transcript) {
    const wordCount = transcript.getWordCount();
    md += `## Transcript\n\n`;
    md += `<details>\n`;
    md += `<summary>Full meeting transcript (${wordCount} words, ${durationStr})</summary>\n\n`;
    md += '```\n';
    md += transcript.toFormattedText();
    md += '\n```\n\n';
    md += `</details>\n`;
  }

  return md;
}

function renderTask(task: Task): string {
  let md = `### ${task.id}: ${task.title}\n\n`;

  // Status + confidence line
  md += `**Status:** ${task.status}`;
  md += ` · **Confidence:** ${task.confidence}`;
  if (task.confidence_reason) {
    md += ` — ${task.confidence_reason}`;
  }
  if (task.dependencies.length > 0) {
    md += ` · **Depends on:** ${task.dependencies.join(', ')}`;
  }
  md += '\n\n';

  if (task.why_this_task_exists) {
    md += `**Why:** ${task.why_this_task_exists}\n\n`;
  }

  if (task.proposed_change) {
    md += `**Proposed change:** ${task.proposed_change}\n\n`;
  }

  if (task.evidence) {
    md += `**Evidence:**\n> ${task.evidence}\n\n`;
  }

  if (task.high_confidence_files.length > 0) {
    md += `**High-confidence files:**\n`;
    for (const file of task.high_confidence_files) {
      md += `- \`${file.path}\``;
      if (file.reason) md += ` — ${file.reason}`;
      md += '\n';
    }
    md += '\n';
  }

  if (task.possible_related_files.length > 0) {
    md += `**Possible related files** (inferred, not directly referenced):\n`;
    for (const file of task.possible_related_files) {
      md += `- \`${file.path}\``;
      if (file.reason) md += ` — ${file.reason}`;
      md += '\n';
    }
    md += '\n';
  }

  if (task.agent_steps.length > 0) {
    md += `**Steps:**\n\n`;
    for (let i = 0; i < task.agent_steps.length; i++) {
      md += `${i + 1}. ${task.agent_steps[i]}\n`;
    }
    md += '\n';
  }

  if (task.ambiguities.length > 0) {
    md += `**Ambiguities:**\n`;
    for (const amb of task.ambiguities) {
      md += `- ${amb}\n`;
    }
    md += '\n';
  }

  if (task.task_assumptions.length > 0) {
    md += `**Task assumptions:**\n`;
    for (const a of task.task_assumptions) {
      md += `- ${a}\n`;
    }
    md += '\n';
  }

  md += `---\n\n`;
  return md;
}

function renderAgentBlock(task: Task): string {
  const statusLabel = task.status === 'ready'
    ? 'ready — paste and run'
    : 'review first — check ambiguities before running';

  let md = `<details>\n`;
  md += `<summary>${task.id}: ${task.title} (${statusLabel})</summary>\n\n`;
  md += '```\n';

  // Self-contained prompt
  md += `Goal: ${task.proposed_change || task.title}\n\n`;

  // Files
  const allFiles = [
    ...task.high_confidence_files.map(f => ({ ...f, confidence: 'primary' })),
    ...task.possible_related_files.map(f => ({ ...f, confidence: 'check' })),
  ];
  if (allFiles.length > 0) {
    md += `Files:\n`;
    for (const f of allFiles) {
      md += `- ${f.path} (${f.confidence}) — ${f.reason}\n`;
    }
    md += '\n';
  }

  // Steps
  if (task.agent_steps.length > 0) {
    md += `Steps:\n`;
    for (let i = 0; i < task.agent_steps.length; i++) {
      md += `${i + 1}. ${task.agent_steps[i]}\n`;
    }
    md += '\n';
  }

  // Warnings
  if (task.ambiguities.length > 0) {
    md += `Watch out for:\n`;
    for (const amb of task.ambiguities) {
      md += `- ${amb}\n`;
    }
    md += '\n';
  }

  if (task.task_assumptions.length > 0) {
    md += `Assumptions made:\n`;
    for (const a of task.task_assumptions) {
      md += `- ${a}\n`;
    }
  }

  md += '```\n';
  md += `</details>\n\n`;
  return md;
}

export function renderIssueComment(
  plan: ExtractedPlan,
  issueTitle: string,
  issueNumber: number
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let md = `# Execution Plan — Issue #${issueNumber}\n\n`;
  md += `> ${plan.tasks.length} task(s) extracted from **${issueTitle}** · ${dateStr}\n\n`;

  // Decisions
  if (plan.decisions.length > 0) {
    md += `## Decisions\n\n`;
    for (let i = 0; i < plan.decisions.length; i++) {
      md += `${i + 1}. ${plan.decisions[i]}\n`;
    }
    md += '\n';
  }

  // Execution buckets
  const { execution_buckets } = plan;
  const hasReadyNow = execution_buckets.ready_now.length > 0;
  const hasReview = execution_buckets.review_before_execution.length > 0;
  const hasClarify = execution_buckets.needs_clarification.length > 0;

  if (hasReadyNow || hasReview || hasClarify) {
    md += `## Execution Status\n\n`;
    if (hasReadyNow) {
      md += `**Ready now:** ${execution_buckets.ready_now.join(', ')}\n`;
    }
    if (hasReview) {
      md += `**Review before execution:** ${execution_buckets.review_before_execution.join(', ')}\n`;
    }
    if (hasClarify) {
      md += `**Needs clarification:** ${execution_buckets.needs_clarification.join(', ')}\n`;
    }
    md += '\n';
  }

  // Execution order
  if (plan.tasks.length > 1) {
    md += `## Execution Order\n\n`;
    const hasDeps = plan.tasks.some(t => t.dependencies.length > 0);
    if (hasDeps) {
      const order = plan.tasks.map(t => {
        const deps = t.dependencies.length > 0 ? ` (after ${t.dependencies.join(', ')})` : '';
        return `${t.id}${deps}`;
      });
      md += order.join(' → ') + '\n\n';
    } else {
      md += plan.tasks.map(t => t.id).join(', ') + ' (independent — can be executed in parallel)\n\n';
    }
  }

  md += `---\n\n`;

  // Tasks
  if (plan.tasks.length === 0) {
    md += `*No coding tasks were identified in this issue.*\n\n`;
  } else {
    md += `| ID | Task | Status | Confidence | Files | Depends on |\n`;
    md += `|----|------|--------|------------|-------|------------|\n`;
    for (const task of plan.tasks) {
      const fileCount = task.high_confidence_files.length + task.possible_related_files.length;
      const files = fileCount > 0 ? fileCount + ' file(s)' : '—';
      const deps = task.dependencies.length > 0 ? task.dependencies.join(', ') : '—';
      md += `| ${escapeTableCell(task.id)} | ${escapeTableCell(task.title)} | ${escapeTableCell(task.status)} | ${escapeTableCell(task.confidence)} | ${escapeTableCell(files)} | ${escapeTableCell(deps)} |\n`;
    }
    md += '\n---\n\n';

    for (const task of plan.tasks) {
      md += renderTask(task);
    }
  }

  // Incomplete items
  if (plan.incomplete_items.length > 0) {
    md += `## Incomplete Items\n\n`;
    for (const item of plan.incomplete_items) {
      md += `- **${item.text}**\n`;
      if (item.evidence) {
        md += `  > ${item.evidence}\n`;
      }
      if (item.why_incomplete) {
        md += `  _${item.why_incomplete}_\n`;
      }
      md += '\n';
    }
  }

  // Assumptions
  if (plan.assumptions.length > 0) {
    md += `## Assumptions\n\n`;
    for (let i = 0; i < plan.assumptions.length; i++) {
      md += `${i + 1}. ${plan.assumptions[i]}\n`;
    }
    md += '\n';
  }

  // Agent execution blocks
  const executableTasks = plan.tasks.filter(t => t.status !== 'clarify');
  if (executableTasks.length > 0) {
    md += `## Agent Execution Blocks\n\n`;
    md += `> Copy-paste any block below directly into Claude Code.\n\n`;
    for (const task of executableTasks) {
      md += renderAgentBlock(task);
    }
  }

  md += `\n---\n\n> Generated by meetcode\n`;

  return md;
}

export function generateOutputFilename(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
  return `meetcode-${date}-${time}.md`;
}
