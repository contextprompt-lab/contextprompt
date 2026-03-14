// Reusable typewriter engine for animated text output
// Inspired by website/src/js/terminal-demo.js

const CHAR_DELAY = 18;
const CHAR_VARIANCE = 12;

export class Typewriter {
  constructor(targetEl, opts = {}) {
    this.el = targetEl;
    this.charDelay = opts.charDelay ?? CHAR_DELAY;
    this.variance = opts.variance ?? CHAR_VARIANCE;
    this.aborted = false;
  }

  abort() {
    this.aborted = true;
  }

  sleep(ms) {
    return new Promise((resolve) => {
      const id = setTimeout(() => {
        clearInterval(check);
        resolve();
      }, ms);
      const check = setInterval(() => {
        if (this.aborted) {
          clearTimeout(id);
          clearInterval(check);
          resolve();
        }
      }, 50);
    });
  }

  /** Type text char-by-char into a new span inside target */
  async type(text, { className = '', html = false } = {}) {
    if (this.aborted) return;

    const span = document.createElement('span');
    if (className) span.className = className;
    this.el.appendChild(span);

    if (html) {
      // For HTML content, just set it all at once with a short delay
      span.innerHTML = text;
      await this.sleep(50);
    } else {
      for (let i = 0; i < text.length; i++) {
        if (this.aborted) {
          span.textContent = text;
          break;
        }
        span.textContent += text[i];
        this.el.scrollTop = this.el.scrollHeight;
        const delay = this.charDelay + (Math.random() - 0.5) * this.variance;
        await this.sleep(Math.max(5, delay));
      }
    }

    this.el.scrollTop = this.el.scrollHeight;
    return span;
  }

  /** Append a full line instantly */
  appendLine(text, { className = '' } = {}) {
    const div = document.createElement('div');
    if (className) div.className = className;
    div.textContent = text;
    this.el.appendChild(div);
    this.el.scrollTop = this.el.scrollHeight;
    return div;
  }

  /** Append raw HTML instantly */
  appendHTML(html, { className = '' } = {}) {
    const div = document.createElement('div');
    if (className) div.className = className;
    div.innerHTML = html;
    this.el.appendChild(div);
    this.el.scrollTop = this.el.scrollHeight;
    return div;
  }

  async pause(ms) {
    await this.sleep(ms);
  }

  clear() {
    this.el.innerHTML = '';
  }
}
