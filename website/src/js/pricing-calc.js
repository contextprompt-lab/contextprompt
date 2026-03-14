const CLAUDE_PER_HOUR = 0.20;
const WEEKS_PER_MONTH = 4.33;

export function initPricingCalc() {
  const slider = document.getElementById('hours-slider');
  const sliderValue = document.getElementById('slider-value');
  const claudeEl = document.getElementById('cost-claude');
  const totalEl = document.getElementById('cost-total');

  if (!slider) return;

  function update() {
    const hours = parseInt(slider.value, 10);
    const monthly = hours * WEEKS_PER_MONTH;

    const claude = monthly * CLAUDE_PER_HOUR;

    sliderValue.textContent = `${hours} hrs/wk`;
    claudeEl.textContent = `$${claude.toFixed(2)}`;
    totalEl.textContent = `$${claude.toFixed(2)}`;
  }

  slider.addEventListener('input', update);
  update();
}
