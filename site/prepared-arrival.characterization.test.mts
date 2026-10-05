import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { createPreparedArrival } from './prepared-arrival.mts';
import type { SceneFactory } from './browser/browser-types.mts';
import type { ObjectPreparationView } from '@cssearth/renderer/runtime/prepared-object-navigation.ts';
import type { ObjectSceneLifecycle } from '@cssearth/renderer/runtime/object-scene.ts';

const view: ObjectPreparationView = { viewport: { focalPixels: 100, principalOffsetPixels: [0, 0] }, world: { referenceFrame: 'test', epochJdTt: 1, pose: { positionM: [0, 0, 1], orientationXyzw: [0, 0, 0, 1] } } };
function fixture(previousInert = false) {
  const effects: string[] = [], input = parseHTML('<div></div>').document.querySelector<HTMLElement>('div')!; input.inert = previousInert;
  const publications: unknown[][] = [];
  const cover = { destroy: () => effects.push('cover-destroy'), mounting: () => effects.push('mounting'), publish: (...args: unknown[]) => { publications.push(args); effects.push('cover-publish'); } };
  const request = new AbortController();
  const arrival = createPreparedArrival(request.signal, cover as unknown as NonNullable<Parameters<typeof createPreparedArrival>[1]>, () => effects.push('reveal'), input);
  const lease = { resources: { fixture: true }, tree: { fixture: true }, projection: () => ({ fixture: true }), destroy: () => effects.push('lease-destroy') };
  const factory = { navigation: { prepare: async () => lease } } as unknown as SceneFactory;
  return { effects, publications, input, request, arrival, factory, lease };
}

test('an arrival requires prepared navigation, prepares once and restores input after failed preparation', async () => {
  const f = fixture(); assert.equal(f.input.inert, true);
  assert.throws(() => f.arrival.handoff(() => view), /Arrival resources must be ready before mounting\./);
  await assert.rejects(f.arrival.prepare((() => { throw new Error("not mounted"); }) as SceneFactory, {} as never), /Destination has no prepared navigation\./);
  assert.equal(f.input.inert, false); assert.deepEqual(f.effects, ['cover-destroy']);
  await assert.rejects(f.arrival.prepare(f.factory, {} as never), /An arrival prepares its scene once\./);
});

test('afterMount orders camera publication, cover removal and hooks, preserving the prior inert state', async () => {
  const f = fixture(true); await f.arrival.prepare(f.factory, {} as never);
  const preserve: boolean[] = [], optics = { focalPixels: 123, principalOffsetPixels: [4, 5] }; 
  const mount = { navigation: { apply: () => { f.effects.push('apply'); }, capture: () => view.world, optics: () => optics },
    features: { setNavigationInFlight: (_active: boolean, value: boolean) => preserve.push(value) } } as unknown as ObjectSceneLifecycle;
  const handoff = f.arrival.handoff(() => view, {}, { beforePublish: () => f.effects.push('before'), afterPublish: async () => { f.effects.push('after'); } }, 'whole');
  assert.equal(handoff.mountOptions.preparedResources, f.lease.resources); assert.equal(handoff.mountOptions.preparedTree, f.lease.tree);
  assert.equal(handoff.mountOptions.initialWorldCamera, view.world); assert.equal(handoff.mountOptions.progressiveActivation, false);
  await handoff.afterMount(mount);
  assert.deepEqual(f.effects, ['mounting', 'before', 'apply', 'cover-publish', 'cover-destroy', 'reveal', 'after']); assert.deepEqual(preserve, [true]); assert.equal(f.input.inert, true);
  assert.deepEqual(f.publications, [[view.world, optics]]);
  f.arrival.dispose(); assert.equal(f.effects.filter(effect => effect === 'cover-destroy').length, 1);
  assert.equal(f.effects.filter(effect => effect === 'lease-destroy').length, 1);
  f.arrival.dispose(); assert.equal(f.effects.filter(effect => effect === 'lease-destroy').length, 1);
});

test('missing cameras and rejected publications remove the cover and preserve only explicitly marked failures', async () => {
  for (const preserveView of [false, true]) {
    const f = fixture(); await f.arrival.prepare(f.factory, {} as never);
    const failure = Object.assign(new Error('publication failed'), { preserveView }); const flags: boolean[] = [];
    const mount = { navigation: { apply: async () => { throw failure; } }, features: { setNavigationInFlight: (_active: boolean, preserve: boolean) => flags.push(preserve) } } as unknown as ObjectSceneLifecycle;
    await assert.rejects(f.arrival.handoff(() => view).afterMount(mount), error => error === failure);
    assert.deepEqual(flags, [preserveView]); assert.equal(f.input.inert, false); assert.ok(!f.effects.includes('reveal')); f.arrival.dispose();
  }
  const f = fixture(); await f.arrival.prepare(f.factory, {} as never);
  await assert.rejects(f.arrival.handoff(() => view).afterMount({} as ObjectSceneLifecycle), /The destination camera is unavailable\./); assert.equal(f.input.inert, false); f.arrival.dispose();
});

test('arrival ownership transfers lease disposal from the request to the mounted session', async () => {
  const f = fixture(); await f.arrival.prepare(f.factory, {} as never);
  const session = new AbortController();
  f.arrival.handoff(() => view).transferTo(session.signal);
  f.request.abort(); assert.ok(!f.effects.includes('lease-destroy'));
  session.abort(); assert.equal(f.effects.filter(effect => effect === 'lease-destroy').length, 1);
  assert.equal(f.input.inert, false);
});
