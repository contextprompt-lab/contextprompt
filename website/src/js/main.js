import { initScrollReveal } from './scroll-reveal.js';
import { initCopyCommand } from './copy-command.js';
import { initSplitDemo } from './split-demo.js';

function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

// Initialize all modules when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  initScrollReveal();
  initCopyCommand();
  initSmoothScroll();
  initSplitDemo();
});
