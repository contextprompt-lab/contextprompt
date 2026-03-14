export function initCopyCommand() {
  document.addEventListener('click', async (e) => {
    const trigger = e.target.closest('.copy-trigger');
    if (!trigger) return;

    const text = trigger.dataset.copy;
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      showTooltip(trigger, 'Copied!');
    } catch {
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showTooltip(trigger, 'Copied!');
    }
  });

  // Showcase toggle
  const toggleBtns = document.querySelectorAll('.toggle-btn');
  const rendered = document.getElementById('showcase-rendered');
  const raw = document.getElementById('showcase-raw');

  if (toggleBtns.length && rendered && raw) {
    for (const btn of toggleBtns) {
      btn.addEventListener('click', () => {
        const view = btn.dataset.view;

        for (const b of toggleBtns) b.classList.remove('active');
        btn.classList.add('active');

        if (view === 'rendered') {
          rendered.classList.add('active');
          raw.classList.remove('active');
        } else {
          raw.classList.add('active');
          rendered.classList.remove('active');
        }
      });
    }
  }
}

function showTooltip(el, text) {
  // Remove existing tooltip
  const existing = el.querySelector('.copy-tooltip');
  if (existing) existing.remove();

  const tooltip = document.createElement('span');
  tooltip.className = 'copy-tooltip';
  tooltip.textContent = text;
  el.style.position = el.style.position || 'relative';
  el.appendChild(tooltip);

  setTimeout(() => tooltip.remove(), 1200);
}
