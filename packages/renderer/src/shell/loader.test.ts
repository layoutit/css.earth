import { readFile, readdir } from 'node:fs/promises';
import sharp from 'sharp';
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { loadPreparedCssSurfaceShell } from './loader.js';

async function fixture() {
  const base = new URL('../../../../src/objects/heliosphere/', import.meta.url);
  const descriptor = JSON.parse(await readFile(new URL('object.json', base), 'utf8'));
  const bytes = new Uint8Array(await readFile(new URL(descriptor.prepared.url, base))).buffer;
  return { base, descriptor, bytes };
}

test('loads the prepared surface shell and its material without reading source geometry', async () => {
  const { base, descriptor, bytes } = await fixture();
  const read = mock.fn(async () => bytes);
  const payload = await loadPreparedCssSurfaceShell(descriptor, { read });
  assert.equal(read.mock.callCount(), 1); assert.deepEqual(read.mock.calls[0]!.arguments, [descriptor.prepared.url]);
  assert.ok(payload.faces.length > 0);
  assert.equal(payload.resources.some(resource => resource.path === payload.atlas.path), true);
  const directory = new URL(descriptor.prepared.url.replace(/[^/]+$/u, ''), base);
  const ownedImages = (await readdir(directory, { recursive: true })).filter(path => /\.(?:png|webp)$/iu.test(path)).sort();
  assert.deepEqual(ownedImages, [payload.atlas.path]);
  let transferBytes = 0, decodedRgbaBytes = 0;
  for (const resource of payload.resources) {
    const image = await readFile(new URL(resource.path, directory)), metadata = await sharp(image).metadata();
    assert.equal(image.byteLength, resource.bytes, resource.path);
    assert.deepEqual(([metadata.width, metadata.height]), [resource.width, resource.height], resource.path);
    transferBytes += image.byteLength; decodedRgbaBytes += resource.width * resource.height * 4;
  }
  console.info('Prepared shell image bank integrity:', JSON.stringify({ images: payload.resources.length, bytes: transferBytes, decodedRgbaBytes }));
  assert.deepEqual(payload.frame, descriptor.properties.frame);
});

test('rejects mismatched physical placement before mounting', async () => {
  const { descriptor, bytes } = await fixture();
  const drifted = structuredClone(descriptor);
  drifted.properties.frame.originM[0] += 1e12;
  await assert.rejects(loadPreparedCssSurfaceShell(drifted, { read: async () => bytes }), /frame/);
});
