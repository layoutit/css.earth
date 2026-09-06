import { readFile } from 'node:fs/promises';
import { expect, test, vi } from 'vitest';
import { loadPreparedCssSurfaceShell } from './loader.js';

async function fixture() {
  const base = new URL('../../../objects/heliosphere/', import.meta.url);
  const descriptor = JSON.parse(await readFile(new URL('object.json', base), 'utf8'));
  const bytes = new Uint8Array(await readFile(new URL(descriptor.prepared.url, base))).buffer;
  return { descriptor, bytes };
}

test('loads the pinned surface shell and its prepared material without reading source geometry', async () => {
  const { descriptor, bytes } = await fixture();
  const read = vi.fn(async () => bytes);
  const payload = await loadPreparedCssSurfaceShell(descriptor, { read });
  expect(read).toHaveBeenCalledExactlyOnceWith(descriptor.prepared.url);
  expect(payload.faces.length).toBeGreaterThan(0);
  expect(payload.resources.some(resource => resource.path === payload.atlas.path)).toBe(true);
  expect(payload.frame).toEqual(descriptor.properties.frame);
});

test('rejects changed bytes and mismatched physical placement before mounting', async () => {
  const { descriptor, bytes } = await fixture();
  const changed = new TextEncoder().encode(new TextDecoder().decode(bytes) + '\n').buffer;
  await expect(loadPreparedCssSurfaceShell(descriptor, { read: async () => changed })).rejects.toThrow('SHA-256');
  const drifted = structuredClone(descriptor);
  drifted.properties.frame.originM[0] += 1e12;
  await expect(loadPreparedCssSurfaceShell(drifted, { read: async () => bytes })).rejects.toThrow('frame');
});
