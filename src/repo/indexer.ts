import ts from 'typescript';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, join, relative, normalize } from 'node:path';
import type { ExportInfo } from './types.js';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs']);

export function isSourceFile(filePath: string): boolean {
  return SOURCE_EXTENSIONS.has(filePath.slice(filePath.lastIndexOf('.')));
}

export function extractExports(filePath: string): ExportInfo[] {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }

  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true
  );

  const exports: ExportInfo[] = [];

  ts.forEachChild(sourceFile, (node) => {
    // Handle `export default` declarations
    if (ts.isExportAssignment(node) && !node.isExportEquals) {
      const expr = node.expression;
      const name = ts.isIdentifier(expr) ? expr.text : 'default';
      exports.push({ name, kind: 'const' });
      return;
    }

    // Handle `export default function/class`
    if (ts.isExportDeclaration(node)) return;

    if (!hasExportModifier(node)) return;

    if (ts.isFunctionDeclaration(node)) {
      exports.push({
        name: node.name?.text || 'default',
        kind: 'function',
        signature: getFunctionSignature(node),
      });
    } else if (ts.isClassDeclaration(node)) {
      exports.push({
        name: node.name?.text || 'default',
        kind: 'class',
      });
    } else if (ts.isInterfaceDeclaration(node)) {
      exports.push({
        name: node.name.text,
        kind: 'interface',
        signature: getInterfaceSignature(node),
      });
    } else if (ts.isTypeAliasDeclaration(node)) {
      exports.push({
        name: node.name.text,
        kind: 'type',
      });
    } else if (ts.isEnumDeclaration(node)) {
      exports.push({
        name: node.name.text,
        kind: 'enum',
      });
    } else if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (ts.isIdentifier(decl.name)) {
          exports.push({
            name: decl.name.text,
            kind: 'const',
          });
        }
      }
    }
  });

  return exports;
}

function hasExportModifier(node: ts.Node): boolean {
  if (!ts.canHaveModifiers(node)) return false;
  const modifiers = ts.getModifiers(node);
  return modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

function getInterfaceSignature(node: ts.InterfaceDeclaration): string | undefined {
  const members = node.members;
  if (members.length === 0 || members.length > 10) return undefined;
  const props = members
    .filter(ts.isPropertySignature)
    .map((m) => {
      const name = m.name?.getText() || '';
      const optional = m.questionToken ? '?' : '';
      const type = m.type ? `: ${m.type.getText()}` : '';
      return `${name}${optional}${type}`;
    });
  if (props.length === 0) return undefined;
  return `{ ${props.join('; ')} }`;
}

function getFunctionSignature(node: ts.FunctionDeclaration): string {
  const params = node.parameters.map((p) => {
    const name = p.name.getText();
    const type = p.type ? `: ${p.type.getText()}` : '';
    const optional = p.questionToken ? '?' : '';
    return `${name}${optional}${type}`;
  });
  const returnType = node.type ? `: ${node.type.getText()}` : '';
  return `(${params.join(', ')})${returnType}`;
}

// --- Import graph extraction ---

const RESOLVE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.mjs'];

/**
 * Resolve a relative import specifier to a repo-relative file path.
 * Tries common extensions and /index.* patterns. Returns null if unresolvable.
 */
function resolveImportPath(specifier: string, importerDir: string, repoRoot: string): string | null {
  if (!specifier.startsWith('.')) return null; // skip bare/package imports

  const base = join(importerDir, specifier);

  // Try exact match first (already has extension)
  if (existsSync(base) && !statSync(base).isDirectory()) {
    return normalize(relative(repoRoot, base));
  }

  // Try each extension
  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = base + ext;
    if (existsSync(candidate)) {
      return normalize(relative(repoRoot, candidate));
    }
  }

  // Try /index.*
  for (const ext of RESOLVE_EXTENSIONS) {
    const candidate = join(base, `index${ext}`);
    if (existsSync(candidate)) {
      return normalize(relative(repoRoot, candidate));
    }
  }

  return null;
}

/**
 * Extract relative import paths from a source file on disk.
 * Returns repo-relative resolved paths of imported files.
 */
export function extractImports(filePath: string, repoRoot: string): string[] {
  let content: string;
  try {
    content = readFileSync(filePath, 'utf-8');
  } catch {
    return [];
  }

  const specifiers = extractImportSpecifiers(content, filePath);
  const importerDir = dirname(filePath);
  const resolved: string[] = [];

  for (const spec of specifiers) {
    const resolved_path = resolveImportPath(spec, importerDir, repoRoot);
    if (resolved_path) {
      resolved.push(resolved_path);
    }
  }

  return resolved;
}

/**
 * Extract import paths from source content (for browser repos without disk access).
 * Returns raw relative specifiers (unresolved) since we can't check the filesystem.
 */
export function extractImportsFromContent(content: string, filePath: string): string[] {
  return extractImportSpecifiers(content, filePath).filter(s => s.startsWith('.'));
}

/**
 * Parse import/require specifiers from source code using the TypeScript AST.
 */
function extractImportSpecifiers(content: string, filePath: string): string[] {
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true);
  const specifiers: string[] = [];

  ts.forEachChild(sourceFile, (node) => {
    // import ... from '...'
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    }
    // export ... from '...' (re-exports)
    if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      specifiers.push(node.moduleSpecifier.text);
    }
    // const x = require('...')
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (decl.initializer && ts.isCallExpression(decl.initializer)) {
          const expr = decl.initializer.expression;
          if (ts.isIdentifier(expr) && expr.text === 'require' && decl.initializer.arguments.length === 1) {
            const arg = decl.initializer.arguments[0];
            if (ts.isStringLiteral(arg)) {
              specifiers.push(arg.text);
            }
          }
        }
      }
    }
  });

  return specifiers;
}
