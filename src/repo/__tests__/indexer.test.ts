import { describe, it, expect } from 'vitest';
import { isSourceFile } from '../indexer.js';

describe('isSourceFile', () => {
  it('returns true for TypeScript files', () => {
    expect(isSourceFile('src/foo.ts')).toBe(true);
    expect(isSourceFile('src/bar.tsx')).toBe(true);
    expect(isSourceFile('src/baz.mts')).toBe(true);
  });

  it('returns true for JavaScript files', () => {
    expect(isSourceFile('lib/foo.js')).toBe(true);
    expect(isSourceFile('lib/bar.jsx')).toBe(true);
    expect(isSourceFile('lib/baz.mjs')).toBe(true);
  });

  it('returns false for non-source files', () => {
    expect(isSourceFile('data.json')).toBe(false);
    expect(isSourceFile('README.md')).toBe(false);
    expect(isSourceFile('styles.css')).toBe(false);
    expect(isSourceFile('image.png')).toBe(false);
  });
});

// Note: extractExports tests require actual files on disk.
// For unit testing the AST parsing, we test through the public API
// by creating temporary files in the scanner integration tests.
