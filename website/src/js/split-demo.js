// Split-screen comparison demo — animated timeline
// Each tick = 1 minute of real time

const TOTAL_DURATION = 120; // 2 hours in demo-minutes
const RIGHT_DONE_AT = 32;   // 32 minutes (30m meeting + 2m extraction)
const TICK_INTERVAL = 400;   // ms per demo-minute (~48s real for full loop)
const LOOP_PAUSE = 4000;     // ms pause before restart

// --- Phase definitions (in minutes) ---

const LEFT_PHASES = [
  { id: 'meeting',    label: 'In meeting — 30 min',              start: 0,   end: 30,  render: renderLeftMeeting },
  { id: 'notes',      label: 'Reviewing notes — 20 min',         start: 30,  end: 50,  render: renderLeftNotes },
  { id: 'organize',   label: 'Organizing & triaging — 15 min',   start: 50,  end: 65,  render: renderLeftOrganize },
  { id: 'tickets',    label: 'Creating tickets — 20 min',        start: 65,  end: 85,  render: renderLeftTickets },
  { id: 'files',      label: 'Searching codebase — 15 min',      start: 85,  end: 100, render: renderLeftFileSearch },
  { id: 'prompts',    label: 'Writing prompts — 20 min',         start: 100, end: 120, render: renderLeftPrompts },
];

const RIGHT_PHASES = [
  { id: 'meeting',    label: 'In meeting — 30 min',              start: 0,   end: 30,  render: renderRightMeeting },
  { id: 'notes',      label: 'Extracting tasks...',              start: 30,  end: 32,  render: renderRightNotes },
  { id: 'done',       label: '',                                 start: 32,  end: 120, render: renderRightDone },
];

// --- State ---

let currentTick = 0;
let timerEl, leftBody, rightBody, leftStatus, rightStatus, progressBar;
let leftPanel, rightPanel;
let leftCurrentPhase = null;
let rightCurrentPhase = null;
let isVisible = false;
let tickTimeout = null;
let scanInterval = null;

// --- SVG Icons ---

const ICONS = {
  clock: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  file: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  folder: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
  check: '<svg class="demo-done-check" viewBox="0 0 48 48" fill="none" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="20"/><polyline points="14 24 22 32 34 18"/></svg>',
};

// --- Timer formatting ---

function formatTime(demoMinutes) {
  const h = Math.floor(demoMinutes / 60);
  const m = demoMinutes % 60;
  if (h === 0) return `${m}m`;
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

// --- Phase transition ---

function transitionPhase(containerEl, phase, statusEl, side) {
  const current = containerEl.querySelector('.demo-phase');
  if (current) {
    current.classList.add('demo-phase--exiting');
    setTimeout(() => current.remove(), 250);
  }

  const phaseEl = document.createElement('div');
  phaseEl.className = 'demo-phase demo-phase--entering';
  phase.render(phaseEl);
  containerEl.appendChild(phaseEl);

  // Update status bar
  if (phase.id === 'done') {
    statusEl.className = 'demo-panel-status demo-panel-status--done';
    statusEl.innerHTML = '&#10003; Complete';
  } else {
    statusEl.className = 'demo-panel-status';
    statusEl.innerHTML = `&#9654; ${phase.label}`;
  }

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      phaseEl.classList.remove('demo-phase--entering');
    });
  });
}

// --- Tick loop ---

function tick() {
  if (!isVisible) return;

  // Update timer
  timerEl.textContent = formatTime(currentTick);

  // Update progress
  const pct = (currentTick / TOTAL_DURATION) * 100;
  progressBar.style.width = `${pct}%`;

  // Check left phases
  const leftPhase = LEFT_PHASES.find(p => currentTick >= p.start && currentTick < p.end);
  if (leftPhase && leftPhase.id !== leftCurrentPhase) {
    transitionPhase(leftBody, leftPhase, leftStatus, 'left');
    leftCurrentPhase = leftPhase.id;
  }

  // Check right phases
  const rightPhase = RIGHT_PHASES.find(p => currentTick >= p.start && currentTick < p.end);
  if (rightPhase && rightPhase.id !== rightCurrentPhase) {
    transitionPhase(rightBody, rightPhase, rightStatus, 'right');
    rightCurrentPhase = rightPhase.id;

    // Add done glow to right panel
    if (rightPhase.id === 'done') {
      rightPanel.classList.add('demo-panel--done');
    }
  }

  currentTick++;

  if (currentTick > TOTAL_DURATION) {
    tickTimeout = setTimeout(resetAndLoop, LOOP_PAUSE);
    return;
  }

  tickTimeout = setTimeout(tick, TICK_INTERVAL);
}

// --- Reset and loop ---

function resetAndLoop() {
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = null;
  }
  currentTick = 0;
  leftCurrentPhase = null;
  rightCurrentPhase = null;
  leftBody.innerHTML = '';
  rightBody.innerHTML = '';
  leftStatus.className = 'demo-panel-status';
  leftStatus.innerHTML = '';
  rightStatus.className = 'demo-panel-status';
  rightStatus.innerHTML = '';
  timerEl.textContent = '0m';
  progressBar.style.width = '0%';
  rightPanel.classList.remove('demo-panel--done');
  tick();
}

