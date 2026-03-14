const DEEPGRAM_PER_HOUR = 0.26;
const CLAUDE_PER_HOUR = 0.20;
const WEEKS_PER_MONTH = 4.33;

export function initPricingCalc() {
  const slider = document.getElementById('hours-slider');
  const sliderValue = document.getElementById('slider-value');
  const deepgramEl = document.getElementById('cost-deepgram');
  const claudeEl = document.getElementById('cost-claude');
  const totalEl = document.getElementById('cost-total');

  if (!slider) return;

  function update() {
    const hours = parseInt(slider.value, 10);
    const monthly = hours * WEEKS_PER_MONTH;

    const deepgram = monthly * DEEPGRAM_PER_HOUR;
    const claude = monthly * CLAUDE_PER_HOUR;
    const total = deepgram + claude;

    sliderValue.textContent = `${hours} hrs/wk`;
    deepgramEl.textContent = `$${deepgram.toFixed(2)}`;
    claudeEl.textContent = `$${claude.toFixed(2)}`;
    totalEl.textContent = `$${total.toFixed(2)}`;
  }

  slider.addEventListener('input', update);
  update();
}
