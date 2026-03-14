// Step 2: Extraction animation + plan reveal

import { extractionSteps, plan } from '../data/demo-data.js';

export async function startExtraction(onComplete) {
  const stepsEl = document.getElementById('extraction-steps');
  const planEl = document.getElementById('extraction-plan');

  stepsEl.innerHTML = '';
  planEl.innerHTML = '';
  planEl.classList.remove('visible');

  for (const step of extractionSteps) {
    const line = document.createElement('div');
    line.className = 'extraction-step';

    if (step.success) {
      line.innerHTML = `<span class="extraction-check">✓</span> <span class="extraction-success">${step.text}</span>`;
      if (step.detail) line.innerHTML += ` <span class="extraction-detail">${step.detail}</span>`;
    } else {
      line.innerHTML = `<span class="extraction-spinner"></span> ${step.text}`;
      if (step.detail) line.innerHTML += ` <span class="extraction-detail">${step.detail}</span>`;
    }

    stepsEl.appendChild(line);

    if (step.duration > 0) {
      await sleep(step.duration);
    } else {
      await sleep(100);
    }

    const spinner = line.querySelector('.extraction-spinner');
    if (spinner) spinner.outerHTML = '<span class="extraction-check">✓</span>';
  }

  await sleep(400);
  renderPlan(planEl);
  planEl.classList.add('visible');

  // Don't auto-advance — user clicks "Execute tasks" button
  onComplete();
}

function renderPlan(el) {
  el.innerHTML = `
    <div class="plan-header">
      <h3>Execution Plan</h3>
      <p class="plan-meta">${plan.tasks.length} tasks · 2 speakers · 1m meeting</p>
    </div>

    <div class="plan-decisions">
      <h4>Decisions</h4>
      <ol>${plan.decisions.map((d) => `<li>${d}</li>`).join('')}</ol>
    </div>

    <table class="plan-table">
      <thead><tr><th>ID</th><th>Task</th><th>Confidence</th><th>Files</th></tr></thead>
      <tbody>
        ${plan.tasks.map((t) => `
          <tr>
            <td>${t.id}</td>
            <td>${t.title}</td>
            <td><span class="badge badge--high">${t.confidence}</span></td>
            <td>${t.high_confidence_files.length + t.possible_related_files.length}</td>
          </tr>`).join('')}
      </tbody>
    </table>

    <div class="plan-task-detail">
      <h4>${plan.tasks[0].id}: ${plan.tasks[0].title}</h4>
      <p class="plan-confidence"><span class="badge badge--high">high</span> — ${plan.tasks[0].confidence_reason}</p>
      <div class="plan-evidence">
        <span class="plan-evidence-label">Evidence</span>
        <blockquote>${plan.tasks[0].evidence}</blockquote>
      </div>
      <div class="plan-files">
        <p class="plan-files-label">Files</p>
        <ul>${plan.tasks[0].high_confidence_files.map((f) => `<li><code>${f.path}</code> — ${f.reason}</li>`).join('')}</ul>
      </div>
    </div>
  `;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