// --- Render functions: LEFT ---

function renderLeftMeeting(el) {
  el.innerHTML = `
    <div class="demo-meeting">
      <div class="demo-avatars">
        <div class="demo-avatar demo-avatar--1">AL</div>
        <div class="demo-avatar demo-avatar--2">BO</div>
        <div class="demo-avatar demo-avatar--3">JL</div>
      </div>
      <div class="demo-bubbles">
        <div class="demo-bubble demo-bubble--1" style="animation-delay: 0.1s">The auth middleware needs to move to JWT...</div>
        <div class="demo-bubble demo-bubble--2" style="animation-delay: 0.3s">Which files are we talking about?</div>
        <div class="demo-bubble demo-bubble--3" style="animation-delay: 0.5s">Also add a refresh endpoint</div>
      </div>
      <div class="demo-recording-pill demo-recording-pill--off">
        <span class="demo-recording-dot demo-recording-dot--off"></span>
        No recording
      </div>
    </div>
  `;
}

function renderLeftNotes(el) {
  el.innerHTML = `
    <div class="demo-notepad">
      <div class="demo-notepad-title">Meeting Notes</div>
      <div class="demo-note-line" style="animation-delay: 0.1s">- auth thing... JWT maybe?</div>
      <div class="demo-note-line demo-note-line--confused" style="animation-delay: 0.3s">- Bob said something about sessions</div>
      <div class="demo-note-line" style="animation-delay: 0.5s">- which files??? auth.ts?</div>
      <div class="demo-note-line demo-note-line--confused" style="animation-delay: 0.7s">- refresh endpoint (where?)</div>
      <div class="demo-note-line demo-note-line--confused" style="animation-delay: 0.9s">- TODO: figure out file paths...</div>
    </div>
  `;
}

function renderLeftOrganize(el) {
  el.innerHTML = `
    <div>
      <div class="demo-organize-label">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20"/></svg>
        Reorganizing...
      </div>
      <div class="demo-organize-item demo-organize-item--struck">- Bob said something about sessions</div>
      <div class="demo-organize-item demo-organize-item--moving" style="transition-delay: 0.2s">- JWT migration for auth middleware</div>
      <div class="demo-organize-item" style="transition-delay: 0.3s">- refresh endpoint needed</div>
      <div class="demo-organize-item demo-organize-item--moving" style="transition-delay: 0.4s">- figure out which files to change</div>
      <div class="demo-organize-item demo-organize-item--struck" style="transition-delay: 0.5s">- auth thing... JWT maybe?</div>
    </div>
  `;

  // Animate items after a moment
  setTimeout(() => {
    const items = el.querySelectorAll('.demo-organize-item:not(.demo-organize-item--struck):not(.demo-organize-item--moving)');
    items.forEach(item => item.classList.add('demo-organize-item--moving'));
  }, 400);
}

function renderLeftTickets(el) {
  el.innerHTML = `
    <div class="demo-tickets">
      <div class="demo-ticket" style="animation-delay: 0.1s">
        <div class="demo-ticket-title">AUTH-142: Migrate to JWT</div>
        <div class="demo-ticket-desc" style="animation-delay: 0.3s">Replace session-based auth with JWT tokens...</div>
      </div>
      <div class="demo-ticket" style="animation-delay: 0.4s">
        <div class="demo-ticket-title">AUTH-143: Add refresh endpoint</div>
        <div class="demo-ticket-desc" style="animation-delay: 0.6s">Create POST /auth/refresh for token renewal...</div>
      </div>
      <div class="demo-ticket" style="animation-delay: 0.7s">
        <div class="demo-ticket-title">AUTH-144: Update session types</div>
        <div class="demo-ticket-desc" style="animation-delay: 0.9s">Remove old session interfaces, add JWT types...</div>
      </div>
    </div>
  `;
}

function renderLeftFileSearch(el) {
  const files = [
    { icon: 'folder', name: 'src/', indent: 0 },
    { icon: 'folder', name: 'middleware/', indent: 1 },
    { icon: 'file', name: 'auth.ts', indent: 2 },
    { icon: 'file', name: 'cors.ts', indent: 2 },
    { icon: 'folder', name: 'routes/', indent: 1 },
    { icon: 'file', name: 'auth.ts', indent: 2 },
    { icon: 'file', name: 'users.ts', indent: 2 },
    { icon: 'folder', name: 'types/', indent: 1 },
    { icon: 'file', name: 'session.ts', indent: 2 },
    { icon: 'file', name: 'auth.ts', indent: 2 },
  ];

  el.innerHTML = `
    <div class="demo-file-search">
      <div class="demo-search-query"><span class="prompt">$</span> grep -r "session" src/</div>
      <div class="demo-file-list">
        ${files.map((f, i) => `
          <div class="demo-file-item" data-scan-index="${i}" style="padding-left: ${8 + f.indent * 14}px">
            <span class="demo-file-icon">${ICONS[f.icon]}</span>
            ${f.name}
          </div>
        `).join('')}
      </div>
      <div class="demo-thought-bubble">"Which files do I actually need to change?"</div>
    </div>
  `;

  // Scanning highlight animation
  let scanIdx = 0;
  const fileItems = el.querySelectorAll('.demo-file-item');
  if (scanInterval) clearInterval(scanInterval);
  scanInterval = setInterval(() => {
    fileItems.forEach(f => f.classList.remove('demo-file-item--scanning'));
    if (scanIdx < fileItems.length) {
      fileItems[scanIdx].classList.add('demo-file-item--scanning');
      scanIdx++;
    } else {
      scanIdx = 0;
    }
  }, 300);
}

