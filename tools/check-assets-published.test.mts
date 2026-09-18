import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { addedAssetKeys, checkAssetsPublished, createHeadFetcher, lastGreenMainSha, MAX_CONNECTIONS, type HeadFetcher } from './check-assets-published.mts';
import { preparePreparedAssetManifest } from '../src/platform/runtime-asset-closure.mts';

const execFileAsync = promisify(execFile);
const ok = () => new Response(null, { status: 200, headers: { 'content-length': '12' } });
const NO_RETRIES = { missing: { delaysMs: [] }, throttled: { delaysMs: [] }, network: { delaysMs: [] } };

async function fixtureObject(root: string, id: string, sceneBytes = '12-byte-scn!', extra: readonly string[] = []) {
  const preparedDirectory = resolve(root, 'src/objects', id, 'prepared');
  await mkdir(preparedDirectory, { recursive: true });
  await writeFile(resolve(preparedDirectory, 'runtime.json'), '12-byte-run!');
  await writeFile(resolve(preparedDirectory, 'scene.json'), sceneBytes);
  for (const [index, name] of extra.entries()) await writeFile(resolve(preparedDirectory, name), `12-byte-x${String(index).padStart(2, '0')}!`);
  await preparePreparedAssetManifest({ planetId: id, preparedRoot: preparedDirectory,
    manifestPath: resolve(preparedDirectory, '..', 'prepared-assets.json'), filenames: ['runtime.json', 'scene.json', ...extra] });
}

async function fixtureRoot(extra: readonly string[] = []) {
  const root = await mkdtemp(resolve(tmpdir(), 'check-assets-published-'));
  await fixtureObject(root, 'fixture-body', '12-byte-scn!', extra);
  return root;
}

function sha(bytes: string) { return createHash('sha256').update(bytes).digest('hex'); }
function sceneKey(bytes = '12-byte-scn!') { return `runtime-assets/${sha(bytes)}/scene.json`; }
function sceneMiss(id: string, bytes = '12-byte-scn!', reason = 'HTTP 404') {
  return `${id}/scene.json (${sceneKey(bytes)}) — ${reason}`;
}
const sceneOnly = (failure: () => Response | Promise<Response>): HeadFetcher => async url => String(url).endsWith('/scene.json') ? failure() : ok();

test('reports zero misses when every key HEADs ok', async t => {
  const root = await fixtureRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = await checkAssetsPublished(['--object=fixture-body'], { root, fetcher: async () => ok() });
  assert.equal(result.checked, 2);
  assert.deepEqual(result.misses, []);
  assert.deepEqual(result.unreachable, []);
});

test('lists every miss by id/filename/key with the final HTTP status, and never uploads or deletes anything', async t => {
  const root = await fixtureRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  let calls = 0;
  const result = await checkAssetsPublished(['--object=fixture-body'], { root, retryPolicy: NO_RETRIES, fetcher: async (url, init) => {
    calls++;
    assert.equal(init.method, 'HEAD');
    return String(url).endsWith('/scene.json') ? new Response(null, { status: 404 }) : ok();
  } });
  assert.equal(calls, 2);
  assert.equal(result.checked, 2);
  assert.deepEqual(result.misses, [sceneMiss('fixture-body')]);
});

test('a network error without a cause code is reported as unreachable by its message', async t => {
  const root = await fixtureRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = await checkAssetsPublished(['--object=fixture-body'], { root, retryPolicy: NO_RETRIES,
    fetcher: sceneOnly(() => { throw new Error('fetch failed: ECONNRESET'); }) });
  assert.deepEqual(result.misses, []);
  assert.deepEqual(result.unreachable, [sceneMiss('fixture-body', '12-byte-scn!', 'network error: fetch failed: ECONNRESET')]);
});

test('a network error surfaces the socket code undici wraps in error.cause, not the bare "fetch failed"', async t => {
  const root = await fixtureRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = await checkAssetsPublished(['--object=fixture-body'], { root, retryPolicy: NO_RETRIES,
    fetcher: sceneOnly(() => { throw new TypeError('fetch failed', { cause: Object.assign(new Error('getaddrinfo EAI_AGAIN'), { code: 'EAI_AGAIN' }) }); }) });
  assert.deepEqual(result.unreachable, [sceneMiss('fixture-body', '12-byte-scn!', 'network error: EAI_AGAIN')]);
});

