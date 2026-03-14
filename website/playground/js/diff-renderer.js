// Renders pre-computed diff hunks as colored HTML lines

import { highlight } from './syntax-highlight.js';

/**
 * Render an array of hunk lines into the target element.
 * Each hunk: { type: 'add'|'remove'|'context', text: string }
 * Animates lines appearing one by one if animate=true.
 */
export async function renderDiff(targetEl, hunks, { animate = true, delay = 80 } = {}) {
  targetEl.innerHTML = '';

  for (const hunk of hunks) {
    const line = document.createElement('div');
    line.className = `diff-line diff-${hunk.type}`;

    const prefix = document.createElement('span');
    prefix.className = 'diff-prefix';
    prefix.textContent = hunk.type === 'add' ? '+' : hunk.type === 'remove' ? '-' : ' ';

    const code = document.createElement('span');
    code.className = 'diff-code';
    code.innerHTML = highlight(hunk.text);

    line.appendChild(prefix);
    line.appendChild(code);

    if (animate) {
      line.style.opacity = '0';
      line.style.transform = 'translateY(4px)';
    }

    targetEl.appendChild(line);

    if (animate) {
      await sleep(delay);
      line.style.transition = 'opacity 0.2s, transform 0.2s';
      line.style.opacity = '1';
      line.style.transform = 'translateY(0)';
    }
  }
}

/**
 * Render multiple file diffs with file headers.
 */
export async function renderFileDiffs(targetEl, fileDiffs, opts = {}) {
  targetEl.innerHTML = '';

  for (let i = 0; i < fileDiffs.length; i++) {
    const diff = fileDiffs[i];

    // File header
    const header = document.createElement('div');
    header.className = 'diff-file-header';
    header.textContent = diff.file;
    targetEl.appendChild(header);

    // Diff lines
    const body = document.createElement('div');
    body.className = 'diff-file-body';
    targetEl.appendChild(body);

    await renderDiff(body, diff.hunks, opts);

    if (i < fileDiffs.length - 1) {
      const spacer = document.createElement('div');
      spacer.className = 'diff-spacer';
      targetEl.appendChild(spacer);
    }
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
