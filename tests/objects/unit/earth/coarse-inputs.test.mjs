import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { acquireCoarseInputs } from '../../../../tools/objects/geographic-pages/operations/coarse-inputs.mjs';
import { COARSE_PREPARATION_LIMITS } from '../../../../tools/objects/geographic-pages/operations/coarse-plan.mjs';

async function fixture(t, count = 4) {
  const path = await mkdtemp(join(tmpdir(), 'earth-coarse-inputs-'));
  t.after(() => rm(path, { recursive: true, force: true }));
  const directory = pathToFileURL(path + '/');
  const bytes = await sharp({ create: { width: 256, height: 256, channels: 4, background: { r: 28, g: 61, b: 80, alpha: 1 } } }).png().toBuffer();
  // These synthetic PNG fixtures occupy kilobytes, independent of the global
  // acquisition's 10 GiB reserve. Exercise that guard explicitly below.
  const plan = { version: 'fixture', limits: {...COARSE_PREPARATION_LIMITS,minimumFreeBytes:1024**2},
    source: Array.from({ length: count }, (_, x) => ({ key: `4-${x}-1`, zoom: 4, x, y: 1, url: `https://example.invalid/04/${x}/1.png` })) };
  const response = () => new Response(bytes, { headers: { 'content-type': 'image/png' } });
  return { directory, plan, bytes, response };
}

test('concurrent equal images publish once by hash and a fully verified offline resume makes no requests', async t => {
  const f = await fixture(t, 12), calls = [];
  const first = await acquireCoarseInputs({ ...f, fetchImpl: async url => { calls.push(url); return f.response(); } });
  assert.equal(calls.length, 12); assert.equal(first.stats.acquired, 12);
  assert.equal(new Set(Object.values(first.manifest.inputs).map(pin => pin.path)).size, 1);
  const second = await acquireCoarseInputs({ ...f, offline: true, fetchImpl: () => { throw new Error('Unexpected request'); } });
  assert.equal(second.stats.acquired, 0); assert.equal(second.stats.verified, 12);
  assert.deepEqual(second.manifest, first.manifest);
});

test('an interrupted acquisition preserves completed receipts and requests only missing sources', async t => {
  const f = await fixture(t, 3), calls = [];
  await assert.rejects(acquireCoarseInputs({ ...f, concurrency: 1, fetchImpl: async url => {
    calls.push(url); return calls.length === 3 ? new Response('missing', { status: 404 }) : f.response();
  } }), /Coarse source/);
  calls.length = 0;
  const result = await acquireCoarseInputs({ ...f, concurrency: 1, fetchImpl: async url => { calls.push(url); return f.response(); } });
  assert.deepEqual(calls, [f.plan.source[2].url]); assert.equal(result.stats.verified, 3);
});

test('a supplied seed is hash verified and hardlinked without another provider transfer', async t => {
  const first = await fixture(t, 1), second = await fixture(t, 1);
  const original = await acquireCoarseInputs({ ...first, fetchImpl: async () => first.response() });
  const reused = await acquireCoarseInputs({ ...second, offline: true,
    seedManifests: [new URL('inputs-manifest.json', first.directory)], fetchImpl: () => { throw new Error('Unexpected request'); } });
  assert.equal(reused.stats.reused, 1); assert.equal(reused.stats.receivedBytes, 0);
  const pin = Object.values(original.manifest.inputs)[0];
  assert.equal((await stat(new URL(pin.path, first.directory))).ino, (await stat(new URL(pin.path, second.directory))).ino);
});

test('corrupt cached bytes fail instead of being silently fetched again', async t => {
  const f = await fixture(t, 1), result = await acquireCoarseInputs({ ...f, fetchImpl: async () => f.response() });
  const pin = Object.values(result.manifest.inputs)[0];
  await writeFile(new URL(pin.path, f.directory), Buffer.alloc(pin.bytes));
  await assert.rejects(acquireCoarseInputs({ ...f, fetchImpl: () => { throw new Error('Unexpected request'); } }), /Expected values/);
});

test('oversized responses stop before publishing a source receipt', async t => {
  const f = await fixture(t, 1);
  f.plan.limits = { ...f.plan.limits, imageBytes: 8 };
  await assert.rejects(acquireCoarseInputs({ ...f, fetchImpl: async () => f.response() }), /transfer limit/);
  await assert.rejects(readFile(new URL(`inputs/${f.plan.source[0].key}.json`, f.directory)), { code: 'ENOENT' });
});

test('insufficient disk reserve rejects acquisition before any provider request',async t=>{
  const f=await fixture(t,1);let requests=0;
  f.plan.limits.minimumFreeBytes=Number.MAX_SAFE_INTEGER;
  await assert.rejects(acquireCoarseInputs({...f,fetchImpl:()=>{requests++;throw new Error('Unexpected request');}}),/free-space reserve/);
  assert.equal(requests,0);
  await assert.rejects(readFile(new URL('inputs-manifest.json',f.directory)),{code:'ENOENT'});
});
