import { initTerminalDemo } from './terminal-demo.js';
import { initScrollReveal } from './scroll-reveal.js';
import { initPricingCalc } from './pricing-calc.js';
import { initCopyCommand } from './copy-command.js';

// Initialize all modules when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initScrollReveal();
  initPricingCalc();
  initCopyCommand();
  initTerminalDemo();
});
