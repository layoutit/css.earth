import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSceneLifetime } from '@cssearth/engine';
import { createApplicationWorldFrames } from './application-world-frames.mts';
import type { WorldFrameRequest } from '@cssearth/renderer/navigation/camera/world-frame-presenter.ts';

function fixture() {
  const lifetime = createSceneLifetime(), effects: unknown[] = [], callbacks = new Map<number, FrameRequestCallback>();
  let next = 0;
  const frames = createApplicationWorldFrames({ lifetime, heliosphereEnabled: () => true,
    layer: { opacityClock: { request(callback: FrameRequestCallback) { callbacks.set(++next, callback); return next; }, cancel(id: number) { callbacks.delete(id); } },
      captureFrame(world: WorldFrameRequest['world']) { return { view: world, current: () => true }; },
      publish(world: WorldFrameRequest['world'], viewport: WorldFrameRequest['viewport'], _frame: unknown, options: unknown) { effects.push(['publish', world, viewport, options]); },
      labelBudget: () => 'budget', setRotationActive: (active: boolean) => effects.push(['rotation', active]),
      setCoasting: (active: boolean) => effects.push(['coast', active]), setNavigationInFlight: (active: boolean) => effects.push(['flight', active]) },
    planner: { async plan() { return {}; } },
    moonLabels: { publish: (_world: unknown, _viewport: unknown, budget: unknown) => effects.push(['labels', budget]), setCoasting: (active: boolean) => effects.push(['label-coast', active]) },
    onFrame: (world: WorldFrameRequest['world']) => effects.push(['frame', world]),
  } as unknown as Parameters<typeof createApplicationWorldFrames>[0]);
  const request: WorldFrameRequest = { world: { referenceFrame: 'test', epochJdTt: 1, pose: { positionM: [0, 0, 10], orientationXyzw: [0, 0, 0, 1] } },
    viewport: { focalPixels: 100, principalOffsetPixels: [0, 0] }, current: () => true, commit: () => effects.push(['camera']), fail(error) { throw error; } };
  const paint = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); const pending = [...callbacks.values()]; callbacks.clear(); for (const callback of pending) callback(0); };
  return { frames, lifetime, effects, request, paint };
}

test('public controls forward their state and stop forwarding after lifetime disposal', () => {
  const f = fixture();
  f.frames.setRotationActive(true); f.frames.setCoasting(true); f.frames.setNavigationInFlight(true);
  assert.deepEqual(f.effects, [['rotation', true], ['coast', true], ['label-coast', true], ['flight', true]]);
  f.lifetime.destroy();
  f.frames.setRotationActive(false); f.frames.setCoasting(false); f.frames.setNavigationInFlight(false);
  assert.equal(f.effects.length, 4); assert.equal(f.frames.refresh(), false);
  f.frames.destroy();
});

test('enabled presenters publish the layer and labels before acknowledging the camera and notifying frame observers', async () => {
  const f = fixture(), presenter = f.frames.createFramePresenter(); presenter.enable();
  presenter.present(f.request); await f.paint();
  assert.deepEqual(f.effects, [['publish', f.request.world, f.request.viewport, { heliosphere: true }], ['labels', 'budget'], ['camera'], ['frame', f.request.world]]);
  f.effects.length = 0;
  const publication = presenter.present(f.request, new AbortController().signal); await f.paint();
  assert.equal(await publication, true); assert.equal(f.effects.length, 4);
  f.effects.length = 0;
  const direct = f.frames.present(f.request.world, f.request.viewport, { signal: new AbortController().signal, commit: () => f.effects.push(['direct']) });
  await f.paint(); assert.equal(await direct, true); assert.deepEqual(f.effects[2], ['direct']);
  f.frames.destroy();
});

test('cancelled, obsolete and destroyed presenters reject publication without acknowledging cameras', async () => {
  const f = fixture(), presenter = f.frames.createFramePresenter(), aborted = AbortSignal.abort();
  assert.equal(await presenter.present(f.request, aborted), false);
  assert.equal(presenter.present({ ...f.request, current: () => false }), undefined);
  presenter.destroy(); assert.equal(await presenter.present(f.request, new AbortController().signal), false);
  const other = f.frames.createFramePresenter(); f.lifetime.destroy(); other.enable(); assert.equal(other.warm(), false);
  assert.equal(await other.present(f.request, new AbortController().signal), false);
  await f.paint(); assert.deepEqual(f.effects, []); f.frames.destroy();
});

test('covered presenters acknowledge locally, warm pending cameras and publish them when enabled', async () => {
  const f = fixture(), presenter = f.frames.createFramePresenter();
  assert.equal(presenter.warm(), false);
  presenter.present(f.request);
  assert.deepEqual(f.effects, [['camera']], 'local camera is acknowledged before the world is enabled');
  assert.equal(presenter.warm(), true);
  await f.paint();
  assert.deepEqual(f.effects, [['camera']], 'warming cannot publish through the closed paint gate');
  presenter.enable(); await f.paint();
  assert.deepEqual(f.effects, [['camera'], ['publish', f.request.world, f.request.viewport, { heliosphere: true }], ['labels', 'budget'], ['camera'], ['frame', f.request.world]]);
  assert.equal(presenter.warm(), false);
  f.effects.length = 0; presenter.enable(); await f.paint(); assert.deepEqual(f.effects, []);
  f.frames.destroy();
});
