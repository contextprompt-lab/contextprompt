import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, basename, extname } from 'node:path';
import ignore from 'ignore';
import type { RepoMap, FileEntry, SourceFile } from './types.js';
import { extractExports, extractImports, isSourceFile } from './indexer.js';
import { logger } from '../utils/logger.js';

const ALWAYS_SKIP = new Set([
  'node_modules', 'dist', 'build', '.git', '.next', '.nuxt',
  'coverage', '.cache', '.turbo', 'vendor', '__pycache__',
  '.venv', 'venv', 'target',
]);

const SKIP_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp',
  '.woff', '.woff2', '.ttf', '.eot',
  '.lock', '.map',
  '.min.js', '.min.css',
  '.mp3', '.mp4', '.wav', '.avi',
  '.zip', '.tar', '.gz',
  '.pdf', '.doc', '.docx',
]);

const TOKEN_BUDGET = 30000;
const CHARS_PER_TOKEN = 4;

export async function scanRepo(repoPath: string): Promise<RepoMap> {
  const name = basename(repoPath);
  logger.info(`Scanning repo: ${name}`);

  // Load .gitignore
  const ig = ignore();
  const gitignorePath = join(repoPath, '.gitignore');
  if (existsSync(gitignorePath)) {
    const gitignoreContent = readFileSync(gitignorePath, 'utf-8');
    ig.add(gitignoreContent);
  }

  // Walk the file tree
  const allPaths: string[] = [];
  walkDir(repoPath, repoPath, ig, allPaths);

  // Build file tree string
  const fileTree = buildFileTree(allPaths, repoPath);

  // Extract exports and imports from source files
  const files: FileEntry[] = [];
  for (const filePath of allPaths) {
    const relPath = relative(repoPath, filePath);
    if (isSourceFile(filePath) && !isTestFile(relPath)) {
      const exports = extractExports(filePath);
      const imports = extractImports(filePath, repoPath);
      files.push({
        path: relPath,
        exports,
        ...(imports.length > 0 ? { imports } : {}),
      });
    }
  }

  // Read README
  let readme: string | null = null;
  const readmePath = join(repoPath, 'README.md');
  if (existsSync(readmePath)) {
    const content = readFileSync(readmePath, 'utf-8');
    const lines = content.split('\n').slice(0, 100);
    readme = lines.join('\n');
  }

  const repoMap: RepoMap = { name, rootPath: repoPath, fileTree, files, readme };

  // Check token budget and trim if needed
  const estimated = estimateTokens(repoMap);
  if (estimated > TOKEN_BUDGET) {
    trimRepoMap(repoMap, estimated);
  }

  logger.info(`Scanned ${allPaths.length} files, ${files.length} with exports (~${estimateTokens(repoMap)} tokens)`);
  return repoMap;
}

function walkDir(
  dir: string,
  root: string,
  ig: ReturnType<typeof ignore>,
  results: string[]
): void {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    logger.debug(`Skipping directory ${dir}: ${(err as NodeJS.ErrnoException).code || (err as Error).message}`);
    return;
  }

  for (const entry of entries) {
    if (ALWAYS_SKIP.has(entry.name)) continue;
    if (entry.name.startsWith('.')) continue;

    const fullPath = join(dir, entry.name);
    const relPath = relative(root, fullPath);

    if (ig.ignores(relPath)) continue;

    if (entry.isDirectory()) {
      walkDir(fullPath, root, ig, results);
    } else if (entry.isFile()) {
      const ext = extname(entry.name);
      if (SKIP_EXTENSIONS.has(ext)) continue;
      results.push(fullPath);
    }
  }
}

function buildFileTree(paths: string[], root: string): string {
  const relPaths = paths.map((p) => relative(root, p)).sort();

  // If tree is too large, only show top 3 levels
  const displayPaths = relPaths.length > 500
    ? relPaths.filter((p) => p.split('/').length <= 3)
    : relPaths;

  // Build a proper tree with directory nodes
  const tree = new Map<string, Set<string>>();
  for (const p of displayPaths) {
    const parts = p.split('/');
    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts.slice(0, i + 1).join('/');
      if (!tree.has(dir)) tree.set(dir, new Set());
    }
  }

  const lines: string[] = [];
  const seen = new Set<string>();

  for (const p of displayPaths) {
    const parts = p.split('/');
    // Emit directory lines for any new parent dirs
    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts.slice(0, i + 1).join('/');
      if (!seen.has(dir)) {
        seen.add(dir);
        lines.push('  '.repeat(i) + parts[i] + '/');
      }
    }
    // Emit file
    lines.push('  '.repeat(parts.length - 1) + parts[parts.length - 1]);
  }

  if (relPaths.length > 500) {
    lines.push(`... (${relPaths.length} files total)`);
  }

  return lines.join('\n');
}

function isTestFile(relPath: string): boolean {
  return (
    relPath.includes('.test.') ||
    relPath.includes('.spec.') ||
    relPath.includes('__tests__') ||
    relPath.includes('__mocks__')
  );
}

function estimateTokens(repoMap: RepoMap): number {
  let chars = repoMap.fileTree.length;
  chars += (repoMap.readme?.length || 0);
  for (const file of repoMap.files) {
    chars += file.path.length + 10;
    for (const exp of file.exports) {
      chars += exp.name.length + exp.kind.length + (exp.signature?.length || 0) + 10;
    }
    if (file.imports) {
      for (const imp of file.imports) {
        chars += imp.length + 5;
      }
    }
  }
  return Math.ceil(chars / CHARS_PER_TOKEN);
}

function trimRepoMap(repoMap: RepoMap, currentTokens: number): void {
  // Step 1: Drop signatures from deep files only (keep top-2-level signatures)
  if (currentTokens > TOKEN_BUDGET) {
    for (const file of repoMap.files) {
      if (file.path.split('/').length > 3) {
        for (const exp of file.exports) {
          delete exp.signature;
        }
      }
    }
    currentTokens = estimateTokens(repoMap);
  }

  // Step 2: Drop ALL remaining signatures if still over budget
  if (currentTokens > TOKEN_BUDGET) {
    for (const file of repoMap.files) {
      for (const exp of file.exports) {
        delete exp.signature;
      }
    }
    currentTokens = estimateTokens(repoMap);
  }

  // Step 3: Drop imports from deep files
  if (currentTokens > TOKEN_BUDGET) {
    for (const file of repoMap.files) {
      if (file.path.split('/').length > 4) {
        delete file.imports;
      }
    }
    currentTokens = estimateTokens(repoMap);
  }

  // Step 4: Drop files from deep directories entirely
  if (currentTokens > TOKEN_BUDGET) {
    repoMap.files = repoMap.files.filter(
      (f) => f.path.split('/').length <= 4
    );
  }

  logger.debug(`Trimmed repo map to ~${estimateTokens(repoMap)} tokens`);
}