test('every HEAD carries a timeout signal, so a hung request fails as a timeout instead of holding a worker', async t => {
  const root = await fixtureRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = await checkAssetsPublished(['--object=fixture-body'], { root, retryPolicy: NO_RETRIES, timeoutMs: 20,
    fetcher: async (url, init) => {
      if (!String(url).endsWith('/scene.json')) return ok();
      return new Promise((_, reject) => {
        const fallback = setTimeout(() => reject(new Error('the request was never aborted')), 2000);
        init.signal.addEventListener('abort', () => { clearTimeout(fallback); reject(init.signal.reason); });
      });
    } });
  assert.deepEqual(result.unreachable, [sceneMiss('fixture-body', '12-byte-scn!', 'network error: timed out after 20 ms')]);
});

test('a content-length mismatch is reported with the expected and actual byte counts', async t => {
  const root = await fixtureRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = await checkAssetsPublished(['--object=fixture-body'], { root, retryPolicy: NO_RETRIES,
    fetcher: sceneOnly(() => new Response(null, { status: 200, headers: { 'content-length': '3' } })) });
  assert.deepEqual(result.misses, [sceneMiss('fixture-body', '12-byte-scn!', 'content-length mismatch: expected 12, got 3')]);
});

test('a persistent 404 is retried the full 2/5/10 s schedule and still fails', async t => {
  const root = await fixtureRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  let sceneAttempts = 0;
  const sleeps: number[] = [];
  const result = await checkAssetsPublished(['--object=fixture-body'], { root, sleep: async ms => { sleeps.push(ms); },
    fetcher: sceneOnly(() => { sceneAttempts++; return new Response(null, { status: 404 }); }) });
  assert.equal(sceneAttempts, 4, '1 initial check + 3 retries');
  assert.deepEqual(sleeps, [2000, 5000, 10000]);
  assert.deepEqual(result.misses, [sceneMiss('fixture-body')]);
});

// No retryPolicy override: pins the default schedule for an edge 5xx. If the default were weakened to no retries,
// both assertions would go red.
test('a transient 503 is retried on the default throttled schedule and is not reported', async t => {
  const root = await fixtureRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  let sceneAttempts = 0;
  const sleeps: number[] = [];
  const result = await checkAssetsPublished(['--object=fixture-body'], { root, sleep: async ms => { sleeps.push(ms); },
    fetcher: sceneOnly(() => ++sceneAttempts === 1 ? new Response(null, { status: 503 }) : ok()) });
  assert.equal(sceneAttempts, 2);
  assert.deepEqual(sleeps, [5000], 'a 5xx backs off 5 s before its first re-check');
  assert.deepEqual(result.misses, []);
});

test('a 429 waits for its Retry-After header instead of the schedule', async t => {
  const root = await fixtureRoot();
  t.after(() => rm(root, { recursive: true, force: true }));
  let sceneAttempts = 0;
  const sleeps: number[] = [];
  const result = await checkAssetsPublished(['--object=fixture-body'], { root, sleep: async ms => { sleeps.push(ms); },
    fetcher: sceneOnly(() => ++sceneAttempts === 1 ? new Response(null, { status: 429, headers: { 'retry-after': '7' } }) : ok()) });
  assert.deepEqual(sleeps, [7000]);
  assert.deepEqual(result.misses, []);
});

