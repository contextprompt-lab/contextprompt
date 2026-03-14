// How It Works — orchestrator
// Manages the 3-step flow: Record → Extract → Execute

import { startMeeting, cleanup as cleanupMeeting } from './phase-meeting.js';
import { startExtraction } from './phase-extraction.js';
import { initExecution, cleanup as cleanupExecution } from './phase-execution.js';
import { highlightInto } from './syntax-highlight.js';
import { codebase } from '../data/demo-data.js';

function setStep(n) {
  const root = document.getElementById('hiw');
  root.dataset.step = n;

  document.querySelectorAll('.step-tab').forEach((tab) => {
    const s = parseInt(tab.dataset.step);
    tab.classList.toggle('active', s === n);
    tab.classList.toggle('done', s < n);
  });
}

async function run() {
  setStep(1);
  await new Promise((resolve) => startMeeting(resolve));
  await sleep(500);

  setStep(2);
  await new Promise((resolve) => startExtraction(resolve));
  // Step 3 is triggered by "Execute tasks →" button
}

function goToStep3() {
  setStep(3);
  initExecution();
}

function restart() {
  cleanupMeeting();
  cleanupExecution();
  run();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('replay-btn')?.addEventListener('click', restart);
  document.getElementById('to-step-3')?.addEventListener('click', goToStep3);

  // Init code panel
  const codeEl = document.getElementById('code-panel-body');
  if (codeEl) {
    const files = Object.keys(codebase);
    highlightInto(codeEl, codebase[files[0]]);

    document.querySelectorAll('.code-tab').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.code-tab').forEach((t) => t.classList.remove('active'));
        tab.classList.add('active');
        highlightInto(codeEl, codebase[tab.dataset.file]);
      });
    });
  }

  run();
});
