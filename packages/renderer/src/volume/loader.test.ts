import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import sharp from 'sharp';
import { expect, test, vi } from 'vitest';
import { requireInventory } from '@cssearth/objects/node';
import { loadPreparedCssVolume } from './loader.js';

async function fixture() {
  const base = new URL('../../../../src/objects/milky-way/', import.meta.url);
  const descriptor = JSON.parse(await readFile(new URL('object.json', base), 'utf8'));
  const recipe = JSON.parse(await readFile(new URL('source/volume.json', base), 'utf8'));
  const inventory = requireInventory('milky-way', JSON.parse(await readFile(new URL('inventory.json', base), 'utf8')));
  const bytes = new Uint8Array(await readFile(new URL(descriptor.prepared.url, base))).buffer;
  return { base, descriptor, bytes, recipe, inventory };
}

test('loads the inventoried density artifact with its complete hybrid asset bank', async () => {
  const { base, descriptor, bytes, recipe, inventory } = await fixture();
  const read = vi.fn(async () => bytes);
  const payload = await loadPreparedCssVolume(descriptor, { read });
  expect(read).toHaveBeenCalledExactlyOnceWith(descriptor.prepared.url);
  // A sky with baked stars ships both cubes: the plain faces and the near ones.
  const slices = payload.stacks.flatMap(stack => stack.leaves);
  const sky = [...payload.sky?.faces ?? [], ...payload.sky?.nearFaces ?? []];
  expect(Boolean(payload.sky)).toBe(Boolean(recipe.sky));
  // The published bank owns cropped bulge slices only: no flat disc plane and no whole-galaxy impostor views.
  // The full-galaxy bake is intermediate data, retired after the hybrid compile.
  const images = inventory.assets.filter(asset => asset.location === 'prepared' && /\.(?:png|webp)$/iu.test(asset.filename));
  expect(slices.map(leaf => leaf.texturePath).sort()).toEqual(images.map(asset => asset.filename).filter(path => path.startsWith('core/slices/')).sort());
  expect(payload.impostors).toBeUndefined();
  expect(payload.resources).toHaveLength(slices.length + sky.length);
  // The prepared traversal owns presentation order; source depth order is not
  // a loader instruction. Keep every leaf and transport the authored ordering.
  const prepared = JSON.parse(new TextDecoder().decode(bytes));
  expect(payload.stacks).toEqual(prepared.data.stacks);
  const used = [...slices, ...sky].map(image => image.texturePath).sort();
  expect(payload.resources.map(resource => resource.path).sort()).toEqual(used);
  expect(payload.resources.map(({ path, bytes, sha256 }) => ({ filename: path, bytes, sha256 }))
    .sort((a, b) => a.filename.localeCompare(b.filename))).toEqual(images.map(({ filename, bytes, sha256 }) => ({ filename, bytes, sha256 }))
    .sort((a, b) => a.filename.localeCompare(b.filename)));
  const directory = new URL(descriptor.prepared.url.replace(/[^/]+$/u, ''), base);
  const ownedImages = (await readdir(directory, { recursive: true })).filter(path => /\.(?:png|webp)$/iu.test(path)).sort();
  expect(ownedImages).toEqual(used);
  const skyPaths = new Set(sky.map(face => face.texturePath));
  const banks = { volume: { images: slices.length, bytes: 0, decodedRgbaBytes: 0 }, sky: { images: sky.length, bytes: 0, decodedRgbaBytes: 0 } };
  for (const resource of payload.resources) {
    const image = await readFile(new URL(resource.path, directory)), metadata = await sharp(image).metadata();
    expect(image.byteLength, resource.path).toBe(resource.bytes);
    expect(createHash('sha256').update(image).digest('hex'), resource.path).toBe(resource.sha256);
    expect([metadata.width, metadata.height], resource.path).toEqual([resource.width, resource.height]);
    if (skyPaths.has(resource.path) && metadata.hasAlpha) expect((await sharp(image).ensureAlpha().stats()).channels[3]!.min, resource.path).toBe(255);
    const bank = skyPaths.has(resource.path) ? banks.sky : banks.volume;
    bank.bytes += image.byteLength; bank.decodedRgbaBytes += resource.width * resource.height * 4;
  }
  console.info('Prepared image bank integrity:', JSON.stringify(banks));
  expect(payload.frame).toEqual(descriptor.properties.volume);
});

test('rejects authenticated frame drift before rendering', async () => {
  const { descriptor, bytes } = await fixture();
  const drifted = structuredClone(descriptor);
  drifted.properties.volume.originM[0] += 1e18;
  await expect(loadPreparedCssVolume(drifted, { read: async () => bytes })).rejects.toThrow('frame');
});
