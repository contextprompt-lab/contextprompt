// Step 1: Meeting recording simulation

import { Typewriter } from './typewriter.js';
import { meeting } from '../data/demo-data.js';

let typewriter;
let timerInterval;
let timerSeconds = 0;

export async function startMeeting(onComplete) {
  const transcriptEl = document.getElementById('meeting-transcript');
  const timerEl = document.getElementById('meeting-timer');
  const skipBtn = document.getElementById('meeting-skip');

  transcriptEl.innerHTML = '';
  timerSeconds = 0;
  updateTimer(timerEl);

  typewriter = new Typewriter(transcriptEl, { charDelay: 16, variance: 10 });

  timerInterval = setInterval(() => {
    timerSeconds++;
    updateTimer(timerEl);
  }, 1000);

  const handleSkip = () => {
    typewriter.abort();
    clearInterval(timerInterval);
    skipBtn.removeEventListener('click', handleSkip);
    finishMeeting(transcriptEl, onComplete);
  };
  skipBtn.addEventListener('click', handleSkip);

  for (const line of meeting.transcript) {
    if (typewriter.aborted) break;

    const participant = meeting.participants[line.speaker];
    setActiveSpeaker(line.speaker);

    const lineDiv = document.createElement('div');
    lineDiv.className = 'transcript-line';
    transcriptEl.appendChild(lineDiv);

    const tsSpan = document.createElement('span');
    tsSpan.className = 'transcript-ts';
    tsSpan.textContent = `[${line.time}] `;
    lineDiv.appendChild(tsSpan);

    const speakerSpan = document.createElement('span');
    speakerSpan.className = `transcript-speaker speaker-${line.speaker}`;
    speakerSpan.textContent = `${participant.name}: `;
    lineDiv.appendChild(speakerSpan);

    const textSpan = document.createElement('span');
    textSpan.className = 'transcript-text';
    lineDiv.appendChild(textSpan);

    const tw = new Typewriter(textSpan, { charDelay: 16, variance: 10 });
    tw.aborted = typewriter.aborted;
    const origAbort = typewriter.abort.bind(typewriter);
    typewriter.abort = () => { origAbort(); tw.abort(); };

    await tw.type(line.text);
    transcriptEl.scrollTop = transcriptEl.scrollHeight;
    await typewriter.pause(500);
  }

  if (!typewriter.aborted) {
    clearInterval(timerInterval);
    skipBtn.removeEventListener('click', handleSkip);
    await typewriter.pause(800);
    finishMeeting(transcriptEl, onComplete);
  }
}

function finishMeeting(transcriptEl, onComplete) {
  if (typewriter.aborted) {
    transcriptEl.innerHTML = '';
    for (const line of meeting.transcript) {
      const p = meeting.participants[line.speaker];
      const div = document.createElement('div');
      div.className = 'transcript-line';
      div.innerHTML = `<span class="transcript-ts">[${line.time}] </span><span class="transcript-speaker speaker-${line.speaker}">${p.name}: </span><span class="transcript-text">${line.text}</span>`;
      transcriptEl.appendChild(div);
    }
  }
  clearActiveSpeaker();
  onComplete();
}

function updateTimer(el) {
  const m = String(Math.floor(timerSeconds / 60)).padStart(2, '0');
  const s = String(timerSeconds % 60).padStart(2, '0');
  el.textContent = `${m}:${s}`;
}

function setActiveSpeaker(idx) {
  document.querySelectorAll('.participant').forEach((el) => {
    el.classList.toggle('active', parseInt(el.dataset.idx) === idx);
  });
}

function clearActiveSpeaker() {
  document.querySelectorAll('.participant').forEach((el) => el.classList.remove('active'));
}

export function cleanup() {
  if (typewriter) typewriter.abort();
  clearInterval(timerInterval);
}
