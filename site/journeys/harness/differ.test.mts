/** Synthetic differ qualification; these tests do not qualify the missing browser recorder. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, writeFile, readFile, cp, symlink, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deflateSync } from 'node:zlib';
import { crc32 } from './png.mts';
import { compareDirectories, comparePng, compareTraces, firstDifference } from './differ.mts';
import { families, json, parseTrace, type Family, type Json, type Trace } from './trace.mts';

const exec = promisify(execFile);
function fixture(): Trace {
  return parseTrace({ schema: 'cssearth-journey@1', journey: 'small-page', profile: 'chromium-desktop',
    toolchain: { browserVersion: 'same', playwrightVersion: '1.60.0', viewport: [1280, 800], reducedMotion: 'no-preference' },
    exercises: ['capability:directLoad'], observations: { network: [], dom: [], rendering: [], content: [], errors: [] } });
}
function changed(family: Family, data: Json): Trace {
  const trace = fixture(); trace.observations[family].push({ sequence: 0, step: 'ready', data }); return trace;
}
const mutations: Record<Family, Record<string, Json>> = {
  network: {
    repeat: [{ url: '/file', method: 'GET' }, { url: '/file', method: 'GET' }],
    status: { url: '/file', status: 503 }, failure: { url: '/file', failure: 'failed' },
    order: [{ response: '/a' }, { request: '/b', afterResponse: '/a' }], cancellation: { url: '/file', failure: 'aborted', cancelled: true },
    cache: { url: '/file', source: 'disk-cache' }, redirect: { url: '/a', redirect: '/b' },
  },
  dom: {
    transient: [{ path: 'body>div', action: 'attach' }, { path: 'body>div', action: 'detach' }],
    classification: { path: 'body>div', property: 'transform', classification: 'ALLOWED/COASTING' },
    attribute: { path: 'body', attribute: 'data-ready', value: 'loading' }, retained: { path: '.object-stage', count: 2 },
  },
  rendering: { geometry: { path: '.object-stage', x: 1 }, style: { path: '.object-stage', transform: 'matrix(1,0,0,1,1,0)' } },
  content: { text: { text: 'different' }, title: { title: 'different' }, url: { url: '/dione/?v=changed' },
    history: { length: 3, stateShape: { entry: 'string' } }, data: { ready: 'loading' } },
  errors: { pageerror: { source: 'pageerror', message: 'deliberate' }, rejection: { source: 'unhandledrejection', message: 'deliberate' },
    console: { source: 'console-error', message: 'deliberate' }, warning: { source: 'console-warning', message: 'deliberate' },
    worker: { source: 'worker-error', message: 'deliberate' } },
};
for (const family of families) for (const [dimension, data] of Object.entries(mutations[family])) {
  test(`detects ${family} ${dimension}`, () => {
    const base = fixture(); assert.deepEqual(compareTraces(base, fixture()), []);
    const differences = compareTraces(base, changed(family, data));
    assert.equal(differences.length, 1); assert.equal(differences[0]?.family, family);
    assert.equal(differences[0]?.path, `$.observations.${family}.length`);
  });
}
test('points to the first changed leaf and preserves repeats and order', () => {
  assert.deepEqual(firstDifference({ b: 1, a: 2 }, { a: 2, b: 1 }), null);
  assert.equal(firstDifference([{ status: 200 }], [{ status: 503 }])?.path, '$[0]["status"]');
  assert.equal(firstDifference(['a', 'a'], ['a'])?.path, '$.length');
  assert.equal(firstDifference(['a', 'b'], ['b', 'a'])?.path, '$[0]');
  assert.match(firstDifference({ a: null }, {})?.path ?? '', /missing in head/u);
});
function png(red = 0, width = 2, alpha = 255): Uint8Array {
  const chunk = (type: string, data: Buffer) => {
    const name = Buffer.from(type), result = Buffer.alloc(data.length + 12);
    result.writeUInt32BE(data.length); name.copy(result, 4); data.copy(result, 8);
    result.writeUInt32BE(crc32(Buffer.concat([name, data])), data.length + 8); return result;
  };
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(2, 4); header[8] = 8; header[9] = 6;
  const pixels = Buffer.alloc((width * 4 + 1) * 2);
  for (let row = 0; row < 2; row++) for (let x = 0; x < width; x++) pixels[row * (width * 4 + 1) + 1 + x * 4 + 3] = alpha;
  pixels[1] = red;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0))]);
}
test('detects rendering screenshot, including a one-channel change of one pixel', () => {
  assert.equal(comparePng(png(), png()), null);
  assert.equal(comparePng(png(), png(1))?.path, 'pixels[0,0] (1 differing pixels)');
  assert.equal(comparePng(png(0, 2, 0), png(1, 2, 0))?.path, 'pixels[0,0] (1 differing pixels)');
  assert.equal(comparePng(png(0, 2, 0), png(0, 2, 1))?.path, 'pixels[0,0] (4 differing pixels)');
  assert.equal(comparePng(png(), png(0, 3))?.path, 'dimensions');
  assert.throws(() => comparePng(new Uint8Array([0]), png()));
});
test('schema refuses malformed, absent and unknown observations', () => {
  assert.throws(() => parseTrace({}), /schema/u);
  assert.throws(() => json({ bad: undefined }), /expected an object/u);
  assert.throws(() => json(Infinity), /expected an object/u);
  const value = fixture(); Reflect.deleteProperty(value.observations, 'network');
  assert.throws(() => parseTrace(value), /network/u);
  const extra = { ...fixture(), mystery: true }; assert.throws(() => parseTrace(extra), /unknown field/u);
  const duplicate = changed('dom', {}); duplicate.observations.dom.push({ sequence: 0, step: 'ready', data: {} });
  assert.throws(() => parseTrace(duplicate), /strictly increasing/u);
  const escaping = fixture(); escaping.observations.rendering.push({ sequence: 0, step: 'ready', data: {}, screenshot: '../escape.png' });
  assert.throws(() => parseTrace(escaping), /relative PNG/u);
  assert.throws(() => compareTraces(fixture(), { ...fixture(), toolchain: { browserVersion: 'different' } }), /toolchain/u);
});
async function artifact(folder: string, trace: Trace, red = 0) {
  await mkdir(folder, { recursive: true });
  await writeFile(resolve(folder, 'small-page.trace.json'), JSON.stringify(trace));
  await writeFile(resolve(folder, 'ready.png'), png(red));
}
test('directory and CLI distinguish identical, different and incomplete artifacts', async () => {
  await mkdir('output/journeys', { recursive: true });
  const directory = await mkdtemp(resolve('output/journeys/journey-differ-'));
  const base = resolve(directory, 'base'), head = resolve(directory, 'head'), empty = resolve(directory, 'empty');
  try {
    const trace = fixture(); trace.observations.rendering.push({ sequence: 0, step: 'ready', data: {}, screenshot: 'ready.png' });
    await artifact(base, trace); await artifact(head, trace); await mkdir(empty);
    assert.deepEqual(await compareDirectories(base, head), []);
    const cli = resolve(import.meta.dirname, '../compare.mts');
    const run = async (a: string, b: string) => {
      try { const result = await exec(process.execPath, [cli, '--base', a, '--head', b]); return { code: 0, output: result.stdout }; }
      catch (error) {
        if (!(error instanceof Error) || !('code' in error) || typeof error.code !== 'number' || !('stderr' in error) || typeof error.stderr !== 'string') throw error;
        return { code: error.code, output: error.stderr };
      }
    };
    assert.equal((await run(base, head)).code, 0);
    await artifact(head, trace, 1);
    const differences = await compareDirectories(base, head);
    assert.equal(differences.length, 1); assert.equal(differences[0]?.family, 'rendering');
    assert.match(differences[0]?.path ?? '', /screenshot.pixels/u);
    assert.equal((await run(base, head)).code, 1);
    assert.equal((await run(base, empty)).code, 2);
    await rm(resolve(head, 'ready.png'));
    await assert.rejects(compareDirectories(base, head), /ENOENT/u);
    assert.equal((await run(base, head)).code, 2);
    await artifact(head, trace);
    await cp(resolve(head, 'small-page.trace.json'), resolve(head, 'duplicate.trace.json'));
    await assert.rejects(compareDirectories(base, head), /Duplicate/u);
    await rm(resolve(head, 'duplicate.trace.json'));
    await cp(resolve(import.meta.dirname, '../compare.mts'), resolve(directory, 'compare.mts'));
    await symlink(resolve(base, 'ready.png'), resolve(head, 'escape.png'));
    await assert.rejects(compareDirectories(base, head), /Symlinks/u);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
test('deleting each differ detector makes its qualification red', async () => {
  await mkdir('output/journeys', { recursive: true });
  const directory = await mkdtemp(resolve('output/journeys/journey-deleted-detector-'));
  const source = await readFile(resolve(import.meta.dirname, 'differ.mts'), 'utf8');
  try {
    for (const name of ['trace.mts', 'differ.mts', 'png.mts', 'canonical.mts', 'differ.test.mts']) await cp(resolve(import.meta.dirname, name), resolve(directory, name));
    await cp(resolve(import.meta.dirname, '../compare.mts'), resolve(directory, 'compare.mts'));
    await symlink(resolve(import.meta.dirname, '../../../node_modules'), resolve(directory, 'node_modules'));
    for (const family of families) {
      const needle = 'for (const family of families) {';
      assert.ok(source.includes(needle));
      await writeFile(resolve(directory, 'differ.mts'), source.replace(needle, `for (const family of families.filter(family => family !== '${family}')) {`));
      await assert.rejects(exec(process.execPath, ['--test', '--test-name-pattern', `^detects ${family} `, resolve(directory, 'differ.test.mts')], { env: { ...process.env, NODE_TEST_CONTEXT: undefined } }),
        error => error instanceof Error && 'code' in error && error.code === 1 && 'stdout' in error && typeof error.stdout === 'string' && /not ok/u.test(error.stdout));
    }
    const needle = '  if (!count) return null;';
    assert.ok(source.includes(needle));
    await writeFile(resolve(directory, 'differ.mts'), source.replace(needle, '  return null;'));
    await assert.rejects(exec(process.execPath, ['--test', '--test-name-pattern', '^detects rendering screenshot', resolve(directory, 'differ.test.mts')], { env: { ...process.env, NODE_TEST_CONTEXT: undefined } }),
      error => error instanceof Error && 'code' in error && error.code === 1 && 'stdout' in error && typeof error.stdout === 'string' && /not ok/u.test(error.stdout));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
