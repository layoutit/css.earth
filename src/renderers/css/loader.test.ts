import { readFile } from 'node:fs/promises';
import { expect, test, vi } from 'vitest';
import { parseObjectDescriptor } from '@cssearth/objects';
import { fileURLToPath } from 'node:url';
import { loadPreparedCssObject } from './loader.js';
import type { SharedReference } from './loader.js';
import { sharedBankPath } from '../../platform/prepared-shared-banks.mts';

const root = new URL('../../../', import.meta.url);
/** The checked-in shared banks, read the way a Node transport would. */
async function readShared(reference: SharedReference) {
  return new Uint8Array(await readFile(sharedBankPath(fileURLToPath(root), reference))).buffer;
}
async function fixture(id = 'venus') {
  const descriptor = parseObjectDescriptor(await readFile(new URL(`src/planets/${id}/object.json`, root), 'utf8'));
  if (!descriptor.prepared) throw new Error('Fixture requires its prepared reference.');
  const bytes = new Uint8Array(await readFile(new URL(`src/planets/${descriptor.id}/${descriptor.prepared.url}`, root))).buffer;
  const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!isRecord(payload)) throw new Error('Fixture envelope must be a record.');
  return { descriptor, reference: descriptor.prepared, bytes, payload };
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
async function sha256(bytes: ArrayBuffer) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('');
}
async function changedPayload(value: unknown) {
  const f = await fixture(), bytes = new TextEncoder().encode(JSON.stringify(value)).buffer;
  return { descriptor: { ...f.descriptor, prepared: { ...f.reference, sha256: await sha256(bytes) } }, bytes };
}

for (const id of ['mercury', 'venus']) test(`${id} loads its actual pinned prepared JSON through the shared decoder`, async () => {
  const f = await fixture(id), read = vi.fn(async () => f.bytes);
  const definition = await loadPreparedCssObject(f.descriptor, { read, readShared });
  expect(read).toHaveBeenCalledExactlyOnceWith(f.reference.url);
  expect(definition.id).toBe(id);
  expect(definition.tree.nodes.length).toBeGreaterThan(100);
  expect(definition.controls.lenses?.controls.length).toBeGreaterThan(1);
  expect(definition.assets.startup.length).toBeGreaterThan(0);
});

test('stale bytes fail before a mount can be created, even when JSON meaning is unchanged', async () => {
  const f = await fixture(), mount = vi.fn();
  const stale = new TextEncoder().encode(new TextDecoder().decode(f.bytes) + '\n').buffer;
  await expect(loadPreparedCssObject(f.descriptor, { read: async () => stale, readShared }).then(mount)).rejects.toThrow('SHA-256');
  expect(mount).not.toHaveBeenCalled();
});

for (const field of ['id', 'type', 'format', 'schema']) test(`an authenticated mismatched envelope ${field} fails before mount`, async () => {
  const f = await fixture(), changed = await changedPayload({ ...f.payload, [field]: 'other' }), mount = vi.fn();
  await expect(loadPreparedCssObject(changed.descriptor, { read: async () => changed.bytes, readShared }).then(mount)).rejects.toThrow(/does not match/);
  expect(mount).not.toHaveBeenCalled();
});

test('the decoded CSS definition must match the descriptor as well as its envelope', async () => {
  const f = await fixture();
  if (!isRecord(f.payload.data)) throw new Error('Fixture requires a CSS definition.');
  const changed = await changedPayload({ ...f.payload, data: { ...f.payload.data, id: 'different' } }), mount = vi.fn();
  await expect(loadPreparedCssObject(changed.descriptor, { read: async () => changed.bytes, readShared }).then(mount)).rejects.toThrow(/does not match object venus/);
  expect(mount).not.toHaveBeenCalled();
});

test('missing preparation, unknown object type and unsupported format never request or bake data', async () => {
  const f = await fixture(), read = vi.fn(async () => f.bytes);
  const { prepared: _prepared, ...unprepared } = f.descriptor;
  for (const descriptor of [unprepared, { ...f.descriptor, type: 'unknown' },
    { ...f.descriptor, prepared: { ...f.reference, format: 'other-artifact@1' } }]) {
    await expect(loadPreparedCssObject(descriptor, { read, readShared })).rejects.toThrow();
  }
  expect(read).not.toHaveBeenCalled();
});

test('transport failure stays a failed load with no runtime preparation fallback', async () => {
  const f = await fixture(), mount = vi.fn();
  await expect(loadPreparedCssObject(f.descriptor, { read: async () => { throw new Error('asset unavailable'); } }).then(mount)).rejects.toThrow('asset unavailable');
  expect(mount).not.toHaveBeenCalled();
});

test('cancellation reaches the transport and an already-cancelled load cannot read bytes', async () => {
  const f = await fixture(), controller = new AbortController();
  let received: AbortSignal | undefined;
  const read = vi.fn((_url: string, signal?: AbortSignal) => new Promise<ArrayBuffer>((_resolve, reject) => {
    received = signal;
    signal!.addEventListener('abort', () => reject(signal!.reason), { once: true });
  }));
  const loading = loadPreparedCssObject(f.descriptor, { read, readShared }, { signal: controller.signal });
  expect(received).toBe(controller.signal);
  controller.abort();
  await expect(loading).rejects.toMatchObject({ name: 'AbortError' });
  await expect(loadPreparedCssObject(f.descriptor, { read, readShared }, { signal: controller.signal })).rejects.toMatchObject({ name: 'AbortError' });
  expect(read).toHaveBeenCalledOnce();
});

test('authenticated invalid UTF-8 JSON fails before the renderer can mount', async () => {
  const f = await fixture(), bytes = new Uint8Array([0xff]).buffer, mount = vi.fn();
  const descriptor = { ...f.descriptor, prepared: { ...f.reference, sha256: await sha256(bytes) } };
  await expect(loadPreparedCssObject(descriptor, { read: async () => bytes, readShared }).then(mount)).rejects.toThrow('UTF-8 JSON');
  expect(mount).not.toHaveBeenCalled();
});
