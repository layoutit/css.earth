import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { changedObjectIds, checkAssetsPublished } from './check-assets-published.mts';
import { preparePreparedAssetManifest } from '../src/platform/runtime-asset-closure.mts';

const execFileAsync = promisify(execFile);

// a..n: 14 object ids, matching the object-scope gate's default limit exactly, so an undercount at the boundary
// would silently pass instead of failing.
const FOURTEEN_IDS = 'abcdefghijklmn'.split('');

/** A real, throwaway git repository (git's actual rename detection is the thing under test — an injected
 * changedPaths fixture cannot reproduce it) with one committed file per id under `src/objects/<id>/file.txt`. */
async function fixtureGitRepoWithFourteenObjects(): Promise<string> {
  const root = await mkdtemp(resolve(tmpdir(), 'check-assets-published-rename-'));
  await execFileAsync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  await execFileAsync('git', ['config', 'user.email', 'fixture@example.com'], { cwd: root });
  await execFileAsync('git', ['config', 'user.name', 'Fixture'], { cwd: root });
  for (const id of FOURTEEN_IDS) {
    await mkdir(resolve(root, 'src/objects', id), { recursive: true });
    await writeFile(resolve(root, 'src/objects', id, 'file.txt'), `content for ${id}\n`.repeat(20));
  }
  await execFileAsync('git', ['add', '-A'], { cwd: root });
  await execFileAsync('git', ['commit', '-q', '-m', 'base: 14 objects'], { cwd: root });
  return root;
}

async function commitAll(root: string, message: string): Promise<void> {
  await execFileAsync('git', ['add', '-A'], { cwd: root });
  await execFileAsync('git', ['commit', '-q', '-m', message], { cwd: root });
}

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
function sceneMiss(id: string, bytes = '12-byte-scn!', reason = 'HTTP 404') {
  return `${id}/scene.json (runtime-assets/${sceneShaFor(bytes)}/scene.json) — ${reason}`;
}

test('reports zero misses when every key HEADs ok', async t => {
  const root = await fixtureRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = await checkAssetsPublished(['--object=fixture-body'], { root, fetcher: async () => new Response(null, { status: 200, headers: { 'content-length': '12' } }) });
  assert.equal(result.checked, 2);
  assert.deepEqual(result.misses, []);
});

