import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { scanRepo } from '../scanner.js';

describe('scanRepo', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'meetcode-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('scans a basic repo structure', async () => {
    writeFileSync(join(tempDir, 'index.ts'), 'export const foo = 1;');
    writeFileSync(join(tempDir, 'utils.ts'), 'export function bar() {}');

    const result = await scanRepo(tempDir);
    expect(result.files.length).toBeGreaterThanOrEqual(2);
    expect(result.fileTree).toContain('index.ts');
    expect(result.fileTree).toContain('utils.ts');
  });

  it('respects .gitignore', async () => {
    writeFileSync(join(tempDir, '.gitignore'), 'ignored.ts\n');
    writeFileSync(join(tempDir, 'kept.ts'), 'export const a = 1;');
    writeFileSync(join(tempDir, 'ignored.ts'), 'export const b = 2;');

    const result = await scanRepo(tempDir);
    expect(result.fileTree).toContain('kept.ts');
    expect(result.fileTree).not.toContain('ignored.ts');
  });

  it('skips node_modules', async () => {
    mkdirSync(join(tempDir, 'node_modules', 'pkg'), { recursive: true });
    writeFileSync(join(tempDir, 'node_modules', 'pkg', 'index.js'), 'module.exports = {}');
    writeFileSync(join(tempDir, 'app.ts'), 'export const x = 1;');

    const result = await scanRepo(tempDir);
    expect(result.fileTree).not.toContain('node_modules');
    expect(result.fileTree).toContain('app.ts');
  });

  it('skips .git directory', async () => {
    mkdirSync(join(tempDir, '.git', 'objects'), { recursive: true });
    writeFileSync(join(tempDir, '.git', 'config'), '[core]');
    writeFileSync(join(tempDir, 'main.ts'), 'export const y = 1;');

    const result = await scanRepo(tempDir);
    expect(result.fileTree).not.toContain('.git');
  });

  it('skips dist directory', async () => {
    mkdirSync(join(tempDir, 'dist'), { recursive: true });
    writeFileSync(join(tempDir, 'dist', 'bundle.js'), 'var x = 1;');
    writeFileSync(join(tempDir, 'src.ts'), 'export const z = 1;');

    const result = await scanRepo(tempDir);
    expect(result.fileTree).not.toContain('dist');
  });

  it('extracts exports from source files', async () => {
    writeFileSync(join(tempDir, 'lib.ts'), 'export function greet(name: string): string { return name; }');

    const result = await scanRepo(tempDir);
    const libFile = result.files.find(f => f.path === 'lib.ts');
    expect(libFile).toBeDefined();
    expect(libFile!.exports).toHaveLength(1);
    expect(libFile!.exports[0].name).toBe('greet');
    expect(libFile!.exports[0].kind).toBe('function');
  });

  it('reads README.md', async () => {
    writeFileSync(join(tempDir, 'README.md'), '# My Project\n\nDescription here.');
    writeFileSync(join(tempDir, 'index.ts'), 'export const a = 1;');

    const result = await scanRepo(tempDir);
    expect(result.readme).toContain('# My Project');
  });

  it('returns null readme when no README exists', async () => {
    writeFileSync(join(tempDir, 'index.ts'), 'export const a = 1;');

    const result = await scanRepo(tempDir);
    expect(result.readme).toBeNull();
  });

  it('sets repo name from directory basename', async () => {
    writeFileSync(join(tempDir, 'index.ts'), 'export const a = 1;');

    const result = await scanRepo(tempDir);
    expect(result.name).toBeTruthy();
    expect(result.rootPath).toBe(tempDir);
  });
});
