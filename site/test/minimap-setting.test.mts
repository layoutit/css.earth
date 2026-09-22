import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { createSpaceMinimapSetting } from '../minimap/minimap-setting.mts';
import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from '../../src/renderers/css/navigation/world-camera.js';

type Loader = NonNullable<Parameters<typeof createSpaceMinimapSetting>[2]>;
type Module = Awaited<ReturnType<Loader>>;
// The setting only passes these values through, so identity is all the test needs.
const world = (id: string) => ({ id }) as unknown as WorldCameraPose;
const viewport = (id: string) => ({ id }) as unknown as WorldCameraViewport;
const frame = (id: string) => ({ id }) as unknown as PreparedWorldCameraFrame;
const flush = () => new Promise<void>(resolve => setImmediate(resolve));

function harness() {
  const calls: unknown[][] = [], errors: unknown[] = [], documentTarget = {} as Document;
  let loads = 0, release: (module: Module) => void = () => {}, fail: (error: unknown) => void = () => {};
  const module: Module = { mountSpaceMinimap(target) {
    assert.equal(target, documentTarget);
    calls.push(['mount']);
    return { selectObject: value => { calls.push(['selectObject', value]); }, setHiddenBodies: ids => { calls.push(['setHiddenBodies', ids]); },
      publish: (pose, view) => { calls.push(['publish', pose, view]); }, destroy: () => { calls.push(['destroy']); } };
  } };
  const load: Loader = () => { loads++; return new Promise((resolve, reject) => { release = resolve; fail = reject; }); };
  const setting = createSpaceMinimapSetting(documentTarget, error => errors.push(error), load);
  return { setting, calls, errors, loads: () => loads, release: () => release(module), fail: (error: unknown) => fail(error) };
}

test('the minimap is not downloaded, built or projected while its setting is off', async () => {
  const h = harness();
  h.setting.selectObject(frame('earth')); h.setting.setHiddenBodies(['itokawa']);
  h.setting.publish(world('a'), viewport('a'));
  h.setting.setEnabled(false);
  await flush();
  assert.equal(h.loads(), 0); assert.deepEqual(h.calls, []);
  h.setting.destroy();
  assert.deepEqual(h.calls, []); assert.deepEqual(h.errors, []);
});

test('turning the setting on builds the minimap once with the current focus, hidden bodies and camera', async () => {
  const h = harness(), focus = frame('earth'), hidden = ['itokawa'], w = world('b'), v = viewport('b');
  h.setting.selectObject(frame('sun')); h.setting.selectObject(focus); h.setting.setHiddenBodies(hidden);
  h.setting.publish(world('a'), viewport('a'));
  h.setting.setEnabled(true); h.setting.setEnabled(true);
  h.setting.publish(w, v);
  assert.equal(h.loads(), 1); assert.deepEqual(h.calls, [], 'Nothing is drawn before the module arrives');
  h.release(); await flush();
  assert.deepEqual(h.calls, [['mount'], ['selectObject', focus], ['setHiddenBodies', hidden], ['publish', w, v]]);
  assert.deepEqual(h.errors, []);
});

test('off stops projection and keeps the mounted minimap; on draws the latest camera without another download', async () => {
  const h = harness(), w = world('c'), v = viewport('c'), focus = frame('mars');
  h.setting.setEnabled(true); h.release(); await flush();
  h.calls.length = 0;
  h.setting.setEnabled(false);
  h.setting.publish(world('b'), viewport('b')); h.setting.publish(w, v);
  h.setting.selectObject(focus); h.setting.setHiddenBodies([]);
  assert.deepEqual(h.calls, [['selectObject', focus], ['setHiddenBodies', []]], 'A hidden minimap is never projected');
  h.calls.length = 0;
  h.setting.setEnabled(true);
  assert.deepEqual(h.calls, [['publish', w, v]]); assert.equal(h.loads(), 1);
  h.setting.destroy(); h.setting.destroy();
  h.setting.publish(world('d'), viewport('d')); h.setting.setEnabled(false); h.setting.setEnabled(true);
  assert.deepEqual(h.calls, [['publish', w, v], ['destroy']]);
});

test('a world destroyed during the download never builds the minimap', async () => {
  const h = harness();
  h.setting.publish(world('a'), viewport('a')); h.setting.setEnabled(true);
  h.setting.destroy(); h.release(); await flush();
  assert.deepEqual(h.calls, []); assert.deepEqual(h.errors, []);
});

test('a failed download is reported and the next switch on tries again', async () => {
  const h = harness(), error = new Error('offline'), w = world('a'), v = viewport('a');
  h.setting.publish(w, v); h.setting.setEnabled(true);
  h.fail(error); await flush();
  assert.deepEqual(h.errors, [error]); assert.deepEqual(h.calls, []);
  h.setting.setEnabled(false); h.setting.setEnabled(true);
  assert.equal(h.loads(), 2);
  h.release(); await flush();
  assert.deepEqual(h.calls, [['mount'], ['setHiddenBodies', []], ['publish', w, v]]);
});
