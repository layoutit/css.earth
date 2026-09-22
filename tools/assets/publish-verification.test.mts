import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { verifyPublished, reportVerification, type PublishAsset } from './publish-verification.mts';

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const asset = (key: string, bytes: Buffer): PublishAsset => ({ key, file: `/fixtures/${key}`, bytes: bytes.length, sha256: sha256(bytes) });
const headers = (key: string, bytes?: number) => ({
  'content-type': key.endsWith('.json') ? 'application/json' : 'application/octet-stream',
  ...(bytes === undefined ? {} : { 'content-length': String(bytes) }),
});

test('a fully live batch is verified with no uploads and no sample failures', async () => {
  const bytesFor = new Map([['a.json', Buffer.from('{"ok":1}')], ['b.webp', Buffer.from('image bytes')]]);
  const assets = [...bytesFor.entries()].map(([key, bytes]) => asset(key, bytes));
  let uploads = 0;
  const fetcher = async (url: string, init?: RequestInit) => {
    const key = url.slice('https://origin.test/'.length);
    const bytes = bytesFor.get(key);
    if (!bytes) return new Response(null, { status: 404 });
    if (init?.method === 'HEAD') return new Response(null, { status: 200, headers: headers(key, bytes.length) });
    return new Response(bytes, { status: 200, headers: headers(key) });
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
    if (init?.method === 'HEAD') return new Response(null, { status: 200, headers: headers(key, bytes.length) });
    return new Response(bytes, { status: 200, headers: headers(key) });
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
    if (init?.method === 'HEAD') return new Response(null, { status: 200, headers: headers(key, driftedPin.length) });
    return new Response(driftedPin, { status: 200, headers: headers(key) });
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
  const bytesFor: ReadonlyMap<string, Buffer<ArrayBuffer>> = new Map(Array.from({ length: 5 }, (_, i) => [`asset-${i}.webp`, Buffer.from(`payload ${i}`)] as const));
  const assets = [...bytesFor.entries()].map(([key, bytes]) => asset(key, bytes));
  const getCalls: string[] = [];
  const fetcher = async (url: string, init?: RequestInit) => {
    const key = url.slice('https://origin.test/'.length);
    const bytes = bytesFor.get(key)!;
    if (init?.method === 'HEAD') return new Response(null, { status: 200, headers: headers(key, bytes.length) });
    getCalls.push(key);
    return new Response(bytes, { status: 200, headers: headers(key) });
  };
  const result = await verifyPublished(assets, { origin: 'https://origin.test', fetcher: fetcher as typeof fetch, uploadOne: async () => {}, sampleSize: 2 });
  assert.deepEqual(result, { retried: [], misses: [], sampleFailures: [] });
  assert.equal(getCalls.length, 2, 'only the sampled non-JSON assets should be downloaded for a byte check');
});

test('a sampled non-JSON asset with the right length but wrong bytes is caught', async () => {
  const bytes = Buffer.from('the real published bytes'), wrong = Buffer.from(bytes); wrong[0] = wrong[0]! ^ 0xff;
  const assets = [asset('asset.webp', bytes)];
  const fetcher = async (_url: string, init?: RequestInit) => {
    if (init?.method === 'HEAD') return new Response(null, { status: 200, headers: headers('asset.webp', bytes.length) });
    return new Response(wrong, { status: 200, headers: headers('asset.webp') }); // same length as the pin; only the sha256 comparison can catch this.
  };
  const result = await verifyPublished(assets, { origin: 'https://origin.test', fetcher: fetcher as typeof fetch, uploadOne: async () => {}, sampleSize: 10 });
  assert.deepEqual(result.sampleFailures, ['asset.webp']);
});

test('a live HEAD response with no content-length (e.g. a compressed JSON response) still counts as published', async () => {
  // Observed live: once JSON publishes as application/json, Cloudflare can serve it brotli-encoded with no
  // content-length header at all. The HEAD check must not treat that as "missing" forever; the byte check below
  // (always run for JSON) still confirms the exact content.
  const bytes = Buffer.from('{"ok":1}');
  const assets = [asset('a.json', bytes)];
  const fetcher = async (_url: string, init?: RequestInit) => {
    if (init?.method === 'HEAD') return new Response(null, { status: 200, headers: headers('a.json') }); // no content-length header
    return new Response(bytes, { status: 200, headers: headers('a.json') });
  };
  const result = await verifyPublished(assets, { origin: 'https://origin.test', fetcher: fetcher as typeof fetch, uploadOne: async () => { throw new Error('must not re-upload a live file'); } });
  assert.deepEqual(result, { retried: [], misses: [], sampleFailures: [] });
});

test('a JSON key with no content-length on HEAD but drifted bytes still fails verification', async () => {
  // Combines the two prior cases: a compressed JSON response with no content-length header makes headOk pass on
  // status alone (so the key is never retried/re-uploaded as a "miss"), but the full byte check below — always
  // run for JSON regardless of what HEAD reported — must still catch drifted content.
  const bytes = Buffer.from('{"ok":1}'), wrong = Buffer.from(bytes); wrong[Math.floor(wrong.length / 2)] = wrong[Math.floor(wrong.length / 2)]! ^ 0xff;
  const assets = [asset('a.json', bytes)];
  const fetcher = async (_url: string, init?: RequestInit) => {
    if (init?.method === 'HEAD') return new Response(null, { status: 200, headers: headers('a.json') }); // no content-length header
    return new Response(wrong, { status: 200, headers: headers('a.json') }); // same length as the pin; only the sha256 comparison can catch this.
  };
  const result = await verifyPublished(assets, { origin: 'https://origin.test', fetcher: fetcher as typeof fetch, uploadOne: async () => { throw new Error('must not re-upload: HEAD reported it live'); } });
  assert.deepEqual(result.retried, [], 'a no-content-length HEAD that is otherwise ok is never treated as a miss');
  assert.deepEqual(result.misses, []);
  assert.deepEqual(result.sampleFailures, ['a.json']);
  assert.throws(() => reportVerification(result), /a\.json/);
});

test('a JSON key with drifted bytes is caught even with sampleSize: 0 (JSON is always fully verified, never sampled)', async () => {
  const bytes = Buffer.from('{"ok":1}'), wrong = Buffer.from(bytes); wrong[Math.floor(wrong.length / 2)] = wrong[Math.floor(wrong.length / 2)]! ^ 0xff;
  const assets = [asset('a.json', bytes)];
  const fetcher = async (_url: string, init?: RequestInit) => {
    if (init?.method === 'HEAD') return new Response(null, { status: 200, headers: headers('a.json', bytes.length) });
    return new Response(wrong, { status: 200, headers: headers('a.json') }); // same length as the pin; only the sha256 comparison can catch this.
  };
  const result = await verifyPublished(assets, { origin: 'https://origin.test', fetcher: fetcher as typeof fetch, uploadOne: async () => {}, sampleSize: 0 });
  assert.deepEqual(result.sampleFailures, ['a.json'], 'sampleSize must only govern non-JSON assets; every JSON key is always fully byte-verified');
});

test('a live key with the right bytes but stale content type is republished', async () => {
  const bytes = Buffer.from('{"large":true}');
  const assets = [asset('a.json', bytes)];
  let repaired = false;
  const fetcher = async (_url: string, init?: RequestInit) => {
    if (init?.method === 'HEAD') return new Response(null, { status: 200, headers: {
      'content-length': String(bytes.length), 'content-type': repaired ? 'application/json' : 'application/octet-stream',
    } });
    return new Response(bytes, { status: 200, headers: headers('a.json') });
  };
  const result = await verifyPublished(assets, { origin: 'https://origin.test', fetcher: fetcher as typeof fetch,
    uploadOne: async () => { repaired = true; } });
  assert.deepEqual(result, { retried: ['a.json'], misses: [], sampleFailures: [] });
});
