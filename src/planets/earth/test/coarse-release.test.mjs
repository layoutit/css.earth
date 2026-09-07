import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';
import { PREPARED_EARTH_SCENE as scene } from '../runtime/preparedScene.mjs';
import { childAddresses, pageKey } from '../tools/city/page-geometry.mjs';
import { prepareCoarsePageGeometry, sampleCoarsePage, trimCoarsePageRgba } from '../tools/city/coarse-page.mjs';
import { prepareCoarseRaster, prepareCoarseRelease } from '../tools/city/coarse-release.mjs';
import { acquireCoarseInputs } from '../tools/city/coarse-inputs.mjs';
import { COARSE_PREPARATION_LIMITS } from '../tools/city/coarse-plan.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const fineRoots = Array.from({ length: 1024 }, (_, i) => ({ key: `wmts-tile-5-${i % 32}-${Math.floor(i / 32)}` }));

test('release encoder retains source rows and visible pixels through cropping and WebP encoding', async () => {
  const entry = { key: '0-9-10', level: 0, x: 9, y: 10, children: [], tiles: ['0-0-0'], resolution: { zoom: 0 },
    catalogTiles: ['source-inventory-only'], stop: false, empty: null };
  const source = Buffer.alloc(256 * 256 * 4);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) source.set([x, y, 55, x % 3 ? 255 : 93], (y * 256 + x) * 4);
  const result = await prepareCoarseRaster(entry, scene, fineRoots, new Map([['0-0-0', source]]));
  for (const key of ['tiles', 'resolution', 'catalogTiles', 'stop', 'empty']) assert.equal(Object.hasOwn(result.page, key), false, `Preparation-only ${key} must not reach runtime`);
  const geometry = prepareCoarsePageGeometry(entry, scene);
  const sampled = sampleCoarsePage(geometry, 0, (x, y) => source.subarray((y * 256 + x) * 4, (y * 256 + x + 1) * 4));
  // Existing preparation uses Sharp's vertical flip; compare it with the new
  // release path, including its final decoded pixels and retirement support.
  const flipped = await sharp(sampled, { raw: { width: 260, height: 260, channels: 4 } }).flip().raw().toBuffer();
  const expected = trimCoarsePageRgba(flipped, 260, 260);
  assert.deepEqual(await sharp(result.bytes).ensureAlpha().raw().toBuffer(), Buffer.from(expected.rgba));
  assert.equal(result.source.rgbaSha256, hash(flipped));
  assert.ok(result.page.replacement.branches.length > 0);
});

test('a complete local release indexes every prepared branch and resumes without rebuilding images', async t => {
  const directory = pathToFileURL(await mkdtemp(join(tmpdir(), 'earth-coarse-release-')) + '/');
  t.after(() => rm(directory, { recursive: true, force: true }));
  const root = { level: 0, x: 9, y: 10 }, children = childAddresses(root);
  const fine = { roots: fineRoots, dataset: 'coarse-test', geometryVersion: 'fixture', assetOrigin: 'https://example.invalid', decodedPageBytes: 262144 };
  const plan = { version: 'fixture', limits: COARSE_PREPARATION_LIMITS, rootCount: 2,
    inputs: { sourceHashes: {}, fineRootsSha256: hash(JSON.stringify(fineRoots)), fineGeometryVersion: fine.geometryVersion },
    source: [{ key: '0-0-0', zoom: 0, x: 0, y: 0, url: 'https://example.invalid/00/0/0.png' }],
    pages: [root, ...children].map(address => ({ ...address, key: pageKey(address), children: address.level ? [] : children.map(pageKey),
      tiles: ['0-0-0'], resolution: { zoom: 0 }, empty: null })) };
  plan.pages.push({ level: 0, x: 0, y: 0, key: '0-0-0', children: [], tiles: [], resolution: { empty: true }, empty: 'outside-pinned-source-inventory' });
  const png = await sharp({ create: { width: 256, height: 256, channels: 4, background: { r: 17, g: 80, b: 49, alpha: 1 } } }).png().toBuffer();
  await acquireCoarseInputs({ plan, directory, fetchImpl: async () => new Response(png, { headers: { 'content-type': 'image/png' } }) });
  const args = { plan, directory, fine, scene, project: new URL('../../../../', import.meta.url) };
  const first = await prepareCoarseRelease(args);
  const manifestFile = new URL(`releases/${first.version}/manifest.json`, directory), originalManifest = await readFile(manifestFile);
  assert.equal(first.pages, 6); assert.equal(first.empty, 1); assert.equal(first.backing.roots.length, 2);
  assert.equal(first.sourceReads, 1);
  const nodes = [];
  for (const asset of first.assets) {
    const bytes = await readFile(join(first.staging, asset.filename));
    assert.equal(bytes.length, asset.bytes); assert.equal(hash(bytes), asset.sha256);
    if (asset.type === 'application/json') nodes.push(...JSON.parse(bytes).nodes);
  }
  assert.deepEqual(nodes.map(node => node.key).sort(), plan.pages.map(page => page.key).sort());
  assert.equal(nodes.find(node => node.key === '0-0-0').replacement.empty, true);
  const second = await prepareCoarseRelease(args);
  assert.equal(second.version, first.version); assert.equal(second.sourceReads, 0);
  assert.deepEqual(second.assets, first.assets);
  assert.deepEqual(await readFile(manifestFile), originalManifest, 'Resumption preserves the canonical release bytes');
  // A completed receipt is evidence only while its actual image still matches.
  await writeFile(join(first.staging, first.assets[0].filename), Buffer.alloc(first.assets[0].bytes));
  await assert.rejects(prepareCoarseRelease(args), /Expected values/);
});
