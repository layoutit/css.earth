import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import test from 'node:test';
import { readPreparationTraces } from './preparation-cache.mts';
import { PREPARATION_TRACE_SCHEMA, PREPARATION_TRACE_VARIABLE, descriptorDigest, type PreparationTrace } from './preparation-trace-format.mts';

const traceModule = new URL('./preparation-trace.mts', import.meta.url).href;

/** Run a script under the preparation trace in a scratch checkout and return every process record, keyed by relative path. */
async function traced(script: string, files: Record<string, string> = {}) {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cssearth-preparation-trace-')));
  try {
    for (const [path, contents] of Object.entries(files)) {
      await mkdir(dirname(join(root, path)), { recursive: true });
      await writeFile(join(root, path), contents);
    }
    await writeFile(join(root, 'script.mts'), script);
    const traces = join(root, 'traces');
    const result = spawnSync(process.execPath, ['script.mts', import.meta.resolve('sharp')], { cwd: root, encoding: 'utf8',
      env: { ...process.env, [PREPARATION_TRACE_VARIABLE]: traces, NODE_OPTIONS: `--import=${traceModule}` } });
    assert.equal(result.status, 0, result.stderr);
    const names = await readdir(traces), records: PreparationTrace[] = [];
    for (const name of names.filter(name => name.endsWith('.json'))) records.push(JSON.parse(await readFile(join(traces, name), 'utf8')));
    assert.equal(names.filter(name => name.endsWith('.started')).length, records.length, 'every traced process leaves a record');
    const accessed = new Map<string, PreparationTrace['files'][string]>();
    for (const record of records) {
      assert.equal(record.schema, PREPARATION_TRACE_SCHEMA);
      for (const [path, file] of Object.entries(record.files)) {
        const key = relative(root, path);
        if (!key.startsWith('..')) accessed.set(accessed.has(key) ? `${key}#${record.pid}` : key, file);
      }
    }
    return { records, files: accessed, commands: records.flatMap(record => record.commands), unsupported: records.flatMap(record => record.unsupported) };
  } finally { await rm(root, { recursive: true, force: true }); }
}

test('the trace records reads, loads, probes, listings and writes, including Sharp paths', async () => {
  const { files, unsupported } = await traced(`
import { createReadStream, existsSync, readdirSync, readFileSync } from 'node:fs';
import { readFile, stat, writeFile, copyFile } from 'node:fs/promises';
const sharp = (await import(process.argv[2])).default;
await readFile('data/input.json');
readFileSync('data/stream.txt');
for await (const _chunk of createReadStream('data/stream.txt')) {}
await stat('data/missing.json').catch(() => null);
existsSync('data/also-missing');
readdirSync('data');
await copyFile('data/stream.txt', 'data/copy.txt');
await sharp({ create: { width: 2, height: 2, channels: 3, background: '#808080' } }).png().toFile('data/made.png');
await sharp('data/made.png').resize(1).toFile('data/small.png');
await writeFile('data/output.txt', 'out');
await import('./data/module.json', { with: { type: 'json' } });
`, { 'data/input.json': '{}', 'data/stream.txt': 'text', 'data/module.json': '{"value":1}' });
  const accesses = (path: string) => files.get(path)?.accesses;
  assert.deepEqual(accesses('data/input.json'), ['read']);
  assert.deepEqual(accesses('data/stream.txt'), ['read']);
  assert.deepEqual(files.get('data/missing.json'), { accesses: ['probe'], first: { missing: true } });
  assert.deepEqual(accesses('data/also-missing'), ['probe']);
  assert.deepEqual(accesses('data'), ['list']);
  assert.deepEqual(accesses('data/copy.txt'), ['write']);
  assert.deepEqual(accesses('data/made.png'), ['read', 'write']);
  assert.deepEqual(accesses('data/small.png'), ['write']);
  assert.deepEqual(accesses('data/output.txt'), ['write']);
  assert.deepEqual(accesses('data/module.json'), ['load'], 'the loader reading a module is its load, not a separate read');
  assert.deepEqual(accesses('script.mts'), ['load']);
  assert.equal(files.get('data/stream.txt')?.first.size, 4);
  assert.deepEqual(unsupported, []);
});

test('the trace records programs, including promisified calls, and follows Node children given a new environment', async () => {
  const { commands, records, files } = await traced(`
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
await promisify(execFile)('/bin/sh', ['-c', 'exit 0']);
const child = spawnSync(process.execPath, ['-e', "require('node:fs').readFileSync('data/child.txt')"], { env: { PATH: process.env.PATH } });
if (child.status !== 0) throw new Error(String(child.stderr));
`, { 'data/child.txt': 'child' });
  assert.deepEqual(commands.map(command => [command.command.split('/').at(-1), command.shell]), [['sh', false], [process.execPath.split('/').at(-1), false]]);
  assert.equal(records.length, 2);
  assert.deepEqual(files.get('data/child.txt')?.accesses, ['read']);
});

