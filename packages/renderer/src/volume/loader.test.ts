import { readFile, readdir } from 'node:fs/promises';
import sharp from 'sharp';
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { requireInventory } from '@cssearth/objects/node';
import { loadPreparedCssVolume } from './loader.js';

async function fixture() {
  const base = new URL('../../../../src/objects/milky-way-volume/', import.meta.url);
  const descriptor = JSON.parse(await readFile(new URL('object.json', base), 'utf8'));
  const recipe = JSON.parse(await readFile(new URL('source/volume.json', base), 'utf8'));
  const inventory = requireInventory('milky-way', JSON.parse(await readFile(new URL('inventory.json', base), 'utf8')));
  const bytes = new Uint8Array(await readFile(new URL(descriptor.prepared.url, base))).buffer;
  return { base, descriptor, bytes, recipe, inventory };
}

test('loads the inventoried density artifact with its complete hybrid asset bank', async () => {
  const { base, descriptor, bytes, recipe, inventory } = await fixture();
  const read = mock.fn(async () => bytes);
  const payload = await loadPreparedCssVolume(descriptor, { read });
  assert.equal(read.mock.callCount(), 1); assert.deepEqual(read.mock.calls[0]!.arguments, [descriptor.prepared.url]);
  const slices = payload.stacks.flatMap(stack => stack.leaves);
  const sky = payload.sky?.faces ?? [];
  assert.equal(Boolean(payload.sky), Boolean(recipe.sky));
  // The published bank owns cropped bulge slices only: no flat disc plane and no whole-galaxy impostor views.
  // The full-galaxy bake is intermediate data, retired after the hybrid compile.
  // The galaxy's backing image is its own bank (prepared/backing.json, drawn by universe/galaxy-backing.ts), not the volume's.
  const directory = new URL(descriptor.prepared.url.replace(/[^/]+$/u, ''), base);
  const backing = await readFile(new URL('backing.json', directory), 'utf8').then(text => {
    const bank = JSON.parse(text) as { leaf: { texturePath: string }; sections?: { texturePath: string }[] };
    return [bank.leaf.texturePath, ...(bank.sections ?? []).map(section => section.texturePath)];
  }, () => [] as string[]);
  const images = inventory.assets.filter(asset => asset.location === 'prepared' && /\.(?:png|webp)$/iu.test(asset.filename) && !backing.includes(asset.filename));
  assert.deepEqual(slices.map(leaf => leaf.texturePath).sort(), images.map(asset => asset.filename).filter(path => path.startsWith('core/slices/')).sort());
  assert.equal(payload.impostors, undefined);
  assert.equal(payload.resources.length, slices.length + sky.length);
  // The prepared traversal owns presentation order; source depth order is not
  // a loader instruction. Keep every leaf and transport the authored ordering.
  const prepared = JSON.parse(new TextDecoder().decode(bytes));
  assert.deepEqual(payload.stacks, prepared.data.stacks);
  const used = [...slices, ...sky].map(image => image.texturePath).sort();
  assert.deepEqual(payload.resources.map(resource => resource.path).sort(), used);
  assert.deepEqual(payload.resources.map(({ path, bytes }) => ({ filename: path, bytes }))
    .sort((a, b) => a.filename.localeCompare(b.filename)), images.map(({ filename, bytes }) => ({ filename, bytes }))
    .sort((a, b) => a.filename.localeCompare(b.filename)));
  const ownedImages = (await readdir(directory, { recursive: true })).filter(path => /\.(?:png|webp)$/iu.test(path) && !backing.includes(path)).sort();
  assert.deepEqual(ownedImages, used);
  const skyPaths = new Set(sky.map(face => face.texturePath));
  const banks = { volume: { images: slices.length, bytes: 0, decodedRgbaBytes: 0 }, sky: { images: sky.length, bytes: 0, decodedRgbaBytes: 0 } };
  for (const resource of payload.resources) {
    const image = await readFile(new URL(resource.path, directory)), metadata = await sharp(image).metadata();
    assert.equal(image.byteLength, resource.bytes, resource.path);
    assert.deepEqual(([metadata.width, metadata.height]), [resource.width, resource.height], resource.path);
    if (skyPaths.has(resource.path) && metadata.hasAlpha) assert.equal((await sharp(image).ensureAlpha().stats()).channels[3]!.min, 255, resource.path);
    const bank = skyPaths.has(resource.path) ? banks.sky : banks.volume;
    bank.bytes += image.byteLength; bank.decodedRgbaBytes += resource.width * resource.height * 4;
  }
  console.info('Prepared image bank integrity:', JSON.stringify(banks));
  assert.deepEqual(payload.frame, descriptor.properties.volume);
});

test('rejects authenticated frame drift before rendering', async () => {
  const { descriptor, bytes } = await fixture();
  const drifted = structuredClone(descriptor);
  drifted.properties.volume.originM[0] += 1e18;
  await assert.rejects(loadPreparedCssVolume(drifted, { read: async () => bytes }), /frame/);
});
