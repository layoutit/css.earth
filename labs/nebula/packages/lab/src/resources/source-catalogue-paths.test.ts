import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import catalogue from '../../sources/index.json' with { type: 'json' };
import { catalogueSourceUrl } from './source-catalogue-paths.ts';
import { parseLabModelJson, resolveLabModelPath } from './model-paths.ts';

test('catalogue-relative source URLs preserve candidate locations and survive a lab folder rename', async () => {
  const catalogueUrl = new URL('file:///repo/labs/nebula/packages/lab/sources/index.json');
  assert.equal(catalogue.pathBase, '../../..');
  for (const subject of catalogue.subjects) for (const source of subject.sources) {
    const expected = new URL(`file:///repo/labs/nebula/${source.path}`);
    assert.equal(catalogueSourceUrl(catalogueUrl.href, catalogue.pathBase, source.path), `/@fs${decodeURIComponent(expected.pathname)}`);
  }
  assert.equal(catalogueSourceUrl('file:///repo/labs/renamed/packages/lab/sources/index.json', catalogue.pathBase,
    'models/lmc/candidates/prepared/vista-infrared.webp'), '/@fs/repo/labs/renamed/models/lmc/candidates/prepared/vista-infrared.webp');
});

test('persisted acquisition-record paths load from the catalogue owner without rewriting historical receipts', async () => {
  for (const name of ['reference-images.json', 'lmc-smash-full.webp.json', 'smc-smash-full.webp.json',
    'omega-centauri-vst.webp.json', 'omega-centauri-wfi.webp.json', 'orion-reference.json']) {
    const old = `labs/nebula/sources/${name}`;
    const path = resolveLabModelPath(old);
    assert.equal(path, `labs/nebula/packages/lab/sources/${name}`);
    const receipt = await readFile(path, 'utf8');
    assert.ok(JSON.parse(receipt));
    assert.equal(parseLabModelJson(JSON.stringify({ path: old })).path, path);
  }
  assert.equal(resolveLabModelPath('labs/nebula/sources/untracked-local.json'), 'labs/nebula/sources/untracked-local.json');
  // Ignored display rasters retain their existing paths and local caches.
  assert.equal(resolveLabModelPath('labs/nebula/sources/lmc-smash-full.webp'), 'labs/nebula/sources/lmc-smash-full.webp');
});

test('source URL resolution rejects non-file catalogues and escaping source paths', () => {
  for (const [catalogue, base, source] of [
    ['https://example.org/catalogue.json', '.', 'image.webp'],
    ['file:///repo/catalogue.json', '.', '../image.webp'],
    ['file:///repo/catalogue.json', '.', '/image.webp'],
    ['file:///repo/catalogue.json', '.', 'image.webp?other'],
  ]) assert.throws(() => catalogueSourceUrl(catalogue, base, source), TypeError);
});

test('acquisition writes its receipt beside the catalogue recipe while leaving rasters in their cache', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nebula-receipt-owner-'));
  try {
    const cache = join(root, '.local/nebula-lab/source-originals');
    const records = join(root, 'catalogue');
    await mkdir(cache, { recursive: true });
    await mkdir(records);
    await sharp({ create: { width: 2, height: 2, channels: 3, background: '#abcdef' } }).tiff().toFile(join(cache, 'fixture.tif'));
    const recipe = join(records, 'reference-images.json');
    await writeFile(recipe, JSON.stringify({ schema: 'cssearth-lab-reference-images@1', images: [{ id: 'fixture',
      url: 'https://invalid.example/never-fetched', bytes: 0, width: 2, height: 2,
      publisherUrl: 'https://invalid.example/fixture', credit: 'Fixture', license: 'CC0',
      output: { path: 'rasters/reference.webp', quality: 92, effort: 0 } }] }));
    // The lab runner bundles this test into its cache; the child must run the source command.
    const command = resolve('labs/nebula/packages/lab/src/cli/commands/acquire-images.ts');
    const result = spawnSync(process.execPath, [command, recipe], { cwd: root, encoding: 'utf8', timeout: 30000 });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /REFERENCE_READY fixture/u);
    await access(join(root, 'rasters/reference.webp'));
    const receipt: unknown = JSON.parse(await readFile(join(records, 'reference.webp.json'), 'utf8'));
    assert.ok(typeof receipt === 'object' && receipt !== null && 'schema' in receipt);
    assert.equal(receipt.schema, 'cssearth-lab-reference-image@1');
    await assert.rejects(access(join(root, 'rasters/reference.webp.json')));
  } finally { await rm(root, { recursive: true, force: true }); }
});