test('a worker thread records its own reads, and file watching is marked as unrecorded', async () => {
  const { files, records, unsupported } = await traced(`
import { Worker } from 'node:worker_threads';
import { watch, writeFileSync } from 'node:fs';
writeFileSync('worker.mts', "import { readFileSync } from 'node:fs'; readFileSync('data/worker.txt');");
await new Promise(resolve => new Worker(new URL('./worker.mts', import.meta.url)).once('exit', resolve));
watch('.').close();
`, { 'data/worker.txt': 'thread' });
  assert.equal(records.length, 2);
  assert.deepEqual(files.get('data/worker.txt')?.accesses, ['read']);
  assert.deepEqual(unsupported, ['fs.watch']);
});

test('the trace keeps each owner view of an object descriptor as first read', async () => {
  const descriptor = JSON.stringify({ schema: 'cssearth-object@1', id: 'moon', type: 'moon',
    properties: { catalog: { name: 'Moon', description: 'Card' }, recipe: { schema: 'recipe' }, page: { metadata: { sha256: 'a' } }, worldFrame: { radius: 1 } },
    prepared: { sha256: 'b' } });
  const { files } = await traced(`import { readFileSync } from 'node:fs'; readFileSync('src/objects/moon/object.json');`, { 'src/objects/moon/object.json': descriptor });
  assert.deepEqual(files.get('src/objects/moon/object.json')?.first.views, {
    registry: descriptorDigest(descriptor, 'registry'), recipe: descriptorDigest(descriptor, 'recipe'), pins: descriptorDigest(descriptor, 'pins') });
});

test('descriptor views leave the card out and keep each owner apart', () => {
  const base = { schema: 'cssearth-object@1', id: 'moon', type: 'moon',
    properties: { catalog: { name: 'Moon', description: 'Card' }, recipe: { radius: 1 }, page: { stylesheets: ['a.css'], metadata: { sha256: 'a' } }, worldFrame: { radius: 1 } },
    prepared: { sha256: 'b' } };
  const digest = (value: unknown, view: 'registry' | 'recipe' | 'pins') => descriptorDigest(JSON.stringify(value), view);
  const edit = (change: (value: typeof base) => void) => { const value = structuredClone(base); change(value); return value; };
  const card = edit(value => { value.properties.catalog.description = 'New card'; });
  const recipe = edit(value => { value.properties.recipe.radius = 2; });
  const pins = edit(value => { value.prepared.sha256 = 'c'; });
  const frame = edit(value => { value.properties.worldFrame.radius = 2; });
  const name = edit(value => { value.properties.catalog.name = 'Luna'; });
  for (const view of ['registry', 'recipe', 'pins'] as const) assert.equal(digest(card, view), digest(base, view), `${view} ignores the card`);
  assert.notEqual(digest(recipe, 'recipe'), digest(base, 'recipe'));
  assert.equal(digest(recipe, 'registry'), digest(base, 'registry'));
  assert.equal(digest(pins, 'recipe'), digest(base, 'recipe'));
  assert.equal(digest(pins, 'registry'), digest(base, 'registry'));
  assert.notEqual(digest(pins, 'pins'), digest(base, 'pins'));
  assert.notEqual(digest(frame, 'registry'), digest(base, 'registry'));
  assert.equal(digest(frame, 'recipe'), digest(base, 'recipe'));
  assert.notEqual(digest(name, 'registry'), digest(base, 'registry'));
});

test('a worker thread terminated mid-task leaves the journal of what it read', async () => {
  const root = await realpath(await mkdtemp(join(tmpdir(), 'cssearth-preparation-trace-')));
  try {
    await mkdir(join(root, 'data'));
    await writeFile(join(root, 'data/busy.txt'), 'busy');
    await writeFile(join(root, 'busy.mts'), "import { readFileSync } from 'node:fs'; import { parentPort } from 'node:worker_threads'; readFileSync('data/busy.txt'); parentPort?.postMessage('read'); setInterval(() => {}, 1000);");
    await writeFile(join(root, 'script.mts'), `import { Worker } from 'node:worker_threads';
const busy = new Worker(new URL('./busy.mts', import.meta.url));
await new Promise(resolve => busy.once('message', resolve));
await busy.terminate();`);
    const traces = join(root, 'traces');
    const result = spawnSync(process.execPath, ['script.mts'], { cwd: root, encoding: 'utf8',
      env: { ...process.env, [PREPARATION_TRACE_VARIABLE]: traces, NODE_OPTIONS: `--import=${traceModule}` } });
    assert.equal(result.status, 0, result.stderr);
    const read = await readPreparationTraces(traces);
    assert.deepEqual([...read.unsupported], []);
    assert.deepEqual([...(read.files.get(join(root, 'data/busy.txt'))?.accesses ?? [])], ['read']);
  } finally { await rm(root, { recursive: true, force: true }); }
});