// The main-run incident: a burst of `fetch failed` that outlasted a 17 s retry budget while every key was live.
test('network errors back off about two minutes at concurrency 2 before a key is reported unreachable', async t => {
  const extra = Array.from({ length: 8 }, (_, index) => `extra-${index}.bin`);
  const root = await fixtureRoot(extra);
  t.after(() => rm(root, { recursive: true, force: true }));
  const sleeps: number[] = [];
  let round = 0, inFlight = 0, retryPeak = 0, attempts = 0;
  const result = await checkAssetsPublished(['--object=fixture-body'], { root,
    sleep: async ms => { sleeps.push(ms); round++; },
    fetcher: async url => {
      if (String(url).endsWith('/runtime.json')) return ok();
      attempts++;
      inFlight++;
      if (round > 0) retryPeak = Math.max(retryPeak, inFlight);
      await new Promise(accept => setTimeout(accept, 2));
      inFlight--;
      throw new TypeError('fetch failed', { cause: Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }) });
    } });
  assert.deepEqual(sleeps, [5000, 15000, 30000, 60000]);
  assert.equal(retryPeak, 2, 're-checks after a network error run two at a time');
  assert.equal(attempts, 9 * 5, 'each failing key: 1 check + 4 re-checks');
  assert.equal(result.unreachable.length, 9);
  assert.deepEqual(result.misses, []);
});

