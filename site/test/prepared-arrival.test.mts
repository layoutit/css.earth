import assert from 'node:assert/strict';
import test from 'node:test';
import { createPreparedArrival } from '../prepared-arrival.mts';
import type { SceneFactory } from '../browser/browser-types.mts';
import type { ObjectSceneLifecycle } from '@cssearth/renderer/runtime/object-scene.ts';
import type { ObjectPreparationView } from '@cssearth/renderer/runtime/prepared-object-navigation.ts';

/** An arrival whose destination camera publication settles with `published`, after `beforeSettle` runs. */
async function arrive(published: boolean, beforeSettle: (arrival: ReturnType<typeof createPreparedArrival>, request: AbortController) => void = () => {}) {
  const request = new AbortController(), revealed: string[] = [], inFlight: [boolean, boolean][] = [];
  const arrival = createPreparedArrival(request.signal, null, () => revealed.push('reveal'));
  const lease = { resources: {}, tree: {}, projection: () => ({}), destroy() {} };
  const factory = { navigation: { prepare: async () => lease } } as unknown as SceneFactory;
  await arrival.prepare(factory, {} as never);
  const handoff = arrival.handoff(() => ({ world: {} } as ObjectPreparationView));
  const mount = {
    navigation: { apply: async () => { beforeSettle(arrival, request); return published; }, capture: () => ({}), optics: () => ({}) },
    features: { setNavigationInFlight: (active: boolean, preserve: boolean) => inFlight.push([active, preserve]) },
  } as unknown as ObjectSceneLifecycle;
  const settled = await handoff.afterMount(mount).then(() => 'done', (error: unknown) => error instanceof Error ? error.name : String(error));
  return { settled, revealed, inFlight };
}

test('an arrival whose camera view the reader replaced by input still reveals the destination', async () => {
  // A drag or zoom during the arrival replaces its pending view (world-frame-queue.ts): the publication settles false.
  assert.deepEqual(await arrive(false), { settled: 'done', revealed: ['reveal'], inFlight: [[false, true]] });
});

test('an arrival cancelled while its camera publishes fails without revealing', async () => {
  const result = await arrive(false, (_arrival, request) => request.abort());
  assert.equal(result.settled, 'AbortError');
  assert.deepEqual(result.revealed, []);
});

test('an acknowledged arrival reveals once', async () => {
  assert.deepEqual((await arrive(true)).revealed, ['reveal']);
});

test('an arrival paces its texture activation unless its caller is a covered, stationary startup', async () => {
  const lease = { resources: {}, tree: {}, projection: () => ({}), destroy() {} };
  const factory = { navigation: { prepare: async () => lease } } as unknown as SceneFactory;
  const view = () => ({ world: {} } as ObjectPreparationView);
  for (const [activation, paced] of [[undefined, true], ['paced', true], ['whole', false]] as const) {
    const arrival = createPreparedArrival(new AbortController().signal);
    await arrival.prepare(factory, {} as never);
    // A flight's own options never switch the pacing off.
    assert.equal(arrival.handoff(view, { progressiveActivation: false }, {}, activation).mountOptions.progressiveActivation, paced);
  }
});
