/** Run bounded source mutations in disposable copies; a positive failing test signal is required for each. */
import { mkdir, mkdtemp, readFile, writeFile, cp, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
const mutations: { name: string; file: string; before: string; after: string; pattern?: string }[] = [
  { name: 'delete-increase-check', file: 'compare-measures.mts', before: "after > before ? 'FAILURE' : 'IMPROVEMENT'", after: "'IMPROVEMENT'" },
  { name: 'delete-order-rule', file: 'compare-measures.mts', before: "after.length < before.length && subsequence(before, after) ? 'IMPROVEMENT' : 'FAILURE'", after: "'IMPROVEMENT'" },
  { name: 'ignore-preload-counts', file: 'compare-measures.mts', before: 'const before = left[key] ?? 0, after = right[key] ?? 0;', after: "if (key === 'links.preload') continue; const before = left[key] ?? 0, after = right[key] ?? 0;" },
  { name: 'ignore-dynamic-imports', file: 'build-measures.mts', before: 'result.dynamic.push(literal(node.arguments[0]));', after: 'void literal(node.arguments[0]);' }
];
mutations.push(
  { name: 'omit-inline-script-raw', file: 'build-measures.mts', before: "add('inline.script.raw', Buffer.byteLength(script.textContent ?? ''));", after: '', pattern: 'inline startup script byte growth' },
  { name: 'sort-dynamic-import-order', file: 'build-measures.mts', before: '= order.map(identity);', after: '= order.map(identity).sort();', pattern: 'nonalphabetical dynamic import source order' }
);
for (const key of ['startup.methods.', 'static.chain', 'startup.sequentialRoundTrips']) mutations.push({
  name: 'exempt-' + key.replaceAll('.', '-'), file: 'compare-measures.mts',
  before: 'const before = left[key] ?? 0, after = right[key] ?? 0;',
  after: `if (key.startsWith('${key}')) continue; const before = left[key] ?? 0, after = right[key] ?? 0;`,
  pattern: 'real numeric key ' + key.replaceAll('.', '\\.')
});
for (const field of ['href', 'fetchpriority', 'async', 'defer', 'as', 'rel']) mutations.push({
  name: 'ignore-declaration-' + field, file: 'compare-measures.mts', before: 'sortedJson(item).trim()',
  after: `sortedJson(Object.fromEntries(Object.entries(item && typeof item === 'object' ? item : {}).filter(([key]) => key !== '${field}'))).trim()`,
  pattern: `declaration ${field} change`
});
await mkdir('output/plan7/l7a', { recursive: true });
const results: { name: string; killed: boolean; exitCode: number | null }[] = [];
for (const mutation of mutations) {
  const root = await mkdtemp(resolve('output/plan7/l7a/mutation-'));
  try {
    const scripts = join(root, '.github/scripts'); await mkdir(scripts, { recursive: true });
    await cp(new URL('.', import.meta.url), join(scripts, 'performance'), { recursive: true });
    await mkdir(join(scripts, 'build-compare')); await cp(new URL('../build-compare/records.mts', import.meta.url), join(scripts, 'build-compare/records.mts'));
    const file = join(scripts, 'performance', mutation.file), source = await readFile(file, 'utf8');
    if (source.split(mutation.before).length !== 2) throw new Error(`Mutation must match once: ${mutation.name}`);
    await writeFile(file, source.replace(mutation.before, mutation.after));
    const run = spawnSync(process.execPath, ['--test', ...(mutation.pattern ? ['--test-name-pattern', mutation.pattern] : []), join(scripts, 'performance/build-measures.test.mts')], { encoding: 'utf8', timeout: 30000 });
    const killed = run.status === 1 && /not ok \d+ -/u.test(run.stdout) && /# fail [1-9]/u.test(run.stdout);
    await writeFile(resolve('output/plan7/l7a', mutation.name + '.tap'), run.stdout + run.stderr);
    results.push({ name: mutation.name, killed, exitCode: run.status });
    if (!killed) throw new Error(`Mutation survived or did not run: ${mutation.name}`);
    console.log(`KILLED ${mutation.name}`);
  } finally { await rm(root, { recursive: true, force: true }); }
}
await writeFile('output/plan7/l7a/mutations.json', JSON.stringify(results, null, 2) + '\n');
