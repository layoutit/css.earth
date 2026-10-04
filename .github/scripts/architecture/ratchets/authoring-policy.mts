/** Authoring may use scientific libraries, but placed-map averaging stays behind its measurement policy. */
import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ceilingFindings } from './source-ratchets.mts';
import { isTestPath } from '../zones.mts';

const AVERAGING_ROOTS = ['packages/telescope-cli/src/', 'packages/telescope-cli/authoring/', 'packages/bake/authoring/'];
// This author compares trial placements diagnostically; its shipped map uses combineUnderPolicy.
const DIAGNOSTIC_AUTHOR = 'packages/telescope-cli/authoring/hst/slit-scan-map.mts';

export function bodyMapAveragingFindings(path: string, text: string): string[] {
  if (!AVERAGING_ROOTS.some(root => path.startsWith(root)) || isTestPath(path) || path === DIAGNOSTIC_AUTHOR) return [];
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const names = new Set(['combineBodyMaps']);
  const refers = (node: ts.Expression): boolean => {
    if (ts.isIdentifier(node)) return names.has(node.text);
    if (ts.isPropertyAccessExpression(node)) return names.has(node.name.text)
      || ['call', 'apply'].includes(node.name.text) && refers(node.expression);
    if (ts.isElementAccessExpression(node)) return !!node.argumentExpression && ts.isStringLiteral(node.argumentExpression)
      && (names.has(node.argumentExpression.text) || ['call', 'apply'].includes(node.argumentExpression.text) && refers(node.expression));
    return ts.isParenthesizedExpression(node) && refers(node.expression);
  };
  // Follow aliases to a fixed point, including destructured namespace members.
  let changed = true;
  while (changed) {
    changed = false;
    const add = (name: string): void => { if (!names.has(name)) { names.add(name); changed = true; } };
    const aliases = (node: ts.Node): void => {
      if (ts.isImportSpecifier(node) && (node.propertyName ?? node.name).text === 'combineBodyMaps') add(node.name.text);
      if (ts.isVariableDeclaration(node) && node.initializer) {
        if (ts.isIdentifier(node.name) && refers(node.initializer)) add(node.name.text);
        if (ts.isObjectBindingPattern(node.name)) for (const item of node.name.elements) {
          const key = item.propertyName ?? item.name;
          if ((ts.isIdentifier(key) || ts.isStringLiteral(key)) && names.has(key.text) && ts.isIdentifier(item.name)) add(item.name.text);
        }
      }
      ts.forEachChild(node, aliases);
    };
    aliases(source);
  }
  const findings: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && refers(node.expression))
      findings.push(`${path}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: placed maps must average through combineUnderPolicy`);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return findings;
}

/** Export names are the committed CLI debt budget; additions belong in src/. */
export function cliImplementationExports(path: string, text: string): string[] {
  const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const locals = new Map<string, ts.Expression>();
  for (const node of source.statements) if (ts.isVariableStatement(node)) for (const item of node.declarationList.declarations)
    if (ts.isIdentifier(item.name) && item.initializer) locals.set(item.name.text, item.initializer);
  const implementation = (node: ts.Expression, seen = new Set<string>()): boolean => {
    if (ts.isArrowFunction(node) || ts.isFunctionExpression(node) || ts.isClassExpression(node)) return true;
    if (ts.isIdentifier(node)) {
      if (seen.has(node.text)) return false;
      seen.add(node.text);
      const value = locals.get(node.text);
      // Identifier exports may forward local or imported helpers; both are implementations.
      return value ? implementation(value, seen) : true;
    }
    if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) return implementation(node.expression, seen);
    if (ts.isObjectLiteralExpression(node)) return node.properties.some(item => ts.isMethodDeclaration(item)
      || ts.isGetAccessorDeclaration(item) || ts.isSetAccessorDeclaration(item)
      || ts.isPropertyAssignment(item) && implementation(item.initializer, new Set(seen))
      || ts.isShorthandPropertyAssignment(item) && implementation(item.name, new Set(seen))
      || ts.isSpreadAssignment(item) && implementation(item.expression, new Set(seen)));
    return false;
  };
  return source.statements.flatMap(node => {
    if (ts.isExportDeclaration(node) && !node.isTypeOnly) {
      return node.exportClause && ts.isNamedExports(node.exportClause)
        ? node.exportClause.elements.filter(item => !item.isTypeOnly).map(item => item.name.text) : ['*'];
    }
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    if (!modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) return [];
    if (modifiers.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword)) return ['default'];
    return ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) ? [node.name?.text ?? '']
      : ts.isVariableStatement(node) ? node.declarationList.declarations.filter(item => item.initializer && implementation(item.initializer))
        .map(item => item.name.getText(source)) : [];
  }).filter(name => name !== 'main' && name !== 'default');
}

export function cliLibraryFindings(path: string, text: string, baseline: Readonly<Record<string, readonly string[]>>): string[] {
  if (!/^packages\/[^/]+\/cli\/.+\.[cm]?[jt]s$/u.test(path) || isTestPath(path)) return [];
  return cliImplementationExports(path, text).filter(name => !baseline[path]?.includes(name))
    .map(name => `${path}: exported implementation ${name} belongs in src/, not a CLI entry`);
}

export function checkAuthoringPolicies(root: string, files: readonly string[]): string[] {
  // No refs or git history are needed in a depth-one CI checkout. The committed ceiling makes budget increases explicit.
  const value: unknown = JSON.parse(readFileSync(resolve(root, '.github/scripts/architecture/ratchets/cli-exports-baseline.json'), 'utf8'));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Invalid CLI export baseline');
  const entries: unknown = Reflect.get(value, 'entries');
  if (!entries || typeof entries !== 'object' || Array.isArray(entries)) throw new TypeError('Invalid CLI baseline entries');
  const baseline: Record<string, string[]> = {};
  for (const [path, entry] of Object.entries(entries)) {
    if (!entry || typeof entry !== 'object' || typeof entry.reason !== 'string' || !entry.reason.trim()
      || !Array.isArray(entry.exports) || !entry.exports.every((name: unknown) => typeof name === 'string')) throw new TypeError(`Invalid CLI exports: ${path}`);
    baseline[path] = entry.exports;
  }
  const findings = ceilingFindings(Reflect.get(value, 'ceiling'), Object.values(baseline).reduce((count, names) => count + names.length, 0), 'CLI exports');
  return [...findings, ...files.filter(path => /\.[cm]?[jt]s$/u.test(path) && (AVERAGING_ROOTS.some(prefix => path.startsWith(prefix)) || /^packages\/[^/]+\/cli\//u.test(path)))
    .flatMap(path => { const text = readFileSync(resolve(root, path), 'utf8'); return [...bodyMapAveragingFindings(path, text), ...cliLibraryFindings(path, text, baseline)]; })];
}
