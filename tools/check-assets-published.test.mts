import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { changedObjectIds, checkAssetsPublished } from './check-assets-published.mts';
import { preparePreparedAssetManifest } from '../src/platform/runtime-asset-closure.mts';

async function fixtureObject(root: string, id: string, sceneBytes = '12-byte-scn!') {
  const preparedDirectory = resolve(root, 'src/objects', id, 'prepared');
  await mkdir(preparedDirectory, { recursive: true });
  await writeFile(resolve(preparedDirectory, 'runtime.json'), '12-byte-run!');
  await writeFile(resolve(preparedDirectory, 'scene.json'), sceneBytes);
  await preparePreparedAssetManifest({ planetId: id, preparedRoot: preparedDirectory,
    manifestPath: resolve(preparedDirectory, '..', 'prepared-assets.json'), filenames: ['runtime.json', 'scene.json'] });
}

async function fixtureRoot() {
  const root = await mkdtemp(resolve(tmpdir(), 'check-assets-published-'));
  await fixtureObject(root, 'fixture-body');
  return root;
}

const CHANGED_SCENE_BYTES = '12-byte-chg!';
const UNTOUCHED_SCENE_BYTES = '12-byte-unt!';

async function twoObjectFixtureRoot() {
  const root = await mkdtemp(resolve(tmpdir(), 'check-assets-published-scope-'));
  await fixtureObject(root, 'changed-body', CHANGED_SCENE_BYTES);
  await fixtureObject(root, 'untouched-body', UNTOUCHED_SCENE_BYTES);
  return root;
}

function sceneShaFor(bytes: string) { return createHash('sha256').update(bytes).digest('hex'); }
function sceneMiss(id: string, bytes = '12-byte-scn!') { return `${id}/scene.json (runtime-assets/${sceneShaFor(bytes)}/scene.json)`; }

test('reports zero misses when every key HEADs ok', async t => {
  const root = await fixtureRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = await checkAssetsPublished(['--object=fixture-body'], { root, fetcher: async () => new Response(null, { status: 200, headers: { 'content-length': '12' } }) });
  assert.equal(result.checked, 2);
  assert.deepEqual(result.misses, []);
});

test('lists every miss by id/filename and key, and never uploads or deletes anything', async t => {
  const root = await fixtureRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  let calls = 0;
  const result = await checkAssetsPublished(['--object=fixture-body'], { root, retryDelaysMs: [], fetcher: async (url, init) => {
    calls++;
    assert.equal(init?.method, 'HEAD');
    if (String(url).endsWith('/scene.json')) return new Response(null, { status: 404 });
    return new Response(null, { status: 200, headers: { 'content-length': '12' } });
  } });
  assert.equal(calls, 2);
  assert.equal(result.checked, 2);
  assert.deepEqual(result.misses, [sceneMiss('fixture-body')]);
});

test('a transient failure that HEADs ok on a retry is not reported as a miss', async t => {
  const root = await fixtureRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  let sceneAttempts = 0;
  const sleeps: number[] = [];
  const result = await checkAssetsPublished(['--object=fixture-body'], { root,
    retryDelaysMs: [2000, 5000, 10000], sleep: async ms => { sleeps.push(ms); },
    fetcher: async url => {
      if (String(url).endsWith('/scene.json')) {
        sceneAttempts++;
        // First attempt looks like a transient edge/network failure (a 503); the second attempt succeeds.
        if (sceneAttempts === 1) return new Response(null, { status: 503 });
        return new Response(null, { status: 200, headers: { 'content-length': '12' } });
      }
      return new Response(null, { status: 200, headers: { 'content-length': '12' } });
    } });
  assert.equal(sceneAttempts, 2, 'the miss must be re-checked, not just checked once');
  assert.deepEqual(result.misses, []);
  assert.deepEqual(sleeps, [2000], 'only one retry round was needed, so only its backoff should have run');
});

test('a persistent 404 is retried the full backoff schedule and still fails', async t => {
  const root = await fixtureRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  let sceneAttempts = 0;
  const sleeps: number[] = [];
  const result = await checkAssetsPublished(['--object=fixture-body'], { root,
    retryDelaysMs: [2000, 5000, 10000], sleep: async ms => { sleeps.push(ms); },
    fetcher: async url => {
      if (String(url).endsWith('/scene.json')) { sceneAttempts++; return new Response(null, { status: 404 }); }
      return new Response(null, { status: 200, headers: { 'content-length': '12' } });
    } });
  assert.equal(sceneAttempts, 4, '1 initial check + 3 retries');
  assert.deepEqual(sleeps, [2000, 5000, 10000]);
  assert.deepEqual(result.misses, [sceneMiss('fixture-body')]);
});

test('changedObjectIds extracts ids from paths under src/objects/<id>/, including inventory files', async () => {
  const ids = await changedObjectIds('origin/main', { changedPaths: async ref => {
    assert.equal(ref, 'origin/main');
    return [
      'src/objects/hebe/prepared-assets.json',
      'src/objects/hebe/prepared/runtime.json',
      'src/objects/iris/runtime-assets.json',
      'README.md',
      'src/objects/README.md', // no trailing object id, must not match
      'site/objects.mts',
    ];
  } });
  assert.deepEqual([...ids].sort(), ['hebe', 'iris']);
});

test('without --changed-since, a miss anywhere fails (strict, unchanged default)', async t => {
  const root = await twoObjectFixtureRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const untouchedSceneKey = sceneShaFor(UNTOUCHED_SCENE_BYTES);
  const result = await checkAssetsPublished([], { root, retryDelaysMs: [], fetcher: async url => {
    if (String(url).includes(`${untouchedSceneKey}/scene.json`)) return new Response(null, { status: 404 });
    return new Response(null, { status: 200, headers: { 'content-length': '12' } });
  } });
  assert.deepEqual(result.misses, [sceneMiss('untouched-body', UNTOUCHED_SCENE_BYTES)]);
  assert.deepEqual(result.warnings, []);
});

test('with --changed-since, a miss in a changed object still fails the gate', async t => {
  const root = await twoObjectFixtureRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const changedSceneKey = sceneShaFor(CHANGED_SCENE_BYTES);
  const result = await checkAssetsPublished([], { root, retryDelaysMs: [],
    findChangedObjectIds: async ref => { assert.equal(ref, 'origin/main'); return new Set(['changed-body']); },
    changedSince: 'origin/main',
    fetcher: async url => {
      if (String(url).includes(`${changedSceneKey}/scene.json`)) return new Response(null, { status: 404 });
      return new Response(null, { status: 200, headers: { 'content-length': '12' } });
    } });
  assert.deepEqual(result.misses, [sceneMiss('changed-body', CHANGED_SCENE_BYTES)]);
  assert.deepEqual(result.warnings, []);
});

test('with --changed-since, a miss in an untouched object only warns and passes', async t => {
  const root = await twoObjectFixtureRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const untouchedSceneKey = sceneShaFor(UNTOUCHED_SCENE_BYTES);
  const result = await checkAssetsPublished([], { root, retryDelaysMs: [],
    findChangedObjectIds: async ref => { assert.equal(ref, 'origin/main'); return new Set(['changed-body']); },
    changedSince: 'origin/main',
    fetcher: async url => {
      if (String(url).includes(`${untouchedSceneKey}/scene.json`)) return new Response(null, { status: 404 });
      return new Response(null, { status: 200, headers: { 'content-length': '12' } });
    } });
  assert.deepEqual(result.misses, []);
  assert.deepEqual(result.warnings, [sceneMiss('untouched-body', UNTOUCHED_SCENE_BYTES)]);
});
