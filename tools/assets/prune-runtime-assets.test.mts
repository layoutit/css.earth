import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { computePruneCandidates, currentlyInventoriedKeys, listRuntimeAssetKeys } from './prune-runtime-assets.mts';
import { inventoryPreparedAssets } from '../../src/platform/runtime-asset-closure.mts';

test('computePruneCandidates keeps only keys absent from the inventory, and totals their bytes', () => {
  const live = [
    { key: 'runtime-assets/aaa/one.webp', bytes: 100 },
    { key: 'runtime-assets/bbb/two.webp', bytes: 250 },
    { key: 'runtime-assets/ccc/three.webp', bytes: 40 },
  ];
  const { candidates, bytes } = computePruneCandidates(live, new Set(['runtime-assets/bbb/two.webp']));
  assert.deepEqual(candidates, [
    { key: 'runtime-assets/aaa/one.webp', bytes: 100 },
    { key: 'runtime-assets/ccc/three.webp', bytes: 40 },
  ]);
  assert.equal(bytes, 140);
});

test('computePruneCandidates reports nothing to prune when every live key is inventoried', () => {
  const live = [{ key: 'runtime-assets/aaa/one.webp', bytes: 100 }];
  const { candidates, bytes } = computePruneCandidates(live, new Set(['runtime-assets/aaa/one.webp']));
  assert.deepEqual(candidates, []);
  assert.equal(bytes, 0);
});

test('computePruneCandidates refuses a live key outside runtime-assets/, never scoping scenes/ or source-cache/', () => {
  assert.throws(() => computePruneCandidates([{ key: 'source-cache/aaa/foo.tsv', bytes: 10 }], new Set()), /Refusing.*runtime-assets\//);
  assert.throws(() => computePruneCandidates([{ key: 'scenes/earth/tiles/x.webp', bytes: 10 }], new Set()), /Refusing.*runtime-assets\//);
});

test('currentlyInventoriedKeys reads real inventory.json keys from a fixture object', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'prune-inventory-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const preparedDirectory = resolve(root, 'src/objects/fixture-body/prepared');
  await mkdir(preparedDirectory, { recursive: true });
  await writeFile(resolve(preparedDirectory, 'runtime.json'), 'runtime-bytes');
  await writeFile(resolve(preparedDirectory, 'scene.json'), 'scene-bytes');
  await inventoryPreparedAssets({ objectId: 'fixture-body', objectDirectory: resolve(preparedDirectory, '..'), preparedRoot: preparedDirectory, filenames: ['runtime.json', 'scene.json'], gitTrackedPaths: async () => new Set() });
  const keys = await currentlyInventoriedKeys(root);
  assert.equal(keys.size, 2);
  for (const key of keys) assert.match(key, /^runtime-assets\/[0-9a-f]{64}\/(runtime|scene)\.json$/);
});

test('listRuntimeAssetKeys signs the request and follows continuation tokens across pages', async () => {
  const requests: { url: string; headers: Record<string, string> }[] = [];
  const pageOne = `<?xml version="1.0"?><ListBucketResult>
    <IsTruncated>true</IsTruncated>
    <NextContinuationToken>tok-2</NextContinuationToken>
    <Contents><Key>runtime-assets/aaa/one.webp</Key><Size>111</Size></Contents>
  </ListBucketResult>`;
  const pageTwo = `<?xml version="1.0"?><ListBucketResult>
    <IsTruncated>false</IsTruncated>
    <Contents><Key>runtime-assets/bbb/two.webp</Key><Size>222</Size></Contents>
  </ListBucketResult>`;
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    requests.push({ url, headers: Object.fromEntries(new Headers(init?.headers).entries()) });
    return new Response(url.includes('continuation-token') ? pageTwo : pageOne, { status: 200 });
  };
  const keys = await listRuntimeAssetKeys({ accountId: 'acct123', accessKeyId: 'AKIDFIXTURE', secretAccessKey: 'secretFixture' }, { fetcher });
  assert.deepEqual(keys, [
    { key: 'runtime-assets/aaa/one.webp', bytes: 111 },
    { key: 'runtime-assets/bbb/two.webp', bytes: 222 },
  ]);
  assert.equal(requests.length, 2);
  assert.equal(requests[1]!.url.includes('continuation-token=tok-2'), true);
  for (const { url, headers } of requests) {
    assert.equal(url.startsWith('https://acct123.r2.cloudflarestorage.com/cssearth-assets?'), true);
    assert.equal(url.includes('prefix=runtime-assets%2F'), true);
    assert.match(headers.authorization ?? '', /^AWS4-HMAC-SHA256 Credential=AKIDFIXTURE\//u);
    assert.match(headers.authorization ?? '', /SignedHeaders=host;x-amz-content-sha256;x-amz-date/u);
    assert.match(headers['x-amz-date'] ?? '', /^\d{8}T\d{6}Z$/u);
  }
});

test('listRuntimeAssetKeys signs a different request (different signature) for different credentials', async () => {
  let firstSignature = '';
  const capture = (): typeof fetch => async (_input, init) => {
    const auth = new Headers(init?.headers).get('authorization') ?? '';
    firstSignature ||= auth;
    return new Response('<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>', { status: 200 });
  };
  await listRuntimeAssetKeys({ accountId: 'acct', accessKeyId: 'AKID', secretAccessKey: 'secretA' }, { fetcher: capture() });
  const withSecretA = firstSignature;
  firstSignature = '';
  await listRuntimeAssetKeys({ accountId: 'acct', accessKeyId: 'AKID', secretAccessKey: 'secretB' }, { fetcher: capture() });
  assert.notEqual(withSecretA, firstSignature);
});

test('listRuntimeAssetKeys surfaces a non-ok response as an error instead of an empty result', async () => {
  await assert.rejects(listRuntimeAssetKeys({ accountId: 'acct', accessKeyId: 'AKID', secretAccessKey: 'secret' },
    { fetcher: async () => new Response('access denied', { status: 403 }) }), /HTTP 403/);
});
