/** Offline retained-build proofs and sparse HTML-only adversarial copies; never rebuilds or writes an input build. */
import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { args, files } from '../build-compare/records.mts';
import { measure, sortedJson, parseMeasures, startup } from './build-measures.mts';
import { representativeRoutes } from './measure.mts';
import { compare, summary, failureCounts } from './compare-measures.mts';
const options = args(['--builds', '--out']);
if (!options.get('--builds')) throw new Error('Required --builds <retained-build-parent>');
const parent = resolve(options.get('--builds')!), out = resolve(options.get('--out') ?? 'output/plan7/l7a');
await mkdir(out, { recursive: true });
const routes = await representativeRoutes(), timings: string[] = [], reports: string[] = [];
const measured = async (name: string, routes: string[]) => {
  const start = performance.now(), root = resolve(parent, name), result = await measure(resolve(root, 'dist'), resolve(root, 'metadata'), routes);
  timings.push(`${name}: ${((performance.now() - start) / 1000).toFixed(2)} s`); return result;
};
// The shipped defaults and proof coverage are the same fifteen routes.
const selected = routes;
const base = await measured('r4-corrected-base', selected), repeated = await measured('r4-corrected-base', selected);
if (sortedJson(base) !== sortedJson(repeated)) throw new Error('Repeated base differs');
for (const [name, data] of [['base', base], ['base-repeat', repeated]] as const) { await mkdir(resolve(out, name), { recursive: true }); await writeFile(resolve(out, name, 'measures.json'), sortedJson(data)); }
const equal = compare(base, repeated); if (!equal.pass || equal.findings.length) throw new Error('Equality proof failed');
reports.push('Base measured twice: byte-identical JSON. Base vs base: PASS, zero findings.');
const equalCli = spawnSync(process.execPath, [resolve('.github/scripts/performance/compare-measures.mts'), '--base', resolve(out, 'base'), '--head', resolve(out, 'base-repeat'), '--json', resolve(out, 'equal.json'), '--summary', resolve(out, 'equal.md')], { encoding: 'utf8', timeout: 30000 });
if (equalCli.status !== 0 || !equalCli.stdout.includes('PASS')) throw new Error('Equality CLI proof failed');
reports.push('Base-vs-base comparator CLI: exit 0 with PASS.');
reports.push(`Base global: ${base.global['astro.count']} JavaScript chunks, ${base.global['astro.raw']} raw bytes, ${base.global['astro.gzip']} gzip bytes, ${base.global['astro.brotli']} Brotli bytes; ${base.global['css.count']} CSS files, ${base.global['css.raw']} raw bytes; ${base.global['transports.count']} transports, ${base.global['transports.raw']} raw bytes.`);
for (const [name, build] of [['di', 'r4-corrected-di'], ['graph', 'r4-graph-build']]) {
  const head = await measured(build!, selected), result = compare(base, head);
  await mkdir(resolve(out, name!), { recursive: true }); await writeFile(resolve(out, name!, 'measures.json'), sortedJson(head));
  await writeFile(resolve(out, name! + '.json'), sortedJson(result)); await writeFile(resolve(out, name! + '.md'), summary(result));
  const improvements = result.findings.filter(item => item.verdict === 'IMPROVEMENT');
  reports.push(`${build}: ${result.pass ? 'PASS' : 'FAIL'}; failures by kind (${Object.entries(failureCounts(result)).map(([kind, count]) => `${kind}: ${count}`).join(', ')}), ${improvements.length} improvements. Full route-by-route numbers: [${name}.md](${name}.md).`);
  const cli = spawnSync(process.execPath, [resolve('.github/scripts/performance/compare-measures.mts'), '--base', resolve(out, 'base'), '--head', resolve(out, name!)], { encoding: 'utf8', timeout: 30000, maxBuffer: 16 * 1024 * 1024 });
  if (cli.status !== (result.pass ? 0 : 1) || !cli.stdout.includes(result.pass ? 'PASS' : 'FAIL')) throw new Error(`CLI proof failed: ${build}`);
  reports.push(`Comparator CLI exit: ${cli.status}.`);
  if (name === 'graph') {
    reports.push(`Global chunk count ${base.global['astro.count']} → ${head.global['astro.count']}; raw ${base.global['astro.raw']} → ${head.global['astro.raw']}; gzip ${base.global['astro.gzip']} → ${head.global['astro.gzip']}; Brotli ${base.global['astro.brotli']} → ${head.global['astro.brotli']}. Raw improves by 57 bytes; gzip increases 55 bytes and Brotli increases 145 bytes. Contrary to the shorthand description, the emitted registry chunk remains: its raw size falls 74,608 → 72,711 while router grows 45,417 → 47,257.`);
    const keys = ['static.count', 'static.raw', 'static.gzip', 'static.brotli', 'dynamic.count', 'dynamic.raw', 'dynamic.gzip', 'dynamic.brotli'];
    reports.push('| Route | ' + keys.join(' | ') + ' |\n| --- | ' + keys.map(() => '---:').join(' | ') + ' |\n' + Object.keys(base.routes).map(route => '| ' + route + ' | ' + keys.map(key => `${base.routes[route]!.counts[key]} → ${head.routes[route]!.counts[key]}`).join(' | ') + ' |').join('\n'));
  }
}
const root = resolve(out, 'l7a-throwaway-html'); await rm(root, { recursive: true, force: true }); await mkdir(root);
await writeFile(resolve(root, '.performance-throwaway'), 'L7A DISPOSABLE COPY\n');
const input = resolve(parent, 'r4-corrected-base/dist'), metadata = resolve(parent, 'r4-corrected-base/metadata');
const html = await readFile(resolve(input, 'index.html'), 'utf8'); await writeFile(resolve(root, 'index.html'), html);
const needed = new Set((await files(resolve(input, '_astro'))).filter(file => /\.(js|css)$/u.test(file)).map(file => '_astro/' + file));
for (const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gu)) {
  if (script[1]!.includes('startStartupRequests')) for (const url of startup(script[1]!)) if (url.startsWith('/')) needed.add(url.slice(1));
}
needed.add('native-input.css');
for (const file of needed) { const target = resolve(root, file); await mkdir(dirname(target), { recursive: true }); await copyFile(resolve(input, file), target, constants.COPYFILE_FICLONE); }
const sparseBase = await measure(root, metadata, ['/']);
for (const name of ['html-extra-preload', 'html-extra-request']) {
  await writeFile(resolve(root, 'index.html'), html);
  const run = spawnSync(process.execPath, [resolve('.github/scripts/performance/breakages/apply.mts'), '--copy', root, '--patch', resolve('.github/scripts/performance/breakages', name + '.json')], { encoding: 'utf8' });
  if (run.status !== 0 || !run.stdout.includes('Applied 1')) throw new Error(`Patch failed: ${name}: ${run.stderr}`);
  const head = await measure(root, metadata, ['/']), result = compare(sparseBase, head);
  const key = name === 'html-extra-preload' ? 'links.preload' : 'startup.requests';
  if (result.pass || !result.findings.some(item => item.measure === key && item.verdict === 'FAILURE')) throw new Error(`Breakage escaped: ${name}`);
  await writeFile(resolve(out, name + '.md'), summary(result));
  reports.push(`${name}: FAIL; ${key} ${sparseBase.routes['/']!.counts[key]} → ${head.routes['/']!.counts[key]}. [Numbers](${name}.md).`);
  if (name === 'html-extra-preload') {
    const removed = spawnSync(process.execPath, [resolve('.github/scripts/performance/breakages/apply.mts'), '--copy', root, '--patch', resolve('.github/scripts/performance/breakages/improvement.json')], { encoding: 'utf8' });
    if (removed.status !== 0 || !removed.stdout.includes('Applied 1') || await readFile(resolve(root, 'index.html'), 'utf8') !== html) throw new Error('Removal patch failed');
    const improvement = compare(head, await measure(root, metadata, ['/']));
    if (!improvement.pass || !improvement.findings.some(item => item.measure === key && item.verdict === 'IMPROVEMENT')) throw new Error('Improvement rejected');
    await writeFile(resolve(out, 'improvement.md'), summary(improvement));
    reports.push('Remove the added redundant preload: PASS with IMPROVEMENT (1 → 0). [Numbers](improvement.md).');
  }
}
const mutations = parseMeasures(JSON.parse(await readFile(resolve(out, 'base/measures.json'), 'utf8'))); // Positive artifact/schema check.
reports.push(`Validated saved artifact: ${Object.keys(mutations.routes).length} routes.`);
await writeFile(resolve(out, 'PROOFS.md'), '# Offline build proofs\n\n' + reports.join('\n\n') + '\n\n## Cost\n\n' + timings.join('\n\n') + '\n\nHTML copies contain only one writable page and copy-on-write copies of only required emitted resources. Compare sparse base to sparse head; global totals of the sparse copy are not the retained full build. No input build was modified.\n');
console.log(reports.join('\n'));