async function listen(server: Server): Promise<string> {
  await new Promise<void>(accept => server.listen(0, '127.0.0.1', accept));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

// undici closes the socket after every HEAD (it guards against servers that send a HEAD body), so connections are
// not reused; the cap is what bounds connection and DNS churn. With pipelining 1, requests the server is handling at
// once equal open connections.
test('the shared agent never runs more than 8 connections at once, however many HEADs are in flight', async t => {
  let active = 0, peak = 0;
  const server = createServer((_, response) => {
    peak = Math.max(peak, ++active);
    setTimeout(() => { active--; response.writeHead(200, { 'content-length': '12' }).end(); }, 30);
  });
  const origin = await listen(server);
  const { fetcher, close } = createHeadFetcher();
  t.after(async () => { await close(); await new Promise(accept => server.close(accept)); });
  const responses = await Promise.all(Array.from({ length: 40 }, (_, index) =>
    fetcher(`${origin}/key-${index}`, { method: 'HEAD', signal: AbortSignal.timeout(5000) })));
  assert.ok(responses.every(response => response.status === 200));
  assert.equal(MAX_CONNECTIONS, 8);
  assert.equal(peak, 8, 'eight requests in parallel, never more');
});

test('without an injected fetcher the gate uses the shared agent against a real server and closes it', async t => {
  const root = await fixtureRoot();
  const seen: string[] = [];
  const server = createServer((request, response) => { seen.push(`${request.method} ${request.url}`); response.writeHead(200, { 'content-length': '12' }).end(); });
  const origin = await listen(server);
  t.after(async () => { await new Promise(accept => server.close(accept)); await rm(root, { recursive: true, force: true }); });
  const result = await checkAssetsPublished(['--object=fixture-body'], { root, origin });
  assert.deepEqual(result.misses, []);
  assert.deepEqual(seen.sort(), [`HEAD /runtime-assets/${sha('12-byte-run!')}/runtime.json`, `HEAD /${sceneKey()}`].sort());
});

async function gitFixture(): Promise<string> {
  const root = await mkdtemp(resolve(tmpdir(), 'check-assets-published-added-'));
  const run = (...args: string[]) => execFileAsync('git', args, { cwd: root });
  await run('init', '-q', '-b', 'main');
  await run('config', 'user.email', 'fixture@example.com');
  await run('config', 'user.name', 'Fixture');
  await run('config', 'core.hooksPath', '/dev/null');
  await writeFile(resolve(root, '.gitignore'), 'prepared/\n');
  await fixtureObject(root, 'edited-body', '12-byte-old!');
  await fixtureObject(root, 'same-body', '12-byte-sam!');
  await fixtureObject(root, 'moved-body', '12-byte-mov!');
  await run('add', '-A');
  await run('commit', '-q', '-m', 'base');
  await run('branch', 'base');
  await fixtureObject(root, 'edited-body', '12-byte-new!');
  await fixtureObject(root, 'new-body', '12-byte-nob!');
  // Same bytes under a new id: git sees a rename of the inventory, and every key already existed at the base.
  await rm(resolve(root, 'src/objects/moved-body'), { recursive: true, force: true });
  await fixtureObject(root, 'renamed-body', '12-byte-mov!');
  await run('add', '-A');
  await run('commit', '-q', '-m', 'head');
  return root;
}

test('addedAssetKeys returns only keys HEAD inventories add versus the merge base', async t => {
  const root = await gitFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const scope = await addedAssetKeys('base', { root });
  assert.equal(scope.all, false);
  if (scope.all) return;
  // edited-body: only its changed scene. new-body: only its scene, because its runtime.json bytes (and so its
  // content-addressed key) already existed at the base. same-body is untouched, and the renamed inventory's keys
  // existed at the base under its old path, so the rename adds nothing.
  assert.deepEqual([...scope.keys].sort(), [sceneKey('12-byte-new!'), sceneKey('12-byte-nob!')].sort());
  assert.deepEqual([...scope.objectIds].sort(), ['edited-body', 'new-body', 'renamed-body']);
});

test('the gate HEADs only the added keys when given addedSince', async t => {
  const root = await gitFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const requested: string[] = [];
  const result = await checkAssetsPublished([], { root, addedSince: 'base', fetcher: async url => { requested.push(String(url)); return ok(); } });
  assert.equal(result.checked, 2);
  assert.equal(result.inventoried, 8);
  assert.equal(requested.length, 2);
  assert.ok(requested.some(url => url.endsWith(sceneKey('12-byte-new!'))));
  assert.ok(!requested.some(url => url.endsWith(sceneKey('12-byte-sam!'))), 'an unchanged inventory is not re-checked');
});

test('a scoped gate still fails when an added key is missing', async t => {
  const root = await gitFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = await checkAssetsPublished([], { root, addedSince: 'base', retryPolicy: NO_RETRIES,
    fetcher: async url => String(url).endsWith(sceneKey('12-byte-nob!')) ? new Response(null, { status: 404 }) : ok() });
  assert.deepEqual(result.misses, [sceneMiss('new-body', '12-byte-nob!')]);
});

test('addedAssetKeys checks everything when key-construction code changed or there is no merge base', async () => {
  const widened = await addedAssetKeys('origin/main', { mergeBase: async () => 'b'.repeat(40),
    changedPaths: async () => ['tools/runtime-assets.mts', 'src/objects/hebe/prepared-assets.json'], inventoryAt: async () => null });
  assert.deepEqual(widened, { all: true, reason: 'tools/runtime-assets.mts changed' });
  const closure = await addedAssetKeys('origin/main', { mergeBase: async () => 'b'.repeat(40),
    changedPaths: async () => ['src/platform/runtime-asset-closure.mts'], inventoryAt: async () => null });
  assert.equal(closure.all, true);
  const unrelated = await addedAssetKeys('origin/main', { mergeBase: async () => { throw new Error('no merge base'); } });
  assert.equal(unrelated.all, true);
});

test('a scope-widening change makes the gate check every inventoried key', async t => {
  const root = await gitFixture();
  t.after(() => rm(root, { recursive: true, force: true }));
  const result = await checkAssetsPublished([], { root, addedSince: 'base', fetcher: async () => ok(),
    findAddedKeys: async () => ({ all: true, reason: 'tools/runtime-assets.mts changed' }) });
  assert.equal(result.checked, 8);
});

test('addedAssetKeys refuses to silently drop an inventory path with an id outside [a-z][a-z0-9-]*', async () => {
  await assert.rejects(addedAssetKeys('origin/main', { mergeBase: async () => 'b'.repeat(40),
    changedPaths: async () => ['src/objects/Bad_Id/prepared-assets.json'], inventoryAt: async () => null }), /Unexpected object id/);
});

test('lastGreenMainSha asks for the latest successful push run on main and validates the answer', async () => {
  const green = 'a'.repeat(40);
  let asked: readonly string[] = [];
  assert.equal(await lastGreenMainSha({ repository: 'owner/repo', run: async args => { asked = args; return `${green}\n`; } }), green);
  for (const filter of ['branch=main', 'event=push', 'status=success', 'per_page=1']) assert.ok(asked.includes(filter), filter);
  assert.ok(asked.includes('repos/owner/repo/actions/workflows/universe.yml/runs'));
  assert.equal(await lastGreenMainSha({ run: async () => '\n' }), null);
  await assert.rejects(lastGreenMainSha({ run: async () => 'not-a-sha' }), /Unexpected head SHA/);
});