function renderLeftPrompts(el) {
  el.innerHTML = `
    <div class="demo-prompt-editor">
      <div class="demo-prompt-line demo-prompt-line--struck" style="animation-delay: 0s">claude "migrate auth to JWT in src/auth.ts"</div>
      <div class="demo-prompt-line demo-prompt-line--struck" style="animation-delay: 0.3s">claude "change the session middleware to use...</div>
      <div class="demo-prompt-line" style="animation-delay: 0.6s">claude "In src/middleware/auth.ts, replace the</div>
      <div class="demo-prompt-line" style="animation-delay: 0.8s">  express-session based auth with JWT. Also</div>
      <div class="demo-prompt-line" style="animation-delay: 1.0s">  update src/types/session.ts and add a</div>
      <div class="demo-prompt-line" style="animation-delay: 1.2s">  refresh endpoint in src/routes/auth.ts..."</div>
      <span class="demo-prompt-cursor"></span>
    </div>
  `;
}

// --- Render functions: RIGHT ---

function renderRightMeeting(el) {
  el.innerHTML = `
    <div class="demo-meeting">
      <div class="demo-avatars">
        <div class="demo-avatar demo-avatar--1">AL</div>
        <div class="demo-avatar demo-avatar--2">BO</div>
        <div class="demo-avatar demo-avatar--3">JL</div>
      </div>
      <div class="demo-bubbles">
        <div class="demo-bubble demo-bubble--1" style="animation-delay: 0.1s">The auth middleware needs to move to JWT...</div>
        <div class="demo-bubble demo-bubble--2" style="animation-delay: 0.3s">Which files are we talking about?</div>
        <div class="demo-bubble demo-bubble--3" style="animation-delay: 0.5s">Also add a refresh endpoint</div>
      </div>
      <div class="demo-recording-pill demo-recording-pill--on">
        <span class="demo-recording-dot demo-recording-dot--on"></span>
        contextprompt recording
      </div>
    </div>
  `;
}

function renderRightNotes(el) {
  el.innerHTML = `
    <div class="demo-notepad">
      <div class="demo-notepad-title">Extracting tasks...</div>
      <div class="demo-note-line demo-note-line--clean" style="animation-delay: 0.1s"><span class="demo-note-check">&#10003;</span> Scanning repos &amp; transcription</div>
      <div class="demo-note-line demo-note-line--clean" style="animation-delay: 0.3s"><span class="demo-note-check">&#10003;</span> Matching to file paths</div>
    </div>
  `;
}

function renderRightDone(el) {
  el.innerHTML = `
    <div class="demo-done">
      ${ICONS.check}
      <div class="demo-done-time">Done in 32 minutes</div>
      <div class="demo-done-summary">
        <div>3 tasks extracted &middot; real file paths &middot; ready for Claude Code</div>
        <div class="demo-done-tasks">
          <span class="demo-done-task">T1: JWT migration</span>
          <span class="demo-done-task">T2: Refresh endpoint</span>
          <span class="demo-done-task">T3: Update types</span>
        </div>
      </div>
      <div class="demo-time-saved">Time saved: ~1.5 hours</div>
    </div>
  `;
}

// --- Init ---

export function initSplitDemo() {
  timerEl = document.getElementById('demo-timer');
  leftBody = document.getElementById('demo-left');
  rightBody = document.getElementById('demo-right');
  leftStatus = document.getElementById('demo-left-status');
  rightStatus = document.getElementById('demo-right-status');
  progressBar = document.getElementById('demo-progress-bar');
  leftPanel = document.querySelector('.demo-panel--left');
  rightPanel = document.querySelector('.demo-panel--right');

  if (!timerEl || !leftBody || !rightBody) return;

  const observer = new IntersectionObserver(
    ([entry]) => {
      const wasVisible = isVisible;
      isVisible = entry.isIntersecting;
      if (isVisible && !wasVisible) {
        resetAndLoop();
      }
      if (!isVisible && wasVisible && tickTimeout) {
        clearTimeout(tickTimeout);
        tickTimeout = null;
      }
    },
    { threshold: 0.2 }
  );
  observer.observe(document.getElementById('split-demo'));
}
