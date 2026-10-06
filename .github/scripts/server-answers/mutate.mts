/** Replay bounded mutations only in an explicitly selected disposable local copy. */
import { readFile, writeFile, rename, realpath, stat, mkdir } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { scriptsAt, expandScript } from './revision-entries.mts';
import { serialise } from './model.mts';
const { values } = parseArgs({ options: { copy: { type: 'string' }, target: { type: 'string', default: 'cloudflare' } } });
if (!values.copy) throw new Error('Usage: mutate.mts --copy <disposable-copy>');
const copy = await realpath(values.copy);
if (!(copy.startsWith(await realpath(tmpdir()) + sep) || copy.startsWith(await realpath(process.cwd()) + '-')) || copy === await realpath(process.cwd())) throw new Error('Mutation copy must be disposable and outside the task worktree');
await stat(resolve(copy, '.git'));
if (!['preview', 'cloudflare'].includes(values.target ?? '')) throw new Error('Mutation target must be preview or cloudflare');
const target = values.target;
const output = resolve(copy, `output/server-answers-${target}-mutations`);
await mkdir(output, { recursive: true });
const results: { name: string; command: string[]; exit: number | null; seconds: number }[] = [];
function run(name: string, args: string[], expected: number) {
  const start = performance.now();
  const result = spawnSync(process.execPath, args, { cwd: copy, encoding: 'utf8', timeout: 60_000, maxBuffer: 20 * 1024 * 1024 });
  results.push({ name, command: [process.execPath, ...args], exit: result.status, seconds: (performance.now() - start) / 1000 });
  const log = `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? String(result.error) : ''}`;
  return writeFile(resolve(output, `${name}.log`), log).then(() => {
    if (result.status !== expected) throw new Error(`${name}: expected ${expected}, got ${String(result.status)}; ${log.slice(-500)}`);
  });
}
const scripts = '.github/scripts/server-answers/';
const bundleStep = expandScript(await scriptsAt(copy), 'deploy:cloudflare-preview').find(step => step.startsWith('node '))?.replace(/\s+--noindex\b/u, '');
if (!bundleStep) throw new Error('Unsupported Worker bundle entry');
const bundleArgs = bundleStep.slice(5).split(/\s+/u);
const base = `output/server-answers-${target}-mutations/base`;
async function changed(name: string, file: string, from: string, to: string) {
  const path = resolve(copy, file), original = await readFile(path, 'utf8');
  if (!original.includes(from)) throw new Error(`${name}: mutation target missing`);
  try {
    await writeFile(path, original.replace(from, to));
    await run(`${name}-bundle`, bundleArgs, 0);
    const head = `output/server-answers-${target}-mutations/${name}`;
    await run(`${name}-record`, [scripts + 'record.mts', '--target', 'cloudflare', '--dist', 'dist', '--out', head], 0);
    await run(`${name}-diff`, [scripts + 'diff.mts', '--base', base, '--head', head, '--summary'], 1);
  } finally { await writeFile(path, original); }
}
async function previewChanged(name: string, file: string, from: string, to: string) {
  const path = resolve(copy, file), original = await readFile(path, 'utf8');
  if (!original.includes(from)) throw new Error(`${name}: mutation target missing`);
  try {
    await writeFile(path, original.replace(from, to));
    const head = `output/server-answers-preview-mutations/${name}`;
    await run(`${name}-record`, [scripts + 'record.mts', '--target', 'preview', '--dist', 'dist', '--out', head], 0);
    await run(`${name}-diff`, [scripts + 'diff.mts', '--base', base, '--head', head, '--summary'], 1);
    if (name === 'prepared-range') await run(`${name}-check`, [scripts + 'check.mts', '--recorded', head], 1);
  } finally { await writeFile(path, original); }
}
try {
  if (target === 'preview') {
    await run('base-record', [scripts + 'record.mts', '--target', 'preview', '--dist', 'dist', '--out', base], 0);
    await run('base-check', [scripts + 'check.mts', '--recorded', base], 0);
    await previewChanged('static-byte', 'dist/earth/index.html', '<!DOCTYPE html>', '<!DOCTYPE htmL>');
    await previewChanged('query-trigger', 'site/server/search-route.mts', "['q', 'dataset'", "['dataset'");
    await previewChanged('prepared-range', 'site/server/prepared-files.mts', 'response.writeHead(200,', 'response.writeHead(request.headers.range ? 206 : 200,');
    await previewChanged('query-html', 'site/server/search/search-server.mts', 'Buffer.from(await answer.arrayBuffer())', "Buffer.from((await answer.text()) + (answer.headers.get('content-type')?.includes('text/html') && url.searchParams.has('q') ? '<!-- changed query-bearing HTML -->' : ''))");
    const restored = 'output/server-answers-preview-mutations/restored';
    await run('restored-record', [scripts + 'record.mts', '--target', 'preview', '--dist', 'dist', '--out', restored], 0);
    await run('restored-check', [scripts + 'check.mts', '--recorded', restored], 0);
    await run('restored-diff', [scripts + 'diff.mts', '--base', base, '--head', restored, '--summary'], 0);
  } else {
  await run('base-bundle', bundleArgs, 0);
  await run('base-record', [scripts + 'record.mts', '--target', 'cloudflare', '--dist', 'dist', '--out', base], 0);
  await run('base-check', [scripts + 'check.mts', '--recorded', base], 0);
  await changed('header', 'site/server/search/search-response.mts', "headers.set('cache-control', 'private, no-store')", "headers.set('cache-control', 'public, max-age=9')");
  await changed('status', 'site/server/search/find.mts', "return json({ error: 'Pass object=<body id>.' }, 400)", "return json({ error: 'Pass object=<body id>.' }, 401)");
  await changed('body', 'site/server/search/find.mts', 'Pass object=<body id>.', 'Deliberately changed response.');
  const missing = resolve(copy, 'src/objects/observable-universe/prepared/world-index.json');
  await rename(missing, missing + '.mutation');
  // The Worker carries the project files the page handler reads in its script: one missing fails the bundle, not a request.
  try { await run('missing-project-file-bundle', bundleArgs, 1); }
  finally { await rename(missing + '.mutation', missing); }
  // Pure route gate is evidence for the Worker's router; the real preview gate still requires a listener.
  const route = resolve(copy, 'site/server/search-route.mts'), routeText = await readFile(route, 'utf8');
  try {
    await writeFile(route, routeText.replace("['q', 'dataset'", "['dataset'"));
    await run('query-pure-logic', ['--test', '--test-name-pattern=The page route keeps', 'site/server/search/search-response.test.mts'], 1);
  } finally { await writeFile(route, routeText); }
  await run('prepared-base', ['.github/scripts/server-answers/prepared-probe.mts'], 0);
  const prepared = resolve(copy, 'site/server/prepared-files.mts'), preparedText = await readFile(prepared, 'utf8');
  try {
    await writeFile(prepared, preparedText.replace('response.writeHead(200,', 'response.writeHead(request.headers.range ? 206 : 200,'));
    await run('prepared-range-status', ['.github/scripts/server-answers/prepared-probe.mts'], 1);
  } finally { await writeFile(prepared, preparedText); }
  await run('restored-bundle', bundleArgs, 0);
  await run('restored-record', [scripts + 'record.mts', '--target', 'cloudflare', '--dist', 'dist', '--out', `output/server-answers-${target}-mutations/restored`], 0);
  await run('restored-check', [scripts + 'check.mts', '--recorded', `output/server-answers-${target}-mutations/restored`], 0);
  await run('restored-diff', [scripts + 'diff.mts', '--base', base, '--head', `output/server-answers-${target}-mutations/restored`], 0);
  }
} finally { await writeFile(resolve(output, 'results.json'), serialise(results)); }
console.log(`Mutation results: ${output}/results.json`);
