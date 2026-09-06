import { readFile } from 'node:fs/promises';
import { expect, test, vi } from 'vitest';
import { loadPreparedCssVolume } from './loader.js';

async function fixture() {
  const base = new URL('../../../objects/milky-way/', import.meta.url);
  const descriptor = JSON.parse(await readFile(new URL('object.json', base), 'utf8'));
  const recipe = JSON.parse(await readFile(new URL('source/volume.json', base), 'utf8'));
  const bytes = new Uint8Array(await readFile(new URL(descriptor.prepared.url, base))).buffer;
  return { descriptor, bytes, recipe };
}

test('loads the checked-in density artifact with its complete fixed asset bank', async () => {
  const { descriptor, bytes, recipe } = await fixture();
  const read = vi.fn(async () => bytes);
  const payload = await loadPreparedCssVolume(descriptor, { read });
  expect(read).toHaveBeenCalledExactlyOnceWith(descriptor.prepared.url);
  const count = Object.values(recipe.bake.sliceCounts).reduce<number>((sum, count) => sum + Number(count), 0);
  expect(payload.resources).toHaveLength(count);
  expect(payload.stacks.flatMap(stack => stack.leaves)).toHaveLength(count);
  expect(payload.frame).toEqual(descriptor.properties.volume);
});

test('rejects stale bytes and authenticated frame drift before rendering', async () => {
  const { descriptor, bytes } = await fixture();
  const changed = new TextEncoder().encode(new TextDecoder().decode(bytes) + '\n').buffer;
  await expect(loadPreparedCssVolume(descriptor, { read: async () => changed })).rejects.toThrow('SHA-256');
  const drifted = structuredClone(descriptor);
  drifted.properties.volume.originM[0] += 1e18;
  await expect(loadPreparedCssVolume(drifted, { read: async () => bytes })).rejects.toThrow('frame');
});
