import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { preparedObjectText } from '@cssearth/objects/node';
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parseObjectDescriptor } from '@cssearth/objects';
import { loadPreparedCssObject } from './loader.js';

const root = new URL('../../../', import.meta.url);
async function fixture(id = 'venus') {
  const descriptor = parseObjectDescriptor(await readFile(new URL(`src/objects/${id}/object.json`, root), 'utf8'));
  if (!descriptor.prepared) throw new Error('Fixture requires its prepared reference.');
  const bytes = new TextEncoder().encode(await preparedObjectText(fileURLToPath(new URL(`src/objects/${descriptor.id}/`, root)), descriptor)).buffer;
  const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!isRecord(payload)) throw new Error('Fixture envelope must be a record.');
  return { descriptor, reference: descriptor.prepared, bytes, payload };
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
async function changedPayload(value: unknown) {
  const f = await fixture(), bytes = new TextEncoder().encode(JSON.stringify(value)).buffer;
  return { descriptor: { ...f.descriptor, prepared: f.reference }, bytes };
}

for (const id of ['mercury']) test(`${id} loads its actual prepared JSON through the shared decoder`, async () => {
  const f = await fixture(id), read = mock.fn(async () => f.bytes);
  const definition = await loadPreparedCssObject(f.descriptor, { read });
  assert.equal(read.mock.callCount(), 1); assert.deepEqual(read.mock.calls[0]!.arguments, [f.reference.url]);
  assert.equal(definition.id, id);
  assert.ok(definition.tree.nodes.length > 100);
  assert.ok((definition.controls.datasets?.controls.length ?? 0) > 1);
  assert.ok(definition.assets.startup.length > 0);
});

for (const field of ['id', 'type', 'format', 'schema']) test(`an authenticated mismatched envelope ${field} fails before mount`, async () => {
  const f = await fixture(), changed = await changedPayload({ ...f.payload, [field]: 'other' }), mount = mock.fn(() => {});
  await assert.rejects(loadPreparedCssObject(changed.descriptor, { read: async () => changed.bytes }).then(mount), /does not match/);
  assert.equal(mount.mock.callCount(), 0);
});

test('the decoded CSS definition must match the descriptor as well as its envelope', async () => {
  const f = await fixture();
  if (!isRecord(f.payload.data)) throw new Error('Fixture requires a CSS definition.');
  const changed = await changedPayload({ ...f.payload, data: { ...f.payload.data, id: 'different' } }), mount = mock.fn(() => {});
  await assert.rejects(loadPreparedCssObject(changed.descriptor, { read: async () => changed.bytes }).then(mount), /does not match object venus/);
  assert.equal(mount.mock.callCount(), 0);
});

test('missing preparation, unknown object type and unsupported format never request or bake data', async () => {
  const f = await fixture(), read = mock.fn(async () => f.bytes);
  const { prepared: _prepared, ...unprepared } = f.descriptor;
  for (const descriptor of [unprepared, { ...f.descriptor, type: 'unknown' },
    { ...f.descriptor, prepared: { ...f.reference, format: 'other-artifact@1' } }]) {
    await assert.rejects(loadPreparedCssObject(descriptor, { read }));
  }
  assert.equal(read.mock.callCount(), 0);
});

test('transport failure stays a failed load with no runtime preparation fallback', async () => {
  const f = await fixture(), mount = mock.fn(() => {});
  await assert.rejects(loadPreparedCssObject(f.descriptor, { read: async () => { throw new Error('asset unavailable'); } }).then(mount), /asset unavailable/);
  assert.equal(mount.mock.callCount(), 0);
});

test('cancellation reaches the transport and an already-cancelled load cannot read bytes', async () => {
  const f = await fixture(), controller = new AbortController();
  let received: AbortSignal | undefined;
  const read = mock.fn((_url: string, signal?: AbortSignal) => new Promise<ArrayBuffer>((_resolve, reject) => {
    received = signal;
    signal!.addEventListener('abort', () => reject(signal!.reason), { once: true });
  }));
  const loading = loadPreparedCssObject(f.descriptor, { read }, { signal: controller.signal });
  assert.equal(received, controller.signal);
  controller.abort();
  await assert.rejects(loading, { name: 'AbortError' });
  await assert.rejects(loadPreparedCssObject(f.descriptor, { read }, { signal: controller.signal }), { name: 'AbortError' });
  assert.equal(read.mock.callCount(), 1);
});

test('authenticated invalid UTF-8 JSON fails before the renderer can mount', async () => {
  const f = await fixture(), bytes = new Uint8Array([0xff]).buffer, mount = mock.fn(() => {});
  const descriptor = { ...f.descriptor, prepared: f.reference };
  await assert.rejects(loadPreparedCssObject(descriptor, { read: async () => bytes }).then(mount), /UTF-8 JSON/);
  assert.equal(mount.mock.callCount(), 0);
});
