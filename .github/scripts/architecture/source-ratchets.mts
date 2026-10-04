/** Committed ceilings for remaining format validation math and working-directory commands. */
import ts from 'typescript';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isTestPath } from './zones.mts';

export type Ratchet = Readonly<Record<string, string>>;
export const RATCHET_PATH = '.github/scripts/architecture/source-ratchets.json';
export function parseRatchet(value: unknown): Ratchet {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Expected ratchet object');
  const result: Record<string, string> = {};
  for (const [path, reason] of Object.entries(value)) {
    if (typeof reason !== 'string' || !reason.trim()) throw new TypeError(`${path}: ratchet requires a reason`);
    result[path] = reason;
  }
  return result;
}
export function ceilingFindings(ceiling: unknown, count: number, label: string): string[] {
  if (!Number.isSafeInteger(ceiling) || typeof ceiling !== 'number' || ceiling < 0) throw new TypeError(`${label}: invalid ceiling`);
  return count > ceiling ? [`${label}: ${count} entries exceed committed ceiling ${ceiling}`] : [];
}
const NUMERIC_MATH = new Set(['sqrt', 'sin', 'cos', 'atan2', 'pow', 'hypot', 'exp', 'log', 'log2', 'log10', 'acos', 'asin', 'atan', 'tan', 'cbrt', 'expm1', 'log1p', 'sinh', 'cosh', 'tanh']);
export function sourceRatchetSignals(path: string, text: string): string[] {
  if (isTestPath(path) || !/^packages\/.+\.[cm]?ts$/u.test(path)) return [];
  const result = new Set<string>(), tree = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node): void => {
    const objects = path.startsWith('packages/objects/src/');
    if (ts.isCallExpression(node)) {
      const expression = node.expression;
      const owner = ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression) ? expression.expression.getText(tree) : '';
      const member = ts.isPropertyAccessExpression(expression) ? expression.name.text
        : ts.isElementAccessExpression(expression) && expression.argumentExpression && ts.isStringLiteral(expression.argumentExpression) ? expression.argumentExpression.text : '';
      if (objects && (member === 'sort' || owner === 'Math' && NUMERIC_MATH.has(member))) result.add('objects');
      if (owner === 'process' && member === 'cwd') result.add('cwd');
    }
    if (objects && ts.isVariableDeclaration(node) && node.initializer?.getText(tree) === 'Math' && ts.isObjectBindingPattern(node.name))
      for (const binding of node.name.elements) if (NUMERIC_MATH.has((binding.propertyName ?? binding.name).getText(tree))) result.add('objects');
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return [...result];
}
export function checkSourceRatchets(root: string, files: readonly string[]): string[] {
  const path = resolve(root, RATCHET_PATH);
  const signals = files.filter(file => /^packages\/.+\.[cm]?ts$/u.test(file) && !isTestPath(file) && existsSync(resolve(root, file)))
    .map(file => ({ file, kinds: sourceRatchetSignals(file, readFileSync(resolve(root, file), 'utf8')) }));
  if (!existsSync(path)) return [`${RATCHET_PATH}: missing source ratchet budget`];
  const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!raw || typeof raw !== 'object') throw new TypeError('Invalid source ratchets');
  const findings: string[] = [];
  for (const kind of ['objects', 'cwd']) {
    const budget: unknown = Reflect.get(raw, kind);
    if (!budget || typeof budget !== 'object') throw new TypeError(`Invalid ${kind} budget`);
    const baseline = parseRatchet(Reflect.get(budget, 'entries'));
    findings.push(...ceilingFindings(Reflect.get(budget, 'ceiling'), Object.keys(baseline).length, kind));
    const present = new Set(signals.filter(source => source.kinds.includes(kind)).map(source => source.file));
    for (const file of present) if (!(file in baseline)) findings.push(`${file}: ${kind === 'objects' ? 'objects holds formats only; numeric derivation/partitioning belongs to its owner' : 'resolve checkout roots from module location, not process.cwd()'}`);
    for (const file of Object.keys(baseline)) if (!present.has(file)) findings.push(`${file}: remove stale ${kind} ratchet allowance`);
  }
  return findings;
}
