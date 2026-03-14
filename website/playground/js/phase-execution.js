// Step 3: Execution — task buttons, Claude Code terminal, diffs, preview updates

import { Typewriter } from './typewriter.js';
import { renderFileDiffs } from './diff-renderer.js';
import { highlightInto } from './syntax-highlight.js';
import { plan, taskDiffs, agentTerminal, codeAfterTask } from '../data/demo-data.js';

let currentTask = null;
let currentTypewriter = null;

export function initExecution() {
  renderTaskButtons();

  // Auto-select first task
  const first = document.querySelector('.exec-task-btn');
  if (first) first.click();
}

function renderTaskButtons() {
  const container = document.getElementById('exec-tasks');
  container.innerHTML = plan.tasks.map((t) => `
    <button class="exec-task-btn" data-task="${t.id}">
      <span class="exec-task-id">${t.id}</span>
      ${t.title}
    </button>
  `).join('');

  container.querySelectorAll('.exec-task-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.exec-task-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      selectTask(btn.dataset.task);
    });
  });
}

async function selectTask(taskId) {
  if (currentTypewriter) currentTypewriter.abort();

  currentTask = taskId;
  const terminalEl = document.getElementById('exec-terminal-body');
  const diffEl = document.getElementById('exec-diff');

  terminalEl.innerHTML = '';
  diffEl.innerHTML = '';

  // Prompt line
  const header = document.createElement('div');
  header.className = 'exec-terminal-header-line';
  header.innerHTML = `<span class="exec-prompt">claude</span> Implement task ${taskId} from meetcode-2026-03-12.md`;
  terminalEl.appendChild(header);

  const sep = document.createElement('div');
  sep.className = 'exec-terminal-sep';
  terminalEl.appendChild(sep);

  // Agent lines
  const tw = new Typewriter(terminalEl, { charDelay: 12, variance: 8 });
  currentTypewriter = tw;

  const lines = agentTerminal[taskId] || [];
  for (const line of lines) {
    if (tw.aborted || currentTask !== taskId) break;

    const lineEl = document.createElement('div');
    lineEl.className = `exec-agent-line exec-agent-${line.type}`;
    terminalEl.appendChild(lineEl);

    const innerTw = new Typewriter(lineEl, { charDelay: 12, variance: 8 });
    if (tw.aborted) innerTw.abort();
    const origAbort = tw.abort.bind(tw);
    tw.abort = () => { origAbort(); innerTw.abort(); };

    await innerTw.type(line.text);
    await tw.pause(350);
  }

  // Diffs
  if (currentTask === taskId) {
    const diffs = taskDiffs[taskId] || [];
    await renderFileDiffs(diffEl, diffs, { animate: !tw.aborted, delay: 50 });

    // Update the app preview on the right
    applyPreviewState(taskId);

    // Update the code panel to show the "after" state
    updateCodePanel(taskId);
  }
}

function applyPreviewState(taskId) {
  const preview = document.getElementById('preview-app');
  const taskOrder = ['T1', 'T2', 'T3'];
  const idx = taskOrder.indexOf(taskId);

  preview.classList.remove('show-dates', 'show-delete', 'show-priority');
  const classes = ['show-dates', 'show-delete', 'show-priority'];
  for (let i = 0; i <= idx; i++) {
    preview.classList.add(classes[i]);
  }
}

function updateCodePanel(taskId) {
  const afterState = codeAfterTask[taskId];
  if (!afterState) return;

  const codeEl = document.getElementById('code-panel-body');
  if (!codeEl) return;

  // Find the currently active tab
  const activeTab = document.querySelector('.code-tab.active');
  const activeFile = activeTab?.dataset.file;

  // Update the displayed file if it has a new version
  if (activeFile && afterState[activeFile]) {
    highlightInto(codeEl, afterState[activeFile]);
    // Brief flash to signal the code changed
    codeEl.classList.add('code-updated');
    setTimeout(() => codeEl.classList.remove('code-updated'), 600);
  }

  // Re-bind tabs to show the "after" versions
  document.querySelectorAll('.code-tab').forEach((tab) => {
    const handler = () => {
      document.querySelectorAll('.code-tab').forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      const file = tab.dataset.file;
      // Show after-state if available, otherwise original
      const source = afterState[file] || codeAfterTask[taskId]?.[file];
      if (source) highlightInto(codeEl, source);
    };
    // Replace old handler by cloning
    const newTab = tab.cloneNode(true);
    newTab.addEventListener('click', handler);
    tab.parentNode.replaceChild(newTab, tab);
  });
}

export function cleanup() {
  if (currentTypewriter) currentTypewriter.abort();
  currentTask = null;

  // Reset preview
  const preview = document.getElementById('preview-app');
  if (preview) preview.classList.remove('show-dates', 'show-delete', 'show-priority');
}
