import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { expect, test, vi } from 'vitest';
import { loadPreparedCssPointField } from './loader.js';
import { parsePreparedCssPointField } from './validation.js';

async function fixture() {
  const base = new URL('../../../objects/stellar-neighbourhood/', import.meta.url);
  const descriptor = JSON.parse(await readFile(new URL('object.json', base), 'utf8')) as Record<string, unknown>;
  const prepared = descriptor.prepared as { url: string };
  const bytes = new Uint8Array(await readFile(new URL(prepared.url, base))).buffer;
  const envelope = JSON.parse(new TextDecoder().decode(bytes)) as { data: Record<string, unknown> };
  return { descriptor, bytes, data: envelope.data };
}

test('decodes the checked prepared point field and verifies its pinned transport once', async () => {
  const { descriptor, bytes, data } = await fixture();
  const payload = parsePreparedCssPointField(data);
  expect(payload.stars.length).toBeGreaterThan(0);
  expect(payload.nodes[0]?.first).toBe(0);
  expect(payload.nodes[0]?.count).toBe(payload.stars.length);
  expect(payload.nodes.length).toBeGreaterThan(0);
  expect(payload.stars.filter(star => star.coverageAnchor)).toHaveLength(96);
  expect(payload.photometry.floor).toBe(1 / 255);
  expect(payload.labels.activeSlots).toBe(1);
  expect(payload.resources.find(resource => resource.path === payload.atlas.path)).toBeDefined();
  const read = vi.fn(async () => bytes);
  const loaded = await loadPreparedCssPointField(descriptor, { read });
  expect(read).toHaveBeenCalledExactlyOnceWith((descriptor.prepared as { url: string }).url);
  expect(loaded.frame).toEqual((descriptor.properties as { frame: unknown }).frame);
});

test('rejects a malformed hierarchy partition, resource metadata, and pinned bytes', async () => {
  const { descriptor, bytes, data } = await fixture();
  const nodes = data.nodes as Record<string, unknown>[];
  const child = (nodes[0]?.children as number[])[0]!;
  const malformed = { ...data, nodes: nodes.map((node, index) => index === child ? { ...node, first: (node.first as number) + 1 } : node) };
  expect(() => parsePreparedCssPointField(malformed)).toThrow('partition');
  const resources = data.resources as Record<string, unknown>[];
  expect(() => parsePreparedCssPointField({ ...data, resources: resources.map((resource, index) => index === 0 ? { ...resource, width: 1 } : resource) })).toThrow('atlas metadata');
  const stars = data.stars as Record<string, unknown>[];
  expect(() => parsePreparedCssPointField({ ...data, stars: [{ ...stars[0], positionUnits: [Number.NaN, 0, 0] }, ...stars.slice(1)] })).toThrow('star position');
  const policy = data.policy as Record<string, unknown>;
  expect(() => parsePreparedCssPointField({ ...data, policy: { ...policy, transitionSlots: (policy.activeSlots as number) - 1 } })).toThrow('policy');
  const first = stars[0]!;
  expect(() => parsePreparedCssPointField({ ...data, stars: [{ ...first, coverageAnchor: undefined }, ...stars.slice(1)] })).toThrow('star');
  const photometry = data.photometry as Record<string, unknown>;
  expect(() => parsePreparedCssPointField({ ...data, photometry: { ...photometry, floor: 2 } })).toThrow('photometry');
  const labels = data.labels as Record<string, unknown>;
  expect(() => parsePreparedCssPointField({ ...data, labels: { ...labels, transitionSlots: 0 } })).toThrow('labels');
  const stale = new TextEncoder().encode(new TextDecoder().decode(bytes) + '\n').buffer;
  await expect(loadPreparedCssPointField(descriptor, { read: async () => stale })).rejects.toThrow('SHA-256');
  const drifted = structuredClone(descriptor) as { properties: { frame: { originM: number[] } } };
  drifted.properties.frame.originM[0] += 1;
  await expect(loadPreparedCssPointField(drifted, { read: async () => bytes })).rejects.toThrow('frame');
});
