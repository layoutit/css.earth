/** Authoring may use scientific libraries, but placed-map averaging stays behind its measurement policy. */
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isTestPath } from './zones.mts';

const AVERAGING_ROOTS = ['packages/telescope-cli/src/', 'packages/telescope-cli/authoring/', 'packages/bake/authoring/'];
// This author compares trial placements diagnostically; its shipped map uses combineUnderPolicy.
const DIAGNOSTIC_AUTHOR = 'packages/telescope-cli/authoring/hst/slit-scan-map.mts';

export function bodyMapAveragingFindings(path: string, text: string): string[] {
  if (!AVERAGING_ROOTS.some(root => path.startsWith(root)) || isTestPath(path) || path === DIAGNOSTIC_AUTHOR) return [];
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const names = new Set(['combineBodyMaps']);
  const visitImports = (node: ts.Node): void => {
    if (ts.isImportSpecifier(node) && (node.propertyName ?? node.name).text === 'combineBodyMaps') names.add(node.name.text);
    ts.forEachChild(node, visitImports);
  };
  visitImports(source);
  const findings: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && (ts.isIdentifier(node.expression) && names.has(node.expression.text)
      || ts.isPropertyAccessExpression(node.expression) && names.has(node.expression.name.text)))
      findings.push(`${path}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: placed maps must average through combineUnderPolicy`);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings;
}

/** The intentionally simple CLI ratchet rejects exported implementations, not local command orchestration. */
export function cliLibraryFindings(path: string, text: string, existing: ReadonlySet<string>): string[] {
  if (!/^packages\/[^/]+\/cli\/.+\.[cm]?[jt]s$/u.test(path) || existing.has(path) || isTestPath(path)) return [];
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  return source.statements.flatMap(node => {
    if (ts.isExportDeclaration(node) && !node.isTypeOnly) {
      const names = node.exportClause && ts.isNamedExports(node.exportClause) ? node.exportClause.elements.filter(item => !item.isTypeOnly).map(item => item.name.text) : ['*'];
      return names.filter(name => name !== 'main' && name !== 'default').map(name => `${path}: exported implementation ${name} belongs in src/, not a new CLI entry`);
    }
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    if (!modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
      || modifiers.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword)) return [];
    const names = ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) ? [node.name?.text ?? '']
      : ts.isVariableStatement(node) ? node.declarationList.declarations.filter(item => item.initializer &&
        (ts.isArrowFunction(item.initializer) || ts.isFunctionExpression(item.initializer))).map(item => item.name.getText(source)) : [];
    return names.filter(name => name !== 'main').map(name => `${path}: exported implementation ${name} belongs in src/, not a new CLI entry`);
  });
}

export function checkAuthoringPolicies(root: string, files: readonly string[]): string[] {
  // Compare paths rather than changed lines: existing CLI debt may be touched, but newly added entries cannot add it.
  const existing = new Set(execFileSync('git', ['ls-tree', '-r', '--name-only', 'origin/main', '--', 'packages/'], { cwd: root, encoding: 'utf8' }).split('\n'));
  return files.filter(path => /\.[cm]?[jt]s$/u.test(path) && (AVERAGING_ROOTS.some(prefix => path.startsWith(prefix)) || /^packages\/[^/]+\/cli\//u.test(path)))
    .flatMap(path => { const text = readFileSync(resolve(root, path), 'utf8'); return [...bodyMapAveragingFindings(path, text), ...cliLibraryFindings(path, text, existing)]; });
}
