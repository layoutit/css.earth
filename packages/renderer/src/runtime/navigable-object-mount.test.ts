import { readFile } from 'node:fs/promises';
import { expect, test, vi } from 'vitest';
import { loadNavigableObject } from './navigable-object-mount.js';
import { prepareActivationGroups } from '../../../../tools/prepared/prepared-activation-groups.mts';
import { requireObjectRuntimeDefinition } from '../../../../tools/contract/object-runtime-contract.mts';
import { requirePreparedCssDescriptor } from '../prepared-object-decoder.js';
import { parsePreparedWorldCameraFrame } from '../validation/world-frame.js';
import { record } from '../validation/guards.js';
import type { ObjectMountOptions, ObjectRuntimeDefinition } from './object-runtime-types.js';

async function preparedFixture() {
  const descriptor = requirePreparedCssDescriptor(JSON.parse(await readFile(new URL('../../../../src/objects/venus/object.json', import.meta.url), 'utf8')));
  const envelope = record(JSON.parse(await readFile(new URL('../../../../src/objects/venus/prepared/object.json', import.meta.url), 'utf8')), 'prepared Venus fixture');
  const source = requireObjectRuntimeDefinition(envelope.data);
  // Retain the real tree and selections while keeping image decoding in its browser gate.
  const data = { ...source, assets: { ...source.assets, startup: [] }, materials: [],
    variants: source.variants.map(variant => ({ ...variant, required: [], materials: [],
      writes: [...variant.writes.map(write => write.kind === 'texture' ? { ...write, resource: null } : write),
        { kind: 'class' as const, target: -1, name: 'fixture-shadows', value: variant.when.shadows === true }] })) };
  const payload = { ...envelope, data: { ...data,
    tree: { ...data.tree, activationGroups: prepareActivationGroups(data) } } };
  return { descriptor, payload };
}

async function authenticateFixture({ descriptor, payload }: Awaited<ReturnType<typeof preparedFixture>>) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload)).buffer;
  return { descriptor, bytes };
}


test('preflight and native mount share one authenticated definition and transfer its resource ownership once', async () => {
  const { descriptor, bytes } = await authenticateFixture(await preparedFixture());
  const frame = parsePreparedWorldCameraFrame(descriptor.properties.worldFrame);
  if (!frame) throw new Error('Venus fixture needs its prepared world frame.');
  const read = vi.fn(async () => bytes), destroyed = vi.fn();
  const bind = vi.fn((definition: ObjectRuntimeDefinition, worldFrame: NonNullable<ReturnType<typeof parsePreparedWorldCameraFrame>>) => (_stage: HTMLElement, options: Pick<ObjectMountOptions, 'preparedResources'>) => {
    if (!options.preparedResources) throw new Error('Mount must receive preflight resources.');
    const resources = options.preparedResources.claim(definition.assets, {});
    expect(worldFrame.referenceFrame).toBe('sun-icrf');
    return { ready: Promise.resolve(), pause() {}, resume() {}, destroy() { resources.destroy(); destroyed(); },
      sharedView: { capture: () => null, restore: async () => false, subscribe: () => () => {} } };
  });
  const factory = await loadNavigableObject(descriptor, { read }, bind);
  expect(read).toHaveBeenCalledOnce();
  const signal = new AbortController();
  const prepared = await factory.navigation!.prepare({ signal: signal.signal, getView: () => ({
    world: { referenceFrame: 'sun-icrf', epochJdTt: frame.epochJdTt,
      pose: { positionM: [0, 0, 1e12], orientationXyzw: [0, 0, 0, 1] } },
    viewport: { focalPixels: 1000, principalOffsetPixels: [0, 0] },
  }) });
  expect(bind).not.toHaveBeenCalled();
  expect(prepared.definition.tree.activationGroups?.length).toBeGreaterThan(0);
  const mount = factory({} as HTMLElement, { preparedResources: prepared.resources });
  await mount.ready;
  expect(read).toHaveBeenCalledOnce();
  expect(bind.mock.calls[0][0]).toBe(prepared.definition);
  signal.abort(); prepared.resources.destroy();
  expect(destroyed).not.toHaveBeenCalled();
  mount.destroy();
  expect(destroyed).toHaveBeenCalledOnce();
});

test('authenticated transport without prepared activation groups fails before native binding', async () => {
  const fixture = await preparedFixture();
  const tree: { activationGroups?: readonly (readonly number[])[] } = fixture.payload.data.tree;
  delete tree.activationGroups;
  const { descriptor, bytes } = await authenticateFixture(fixture);
  const bind = vi.fn();
  await expect(loadNavigableObject(descriptor, { read: async () => bytes }, bind))
    .rejects.toThrow(/activation groups must be prepared/);
  expect(bind).not.toHaveBeenCalled();
});
