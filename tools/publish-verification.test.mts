import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { verifyPublished, reportVerification, type PublishAsset } from './publish-verification.mts';

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const asset = (key: string, bytes: Buffer): PublishAsset => ({ key, file: `/fixtures/${key}`, bytes: bytes.length, sha256: sha256(bytes) });

test('a fully live batch is verified with no uploads and no sample failures', async () => {
  const bytesFor = new Map([['a.json', Buffer.from('{"ok":1}')], ['b.webp', Buffer.from('image bytes')]]);
  const assets = [...bytesFor.entries()].map(([key, bytes]) => asset(key, bytes));
  let uploads = 0;
  const fetcher = async (url: string, init?: RequestInit) => {
    const key = url.slice('https://origin.test/'.length);
    const bytes = bytesFor.get(key);
    if (!bytes) return new Response(null, { status: 404 });
    if (init?.method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-length': String(bytes.length) } });
    return new Response(bytes, { status: 200 });
  };
  const result = await verifyPublished(assets, { origin: 'https://origin.test', fetcher: fetcher as typeof fetch, uploadOne: async () => { uploads++; } });
  assert.deepEqual(result, { retried: [], misses: [], sampleFailures: [] });
  assert.equal(uploads, 0);
  assert.doesNotThrow(() => reportVerification(result));
});

test('a bulk-put miss is retried once and then verified live', async () => {
  const bytes = Buffer.from('{"ok":1}');
  const assets = [asset('a.json', bytes)];
  const live = new Set<string>();
  let uploadCalls = 0;
  const fetcher = async (url: string, init?: RequestInit) => {
    const key = url.slice('https://origin.test/'.length);
    if (!live.has(key)) return new Response(null, { status: 404 });
    if (init?.method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-length': String(bytes.length) } });
    return new Response(bytes, { status: 200 });
  };
  const uploadOne = async (asset: PublishAsset) => { uploadCalls++; live.add(asset.key); };
  const result = await verifyPublished(assets, { origin: 'https://origin.test', fetcher: fetcher as typeof fetch, uploadOne });
  assert.deepEqual(result.retried, ['a.json']);
  assert.deepEqual(result.misses, []);
  assert.deepEqual(result.sampleFailures, []);
  assert.equal(uploadCalls, 1);
});

test('a key still missing after the retry, and a JSON key with drifted bytes, both fail verification', async () => {
  const goodBytes = Buffer.from('{"ok":1}'), driftedPin = Buffer.from('{"ok":1}');
  const assets = [asset('missing.json', goodBytes), { ...asset('drifted.json', driftedPin), sha256: 'f'.repeat(64) }];
  const fetcher = async (url: string, init?: RequestInit) => {
    const key = url.slice('https://origin.test/'.length);
    if (key === 'missing.json') return new Response(null, { status: 404 });
    // drifted.json: HEAD reports the right length, but the actual bytes hash to something else.
    if (init?.method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-length': String(driftedPin.length) } });
    return new Response(driftedPin, { status: 200 });
  };
  const result = await verifyPublished(assets, { origin: 'https://origin.test', fetcher: fetcher as typeof fetch, uploadOne: async () => {} });
  assert.deepEqual(result.retried, ['missing.json']);
  assert.deepEqual(result.misses, ['missing.json'], 'still missing after the retry attempt');
  // Every JSON key is always byte-verified (not just HEAD-checked): missing.json fails that check too (redundant
  // with `misses`, but correct), and drifted.json — which HEADs fine but serves the wrong bytes — is only caught here.
  assert.ok(result.sampleFailures.includes('drifted.json'), 'a JSON key with the right length but wrong bytes must be caught');
  assert.throws(() => reportVerification(result), /missing\.json/);
  assert.throws(() => reportVerification(result), /drifted\.json/);
});

test('non-JSON assets beyond the sample size are HEAD-checked only, not byte-verified', async () => {
  const bytesFor = new Map(Array.from({ length: 5 }, (_, i) => [`asset-${i}.webp`, Buffer.from(`payload ${i}`)] as const));
  const assets = [...bytesFor.entries()].map(([key, bytes]) => asset(key, bytes));
  const getCalls: string[] = [];
  const fetcher = async (url: string, init?: RequestInit) => {
    const key = url.slice('https://origin.test/'.length);
    const bytes = bytesFor.get(key)!;
    if (init?.method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-length': String(bytes.length) } });
    getCalls.push(key);
    return new Response(bytes, { status: 200 });
  };
  const result = await verifyPublished(assets, { origin: 'https://origin.test', fetcher: fetcher as typeof fetch, uploadOne: async () => {}, sampleSize: 2 });
  assert.deepEqual(result, { retried: [], misses: [], sampleFailures: [] });
  assert.equal(getCalls.length, 2, 'only the sampled non-JSON assets should be downloaded for a byte check');
});

test('a sampled non-JSON asset with the right length but wrong bytes is caught', async () => {
  const bytes = Buffer.from('the real published bytes'), wrong = Buffer.from(bytes); wrong[0] = wrong[0]! ^ 0xff;
  const assets = [asset('asset.webp', bytes)];
  const fetcher = async (url: string, init?: RequestInit) => {
    if (init?.method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-length': String(bytes.length) } });
    return new Response(wrong, { status: 200 }); // same length as the pin; only the sha256 comparison can catch this.
  };
  const result = await verifyPublished(assets, { origin: 'https://origin.test', fetcher: fetcher as typeof fetch, uploadOne: async () => {}, sampleSize: 10 });
  assert.deepEqual(result.sampleFailures, ['asset.webp']);
});

test('a JSON key with drifted bytes is caught even with sampleSize: 0 (JSON is always fully verified, never sampled)', async () => {
  const bytes = Buffer.from('{"ok":1}'), wrong = Buffer.from(bytes); wrong[Math.floor(wrong.length / 2)] = wrong[Math.floor(wrong.length / 2)]! ^ 0xff;
  const assets = [asset('a.json', bytes)];
  const fetcher = async (url: string, init?: RequestInit) => {
    if (init?.method === 'HEAD') return new Response(null, { status: 200, headers: { 'content-length': String(bytes.length) } });
    return new Response(wrong, { status: 200 }); // same length as the pin; only the sha256 comparison can catch this.
  };
  const result = await verifyPublished(assets, { origin: 'https://origin.test', fetcher: fetcher as typeof fetch, uploadOne: async () => {}, sampleSize: 0 });
  assert.deepEqual(result.sampleFailures, ['a.json'], 'sampleSize must only govern non-JSON assets; every JSON key is always fully byte-verified');
});
