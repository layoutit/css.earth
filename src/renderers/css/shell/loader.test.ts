import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import sharp from 'sharp';
import { expect, test, vi } from 'vitest';
import { loadPreparedCssSurfaceShell } from './loader.js';

async function fixture() {
  const base = new URL('../../../objects/heliosphere/', import.meta.url);
  const descriptor = JSON.parse(await readFile(new URL('object.json', base), 'utf8'));
  const bytes = new Uint8Array(await readFile(new URL(descriptor.prepared.url, base))).buffer;
  return { base, descriptor, bytes };
}

test('loads the pinned surface shell and its prepared material without reading source geometry', async () => {
  const { base, descriptor, bytes } = await fixture();
  const read = vi.fn(async () => bytes);
  const payload = await loadPreparedCssSurfaceShell(descriptor, { read });
  expect(read).toHaveBeenCalledExactlyOnceWith(descriptor.prepared.url);
  expect(payload.faces.length).toBeGreaterThan(0);
  expect(payload.resources.some(resource => resource.path === payload.atlas.path)).toBe(true);
  const directory = new URL(descriptor.prepared.url.replace(/[^/]+$/u, ''), base);
  const ownedImages = (await readdir(directory, { recursive: true })).filter(path => /\.(?:png|webp)$/iu.test(path)).sort();
  expect(ownedImages).toEqual([payload.atlas.path]);
  let transferBytes = 0, decodedRgbaBytes = 0;
  for (const resource of payload.resources) {
    const image = await readFile(new URL(resource.path, directory)), metadata = await sharp(image).metadata();
    expect(image.byteLength, resource.path).toBe(resource.bytes);
    expect(createHash('sha256').update(image).digest('hex'), resource.path).toBe(resource.sha256);
    expect([metadata.width, metadata.height], resource.path).toEqual([resource.width, resource.height]);
    transferBytes += image.byteLength; decodedRgbaBytes += resource.width * resource.height * 4;
  }
  console.info('Prepared shell image bank integrity:', JSON.stringify({ images: payload.resources.length, bytes: transferBytes, decodedRgbaBytes }));
  expect(payload.frame).toEqual(descriptor.properties.frame);
});

test('rejects mismatched physical placement before mounting', async () => {
  const { descriptor, bytes } = await fixture();
  const drifted = structuredClone(descriptor);
  drifted.properties.frame.originM[0] += 1e12;
  await expect(loadPreparedCssSurfaceShell(drifted, { read: async () => bytes })).rejects.toThrow('frame');
});
