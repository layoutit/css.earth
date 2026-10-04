/** Shrink-only budgets for remaining format validation math and working-directory commands. */
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
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
export function growthFindings(current: Ratchet, previous: Ratchet): string[] {
  return Object.keys(current).filter(path => !(path in previous)).map(path => `${path}: source ratchets may only shrink`);
}
export function sourceRatchetSignals(path: string, text: string): string[] {
  if (isTestPath(path) || !/^packages\/.+\.[cm]?ts$/u.test(path)) return [];
  const result = new Set<string>(), tree = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const expression = node.expression;
      if (path.startsWith('packages/objects/src/') && (expression.name.text === 'sort'
        || expression.expression.getText(tree) === 'Math' && ['sqrt', 'sin', 'cos', 'atan2', 'pow', 'hypot'].includes(expression.name.text))) result.add('objects');
      if (expression.expression.getText(tree) === 'process' && expression.name.text === 'cwd') result.add('cwd');
    }
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return [...result];
}
export function checkSourceRatchets(root: string, files: readonly string[]): string[] {
  const path = resolve(root, RATCHET_PATH);
  const signals = files.filter(file => /^packages\/.+\.[cm]?ts$/u.test(file) && !isTestPath(file) && existsSync(resolve(root, file)))
    .map(file => ({ file, kinds: sourceRatchetSignals(file, readFileSync(resolve(root, file), 'utf8')) }));
  if (!existsSync(path)) return signals.some(source => source.kinds.length > 0)
    ? [`${RATCHET_PATH}: missing source ratchet budget; existing numeric/root signals require their committed allowances`] : [];
  const raw: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!raw || typeof raw !== 'object') throw new TypeError('Invalid source ratchets');
  const findings: string[] = [];
  let previous: unknown;
  try { previous = JSON.parse(execFileSync('git', ['show', `origin/main:${RATCHET_PATH}`], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString()); } catch { /* Initial ratchet adoption and shallow checkouts have no older budget. */ }
  for (const kind of ['objects', 'cwd']) {
    const baseline = parseRatchet(Reflect.get(raw, kind));
    if (previous && typeof previous === 'object') findings.push(...growthFindings(baseline, parseRatchet(Reflect.get(previous, kind))));
    const present = new Set(signals.filter(source => source.kinds.includes(kind)).map(source => source.file));
    for (const file of present) if (!(file in baseline)) findings.push(`${file}: ${kind === 'objects' ? 'objects holds formats only; numeric derivation/partitioning belongs to its owner' : 'resolve checkout roots from module location, not process.cwd()'}`);
    for (const file of Object.keys(baseline)) if (!present.has(file)) findings.push(`${file}: remove stale ${kind} ratchet allowance`);
  }
  return findings;
}
