import { scenes } from '../data/demo-scenes.js';

const CHAR_DELAY = 18;        // ms per character when typing
const CHAR_VARIANCE = 12;     // random variance in typing speed
const LINE_PAUSE = 400;       // pause between transcript lines
const OUTPUT_DELAY = 300;     // delay before output block appears
const SCENE_PAUSE = 3000;     // pause between scenes
const FADE_DURATION = 600;    // fade out/in duration

let inputEl;
let outputEl;
let currentScene = 0;
let isVisible = true;
let animating = false;
let aborted = false;

export function initTerminalDemo() {
  inputEl = document.getElementById('demo-input');
  outputEl = document.getElementById('demo-output');

  if (!inputEl || !outputEl) return;

  // Observe visibility
  const observer = new IntersectionObserver(
    ([entry]) => {
      isVisible = entry.isIntersecting;
    },
    { threshold: 0.1 }
  );
  observer.observe(document.getElementById('terminal-demo'));

  // Start animation after a brief delay
  setTimeout(() => startDemo(), 800);
}

function sleep(ms) {
  return new Promise((resolve) => {
    const id = setTimeout(() => {
      clearInterval(check);
      resolve();
    }, ms);
    const check = setInterval(() => {
      if (aborted) {
        clearTimeout(id);
        clearInterval(check);
        resolve();
      }
    }, 100);
  });
}

async function waitForVisible() {
  while (!isVisible && !aborted) {
    await sleep(200);
  }
}

async function startDemo() {
  if (animating) return;
  animating = true;

  while (true) {
    const scene = scenes[currentScene];
    await playScene(scene);
    currentScene = (currentScene + 1) % scenes.length;
    await sleep(SCENE_PAUSE);
  }
}

async function playScene(scene) {
  // Fade out current content
  inputEl.style.transition = `opacity ${FADE_DURATION}ms ease`;
  outputEl.style.transition = `opacity ${FADE_DURATION}ms ease`;
  inputEl.style.opacity = '0';
  outputEl.style.opacity = '0';
  await sleep(FADE_DURATION);

  // Clear
  inputEl.textContent = '';
  outputEl.innerHTML = '';

  // Prepare output blocks (hidden)
  const outputBlocks = scene.output.map((block) => {
    const span = document.createElement('span');
    span.className = 'output-block hidden';
    span.innerHTML = block.html;
    outputEl.appendChild(span);
    return { el: span, afterInput: block.afterInput };
  });

  // Fade in
  inputEl.style.opacity = '1';
  outputEl.style.opacity = '1';
  await sleep(200);

  // Type each input line
  for (let i = 0; i < scene.input.length; i++) {
    await waitForVisible();
    const line = scene.input[i];

    // Create line element
    const lineEl = document.createElement('span');
    lineEl.className = 'terminal-line';
    inputEl.appendChild(lineEl);

    // Add cursor
    const cursor = document.createElement('span');
    cursor.className = 'typing-cursor';
    lineEl.appendChild(cursor);

    // Apply speaker coloring by wrapping the initial part
    const text = line.text;
    const speakerClass = `speaker-${line.speaker}`;

    // Type character by character
    let charIndex = 0;
    const rawText = text;

    // Find speaker name for coloring
    const speakerMatch = rawText.match(/^(\[\d{2}:\d{2}\]) (\w+:)/);
    const tsEnd = speakerMatch ? speakerMatch[1].length : 0;
    const speakerEnd = speakerMatch
      ? speakerMatch[1].length + 1 + speakerMatch[2].length
      : 0;

    let htmlContent = '';

    while (charIndex < rawText.length) {
      await waitForVisible();

      const char = rawText[charIndex];
      // Build the colored HTML string
      if (charIndex < tsEnd) {
        // We're in the timestamp
        if (charIndex === 0) htmlContent += '<span class="ts">';
        htmlContent += escapeHtml(char);
        if (charIndex === tsEnd - 1) htmlContent += '</span>';
      } else if (charIndex < speakerEnd) {
        // We're in the speaker name
        if (charIndex === tsEnd + 1)
          htmlContent += `<span class="speaker ${speakerClass}">`;
        htmlContent += escapeHtml(char);
        if (charIndex === speakerEnd - 1) htmlContent += '</span>';
      } else {
        htmlContent += escapeHtml(char);
      }

      lineEl.innerHTML = htmlContent;
      lineEl.appendChild(cursor);

      charIndex++;

      // Scroll input to bottom
      inputEl.scrollTop = inputEl.scrollHeight;

      const delay = CHAR_DELAY + (Math.random() - 0.5) * CHAR_VARIANCE;
      await sleep(Math.max(5, delay));
    }

    // Remove cursor
    cursor.remove();

    // Show corresponding output blocks
    await sleep(OUTPUT_DELAY);
    for (const block of outputBlocks) {
      if (block.afterInput === i) {
        block.el.classList.remove('hidden');
        outputEl.scrollTop = outputEl.scrollHeight;
        await sleep(150);
      }
    }

    if (i < scene.input.length - 1) {
      await sleep(LINE_PAUSE);
    }
  }
}

function escapeHtml(char) {
  switch (char) {
    case '&':
      return '&amp;';
    case '<':
      return '&lt;';
    case '>':
      return '&gt;';
    default:
      return char;
  }
}
