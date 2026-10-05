/** Counted guard: structural counts, declarations and ordered sequences may never get worse; byte measures may grow by at most 1%. Improvements are accepted without rewriting a baseline. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { args, isMain } from '../build-compare/records.mts';
import { parseMeasures, sortedJson } from './build-measures.mts';
import type { Measures } from './build-measures.mts';
export type FindingKind = 'increase' | 'order' | 'declaration' | 'removed-route';
export interface Finding { kind: FindingKind; route: string; measure: string; base: number | string[]; head: number | string[]; verdict: 'FAILURE' | 'IMPROVEMENT' | 'TOLERATED' }
export interface Comparison { pass: boolean; findings: Finding[]; addedRoutes: string[]; removedRoutes: string[] }
/** Only deletion with the retained elements in their original order is an ordered improvement. */
export function subsequence(base: readonly string[], head: readonly string[]): boolean {
  let cursor = 0;
  for (const item of head) { while (cursor < base.length && base[cursor] !== item) cursor++; if (cursor === base.length) return false; cursor++; }
  return true;
}
/** Owner policy (2026-10-05): bytes may grow by at most this percentage per measure, whether one file or a route's total. */
export const BYTE_TOLERANCE_PERCENT = 1;
/** Raw, gzip and Brotli sizes of any file or total. Every other measure is a structural count and never grows. */
export const isByteMeasure = (measure: string): boolean => /\.(?:raw|gzip|brotli)$/u.test(measure);
export function compare(base: Measures, head: Measures): Comparison {
  const findings: Finding[] = [];
  const numeric = (route: string, left: Record<string, number>, right: Record<string, number>) => {
    for (const key of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) {
      const before = left[key] ?? 0, after = right[key] ?? 0;
      if (after === before) continue;
      // Exact integer arithmetic: a byte measure may reach at most (100 + tolerance)% of its base; a new file (base 0) never does.
      const tolerated = isByteMeasure(key) && before > 0 && after * 100 <= before * (100 + BYTE_TOLERANCE_PERCENT);
      findings.push({ kind: 'increase', route, measure: key, base: before, head: after, verdict: after < before ? 'IMPROVEMENT' : tolerated ? 'TOLERATED' : 'FAILURE' });
    }
  };
  numeric('GLOBAL', base.global, head.global);
  const addedRoutes = Object.keys(head.routes).filter(route => !base.routes[route]).sort(), removedRoutes = Object.keys(base.routes).filter(route => !head.routes[route]).sort();
  for (const route of Object.keys(base.routes).sort()) {
    const left = base.routes[route]!, right = head.routes[route]; if (!right) continue;
    numeric(route, left.counts, right.counts);
    // Canonical records form a multiset: only complete declaration removal improves it.
    const declarations = (items: unknown[]) => items.map(item => sortedJson(item).trim()).sort();
    const beforeDeclarations = declarations(left.declarations);
    const afterDeclarations = declarations(right.declarations);
    if (JSON.stringify(beforeDeclarations) !== JSON.stringify(afterDeclarations)) findings.push({ kind: 'declaration', route, measure: 'declarations', base: beforeDeclarations, head: afterDeclarations, verdict: afterDeclarations.length < beforeDeclarations.length && subsequence(beforeDeclarations, afterDeclarations) ? 'IMPROVEMENT' : 'FAILURE' });
    for (const key of [...new Set([...Object.keys(left.sequences), ...Object.keys(right.sequences)])].sort()) {
      const before = left.sequences[key] ?? [], after = right.sequences[key] ?? [];
      if (JSON.stringify(before) !== JSON.stringify(after)) findings.push({ kind: 'order', route, measure: key, base: before, head: after, verdict: after.length < before.length && subsequence(before, after) ? 'IMPROVEMENT' : 'FAILURE' });
    }
  }
  for (const route of removedRoutes) findings.push({ kind: 'removed-route', route, measure: 'route', base: [route], head: [], verdict: 'FAILURE' });
  // Route removal cannot conceal coverage loss. Additions need a merge-base counterpart before acceptance.
  return { pass: !addedRoutes.length && !removedRoutes.length && !findings.some(finding => finding.verdict === 'FAILURE'), findings, addedRoutes, removedRoutes };
}
export function failureCounts(result: Comparison): Record<FindingKind, number> {
  const counts: Record<FindingKind, number> = { increase: 0, order: 0, declaration: 0, 'removed-route': 0 };
  for (const finding of result.findings) if (finding.verdict === 'FAILURE') counts[finding.kind]++;
  return counts;
}
export function summary(result: Comparison): string {
  return `# Counted build guard: ${result.pass ? 'PASS' : 'FAIL'}\n\n` +
    `Added routes: ${result.addedRoutes.join(', ') || 'none'}\n\nRemoved routes: ${result.removedRoutes.join(', ') || 'none'}\n\n` +
    `Failures by kind: ${Object.entries(failureCounts(result)).map(([kind, count]) => `${kind}: ${count}`).join(', ')}\n\n` +
    '| Verdict | Kind | Route | Measure | Base | Head |\n| --- | --- | --- | --- | --- | --- |\n' + result.findings.map(item => `| ${item.verdict} | ${item.kind} | ${item.route} | ${item.measure.replaceAll('|', '\\|')} | ${JSON.stringify(item.base).replaceAll('|', '\\|')} | ${JSON.stringify(item.head).replaceAll('|', '\\|')} |`).join('\n') + '\n';
}
if (isMain(import.meta.url)) {
  // A valueless --accept-improvements is accepted explicitly; acceptance is always the default.
  const explicit = process.argv.indexOf('--accept-improvements'); if (explicit >= 0) process.argv.splice(explicit, 1);
  const options = args(['--base', '--head', '--json', '--summary']);
  if (!options.get('--base') || !options.get('--head')) throw new Error('Required: --base <measuresDir> --head <measuresDir>');
  const load = async (directory: string) => parseMeasures(JSON.parse(await readFile(resolve(directory, 'measures.json'), 'utf8')));
  const result = compare(await load(options.get('--base')!), await load(options.get('--head')!));
  if (options.get('--json')) await writeFile(options.get('--json')!, sortedJson(result));
  if (options.get('--summary')) await writeFile(options.get('--summary')!, summary(result));
  console.log(summary(result)); process.exitCode = result.pass ? 0 : 1;
}
