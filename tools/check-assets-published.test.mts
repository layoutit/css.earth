import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { checkAssetsPublished } from './check-assets-published.mts';
import { preparePreparedAssetManifest } from '../src/platform/runtime-asset-closure.mts';

async function fixtureRoot() {
  const root = await mkdtemp(resolve(tmpdir(), 'check-assets-published-'));
  const preparedDirectory = resolve(root, 'src/objects/fixture-body/prepared');
  await mkdir(preparedDirectory, { recursive: true });
  await writeFile(resolve(preparedDirectory, 'runtime.json'), '12-byte-run!');
  await writeFile(resolve(preparedDirectory, 'scene.json'), '12-byte-scn!');
  await preparePreparedAssetManifest({ planetId: 'fixture-body', preparedRoot: preparedDirectory,
    manifestPath: resolve(preparedDirectory, '..', 'prepared-assets.json'), filenames: ['runtime.json', 'scene.json'] });
  return root;
}

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
  const result = await checkAssetsPublished(['--object=fixture-body'], { root, fetcher: async (url, init) => {
    calls++;
    assert.equal(init?.method, 'HEAD');
    if (String(url).endsWith('/scene.json')) return new Response(null, { status: 404 });
    return new Response(null, { status: 200, headers: { 'content-length': '12' } });
  } });
  assert.equal(calls, 2);
  assert.equal(result.checked, 2);
  const sceneSha256 = createHash('sha256').update('12-byte-scn!').digest('hex');
  assert.deepEqual(result.misses, [`fixture-body/scene.json (runtime-assets/${sceneSha256}/scene.json)`]);
});
