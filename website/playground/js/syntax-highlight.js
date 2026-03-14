// Minimal regex-based syntax highlighting for JSX/TS code snippets

const RULES = [
  // Comments (single-line)
  { pattern: /(\/\/.*$)/gm, cls: 'syn-comment' },
  // Strings (single, double, backtick)
  { pattern: /('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`)/g, cls: 'syn-string' },
  // JSX tags
  { pattern: /(&lt;\/?[A-Za-z][A-Za-z0-9.]*)/g, cls: 'syn-tag' },
  // Keywords
  { pattern: /\b(import|export|from|const|let|var|function|return|async|await|default|if|else|new|typeof|class|extends)\b/g, cls: 'syn-keyword' },
  // Types / React hooks
  { pattern: /\b(useState|useEffect|Router|any|string|number|boolean|void)\b/g, cls: 'syn-type' },
  // Numbers
  { pattern: /\b(\d+)\b/g, cls: 'syn-number' },
  // Booleans / null
  { pattern: /\b(true|false|null|undefined)\b/g, cls: 'syn-bool' },
];

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Returns HTML string with syntax-highlighted spans.
 * Input should be raw code (not HTML-escaped).
 */
export function highlight(code) {
  let html = escapeHtml(code);

  // Apply rules in order — later rules won't overwrite earlier spans
  // because we use a placeholder approach
  const placeholders = [];

  for (const rule of RULES) {
    html = html.replace(rule.pattern, (match) => {
      const idx = placeholders.length;
      placeholders.push(`<span class="${rule.cls}">${match}</span>`);
      return `\x00${idx}\x00`;
    });
  }

  // Restore placeholders
  for (let i = 0; i < placeholders.length; i++) {
    html = html.replace(`\x00${i}\x00`, placeholders[i]);
  }

  return html;
}

/**
 * Highlight code and set it as innerHTML of target element.
 */
export function highlightInto(el, code) {
  el.innerHTML = highlight(code);
}
