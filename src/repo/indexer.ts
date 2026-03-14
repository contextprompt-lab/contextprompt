import ts from 'typescript';
import { readFileSync } from 'node:fs';
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