test('lists every miss by id/filename/key with the final HTTP status, and never uploads or deletes anything', async t => {
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

test('a persistent network error is reported by its error message, not a bare miss', async t => {
  const root = await fixtureRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = await checkAssetsPublished(['--object=fixture-body'], { root, retryDelaysMs: [],
    fetcher: async url => {
      if (String(url).endsWith('/scene.json')) throw new Error('fetch failed: ECONNRESET');
      return new Response(null, { status: 200, headers: { 'content-length': '12' } });
    } });
  assert.deepEqual(result.misses, [sceneMiss('fixture-body', '12-byte-scn!', 'network error: fetch failed: ECONNRESET')]);
});

test('a content-length mismatch is reported with the expected and actual byte counts', async t => {
  const root = await fixtureRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = await checkAssetsPublished(['--object=fixture-body'], { root, retryDelaysMs: [],
    fetcher: async url => {
      if (String(url).endsWith('/scene.json')) return new Response(null, { status: 200, headers: { 'content-length': '3' } });
      return new Response(null, { status: 200, headers: { 'content-length': '12' } });
    } });
  assert.deepEqual(result.misses, [sceneMiss('fixture-body', '12-byte-scn!', 'content-length mismatch: expected 12, got 3')]);
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

// Pins the DEFAULT_RETRY_DELAYS_MS schedule actually used when a caller passes no retryDelaysMs at all (unlike
// every test above, which overrides it). If the default were ever weakened to `[]`, this transient failure would
// never get a retry: both assertions below would go red (no backoff recorded, and the miss would still be
// reported), instead of silently exercising a schedule the test itself supplied.
test('the default retry schedule (no override) retries a transient miss', async t => {
  const root = await fixtureRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  let sceneAttempts = 0;
  const sleeps: number[] = [];
  const result = await checkAssetsPublished(['--object=fixture-body'], { root, sleep: async ms => { sleeps.push(ms); },
    fetcher: async url => {
      if (String(url).endsWith('/scene.json')) {
        sceneAttempts++;
        if (sceneAttempts === 1) return new Response(null, { status: 503 });
        return new Response(null, { status: 200, headers: { 'content-length': '12' } });
      }
      return new Response(null, { status: 200, headers: { 'content-length': '12' } });
    } });
  assert.deepEqual(sleeps, [2000], 'the documented default schedule starts with a 2s backoff');
  assert.deepEqual(result.misses, []);
});

test('changedObjectIds extracts ids from paths under src/objects/<id>/, including inventory files', async () => {
  const scope = await changedObjectIds('origin/main', { changedPaths: async ref => {
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
  assert.equal(scope.allObjectsTouched, false);
  assert.deepEqual([...scope.ids].sort(), ['hebe', 'iris']);
});

test('changedObjectIds treats a change to key-construction or manifest/closure code as touching every object', async () => {
  const scope = await changedObjectIds('origin/main', { changedPaths: async () => [
    'tools/runtime-assets.mts',
    'src/objects/hebe/prepared-assets.json',
  ] });
  assert.equal(scope.allObjectsTouched, true);
});

test('changedObjectIds refuses to silently drop an object-shaped path with an id outside [a-z][a-z0-9-]*', async () => {
  await assert.rejects(changedObjectIds('origin/main', { changedPaths: async () => ['src/objects/Bad_Id/prepared/runtime.json'] }),
    /Unexpected object id/);
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
    findChangedObjectIds: async ref => { assert.equal(ref, 'origin/main'); return { allObjectsTouched: false, ids: new Set(['changed-body']) }; },
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
    findChangedObjectIds: async ref => { assert.equal(ref, 'origin/main'); return { allObjectsTouched: false, ids: new Set(['changed-body']) }; },
    changedSince: 'origin/main',
    fetcher: async url => {
      if (String(url).includes(`${untouchedSceneKey}/scene.json`)) return new Response(null, { status: 404 });
      return new Response(null, { status: 200, headers: { 'content-length': '12' } });
    } });
  assert.deepEqual(result.misses, []);
  assert.deepEqual(result.warnings, [sceneMiss('untouched-body', UNTOUCHED_SCENE_BYTES)]);
});

test('with --changed-since, a tooling-scope change makes every miss fail instead of warn', async t => {
  const root = await twoObjectFixtureRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const untouchedSceneKey = sceneShaFor(UNTOUCHED_SCENE_BYTES);
  const result = await checkAssetsPublished([], { root, retryDelaysMs: [],
    findChangedObjectIds: async ref => { assert.equal(ref, 'origin/main'); return { allObjectsTouched: true, ids: new Set() }; },
    changedSince: 'origin/main',
    fetcher: async url => {
      if (String(url).includes(`${untouchedSceneKey}/scene.json`)) return new Response(null, { status: 404 });
      return new Response(null, { status: 200, headers: { 'content-length': '12' } });
    } });
  assert.deepEqual(result.misses, [sceneMiss('untouched-body', UNTOUCHED_SCENE_BYTES)]);
  assert.deepEqual(result.warnings, []);
});

test('changedObjectIds counts all 14 objects when a PR moves their files entirely out of src/objects/ (git rename detection)', async t => {
  const root = await fixtureGitRepoWithFourteenObjects();
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, 'archive'), { recursive: true });
  for (const id of FOURTEEN_IDS) await rename(resolve(root, 'src/objects', id, 'file.txt'), resolve(root, 'archive', `${id}.txt`));
  await commitAll(root, 'move every object file out of src/objects');
  const scope = await changedObjectIds('HEAD~1', { root });
  assert.equal(scope.allObjectsTouched, false);
  assert.deepEqual([...scope.ids].sort(), FOURTEEN_IDS);
});

test('changedObjectIds counts all 14 objects when a PR moves files from 14 objects into one (git rename detection)', async t => {
  const root = await fixtureGitRepoWithFourteenObjects();
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(resolve(root, 'src/objects/a/incoming'), { recursive: true });
  for (const id of FOURTEEN_IDS) await rename(resolve(root, 'src/objects', id, 'file.txt'), resolve(root, 'src/objects/a/incoming', `${id}.txt`));
  await commitAll(root, 'consolidate every object file into a');
  const scope = await changedObjectIds('HEAD~1', { root });
  assert.equal(scope.allObjectsTouched, false);
  assert.deepEqual([...scope.ids].sort(), FOURTEEN_IDS);
});

test('changedObjectIds counts all 14 objects when a PR deletes them (baseline, no rename involved)', async t => {
  const root = await fixtureGitRepoWithFourteenObjects();
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const id of FOURTEEN_IDS) await rm(resolve(root, 'src/objects', id), { recursive: true, force: true });
  await commitAll(root, 'delete every object');
  const scope = await changedObjectIds('HEAD~1', { root });
  assert.equal(scope.allObjectsTouched, false);
  assert.deepEqual([...scope.ids].sort(), FOURTEEN_IDS);
});
