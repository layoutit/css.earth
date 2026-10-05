import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createPreparedWorldNavigation } from './prepared-world-navigation.mts';
import { CATEGORY_FRAMES, DATASET_VOLUMES, volumeZoomTarget } from './system-framing.mts';
import { navigationFixture, unusedSharedView, required } from './navigation/navigation-test-values.test-support.mts';
import { presentWorldCamera } from '@cssearth/renderer/navigation/world-camera.ts';
import { formatSharedView, savedWorldCamera } from '@cssearth/renderer/navigation';
import type { WorldCameraPose } from '@cssearth/engine';
import type { PreparedWorldCameraFrame } from '@cssearth/objects';
import type { SceneFactory } from './browser/browser-types.mts';
import type { ObjectPreparationView } from '@cssearth/renderer/runtime/prepared-object-navigation.ts';

// Inline frames use the existing navigation fixture; no body assets are restored or read.
function fixture(centers = new Map<string, { centerM: readonly [number, number, number]; separationM: number }>()) {
  const frames: PreparedWorldCameraFrame[] = [0, 1].map(index => ({ referenceFrame: 'world', epochJdTt: 1,
    originM: [index * 1e8, 0, 0], presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], metersPerUnit: 1, bodyRadiusM: 1000 }));
  const callbacks = new Map<number, FrameRequestCallback>(), documentTarget = new EventTarget();
  let next = 0, time = 0, destroyed = 0;
  let current: WorldCameraPose = { referenceFrame: 'world', epochJdTt: 1, pose: { positionM: [0, 0, 10000], orientationXyzw: [0, 0, 0, 1] } };
  const paints: WorldCameraPose[] = [], projections: ObjectPreparationView[] = [], resumed: number[] = [];
  const windowTarget = { performance: { now: () => time }, matchMedia: () => ({ matches: false }),
    requestAnimationFrame(callback: FrameRequestCallback) { callbacks.set(++next, callback); return next; },
    cancelAnimationFrame(id: number) { callbacks.delete(id); } };
  const navigation = { ...navigationFixture(frames[0], () => current, () => ({ focalPixels: 1000, principalOffsetPixels: [0, 0], widthPixels: 2000, heightPixels: 2000,
    framingRadiusPixels: 200, detailHandoffDiameterPixels: 14, visibleRect: null })),
    apply(world: WorldCameraPose) { current = world; paints.push(world); }, resumeZoom: (rate: number) => resumed.push(rate) };
  const resources = { destroy() { destroyed++; } };
  const factory = { navigation: { frame: frames[1], framingRadius: async () => 200,
    prepare: async (options: { getView(): ObjectPreparationView }) => {
      projections.push(options.getView());
      return { resources, destroy: () => resources.destroy(), prepareView: async () => {},
        projection(view: ObjectPreparationView) { projections.push(view); return undefined; } };
    } } } as unknown as SceneFactory;
  const objects = frames.map((worldFrame, index) => ({ id: String(index), worldFrame }));
  const service = createPreparedWorldNavigation({ objects, systemCenters: centers, systemViews: new Map(), systemViewHosts: new Set(), systemRadii: new Map(),
    windowTarget: windowTarget as unknown as Window, documentTarget: documentTarget as unknown as Document });
  const controller = new AbortController(), mount = { navigation, sharedView: unusedSharedView };
  return { service, controller, navigation, mount, objects, frames, factory, documentTarget, paints, projections, resumed,
    get pending() { return callbacks.size; }, get destroyed() { return destroyed; },
    tick(ms = 1000 / 60) { time += ms; const pending = [...callbacks.values()]; callbacks.clear(); for (const callback of pending) callback(time); },
    set(world: WorldCameraPose) { current = world; },
    prepare(options: Partial<Parameters<typeof service.prepare>[0]> = {}) { return service.prepare({ fromId: '0', toId: '1', fromMount: mount, toFactory: factory, signal: controller.signal, ...options }); },
  };
}
async function drain<T>(f: ReturnType<typeof fixture>, task: Promise<T>): Promise<T> {
  let done = false;
  void task.then(() => { done = true; }, () => { done = true; });
  for (let step = 0; step < 1000 && !done; step++) { await nextTurn(); f.tick(); }
  assert.equal(done, true, 'flight must settle within the bounded fake-clock drain');
  return task;
}

test('binary centre targets require a visible distant pair and preserve its range while centering', () => {
  const centers = new Map<string, { centerM: readonly [number, number, number]; separationM: number }>();
  const f = fixture(centers), request = { objectId: '0', fromId: '0', mount: f.mount };
  assert.equal(f.service.systemCenterTarget(request), null);
  centers.set('0', { centerM: [1000, 0, 0], separationM: 20000 });
  assert.equal(f.service.systemCenterTarget(request), null, 'close-up is not a pair overview');
  centers.set('0', { centerM: [1000, 0, 0], separationM: 100 });
  const target = required(f.service.systemCenterTarget(request));
  assert.deepEqual(target.focusPositionM, [1000, 0, 0]);
  const projection = presentWorldCamera(target.world, { ...f.frames[0], originM: target.focusPositionM }, f.navigation.optics());
  assert.ok(required(projection.centerPixels).every(value => Math.abs(value) < 1e-9));
  assert.ok(Math.abs(projection.distanceM - Math.hypot(1000, 10000)) < 1e-9);
  centers.set('0', { centerM: [0, 0, 0], separationM: 100 });
  assert.equal(f.service.systemCenterTarget(request), null, 'already centred');
  centers.set('0', { centerM: [0, 0, 20000], separationM: 100 });
  assert.equal(f.service.systemCenterTarget(request), null, 'pair behind the camera');
  assert.equal(f.service.systemCenterTarget({ ...request, mount: null }), null);
  assert.equal(f.service.systemCenterTarget({ ...request, objectId: 'missing' }), null); f.service.destroy();
});

test('saved targets reject missing, repeated, malformed and foreign epochs and restore a valid camera', () => {
  const f = fixture(), projection = presentWorldCamera(f.navigation.capture(), f.frames[0], f.navigation.optics());
  const saved = { preparedEpochJdTt: 1, playback: { times: [0], speed: 1, motionRequested: false },
    camera: { distanceKilometers: projection.distanceM / 1000, pose: { schema: 'cssearth-camera-pose@2' as const, scene: projection.sceneMatrix } } };
  const query = formatSharedView(saved), url = `https://offline.test/0/?${query}`;
  assert.deepEqual(f.service.savedTarget({ objectId: '0', url, mount: f.mount }), savedWorldCamera(saved, f.frames[0], f.navigation.optics()));
  for (const bad of ['https://offline.test/0/', 'https://offline.test/0/?v=bad', `${url}&${query}`,
    `https://offline.test/0/?${formatSharedView({ ...saved, preparedEpochJdTt: 2 })}`]) {
    assert.equal(f.service.savedTarget({ objectId: '0', url: bad, mount: f.mount }), null);
  }
  assert.equal(f.service.savedTarget({ objectId: '0', url }), null);
  assert.equal(f.service.savedTarget({ objectId: 'missing', url, mount: f.mount }), null); f.service.destroy();
});

test('category framing ignores absent owners and boxes, fits a prepared box and handles only cancellation errors', async () => {
  const f = fixture(), classification = required(CATEGORY_FRAMES.keys().next().value);
  const request = { classification, objectId: '0', mount: f.mount, signal: f.controller.signal, reducedMotion: true };
  await f.service.frameCategory({ ...request, mount: { sharedView: unusedSharedView } });
  await f.service.frameCategory({ ...request, classification: 'no-such-category' }); assert.deepEqual(f.paints, []);
  await drain(f, f.service.frameCategory(request));
  const box = required(CATEGORY_FRAMES.get(classification));
  assert.deepEqual(f.navigation.capture().pose.focusOffset?.originM, box.centre);
  const cancellation = new DOMException('cancelled category', 'AbortError');
  f.navigation.apply = () => { throw cancellation; };
  await drain(f, f.service.frameCategory(request));
  const failure = new Error('category publication failed'); f.navigation.apply = () => { throw failure; };
  await assert.rejects(drain(f, f.service.frameCategory(request)), error => error === failure); f.service.destroy();
});

test('preserved handoffs carry the last retiring camera, projection and live zoom rate to the new owner', async () => {
  const f = fixture(), shared: WorldCameraPose[] = [];
  const handoff = await f.prepare({ preserveView: true, presentWorld: world => { shared.push(world); } });
  assert.deepEqual(f.projections[0]?.world, f.navigation.capture());
  const retiring: WorldCameraPose = { ...f.navigation.capture(), pose: { positionM: [0, 0, 20000], orientationXyzw: [0, 0, 0, 1], focusOffset: { originM: [0, 0, 0], offsetM: [0, 0, 20000] } } };
  f.set(retiring);
  handoff.beforeRetire!({ ...f.navigation, zoomRate: () => .001 });
  assert.deepEqual(handoff.mountOptions.initialWorldCamera, retiring);
  assert.equal(handoff.mountOptions.initialProjection, undefined); assert.deepEqual(f.projections.at(-1)?.world, retiring);
  f.tick(100); await nextTurn();
  const carried = required(handoff.mountOptions.initialWorldCamera);
  assert.ok(Math.abs(carried.pose.positionM[2] - 20000 * Math.exp(.1)) < 1e-8);
  assert.equal(handoff.mountOptions.initialProjection, undefined); assert.deepEqual(f.projections.at(-1)?.world, carried);
  assert.equal(shared.length, 2); assert.deepEqual(shared.at(-1), carried);
  const mount = { ...f.mount, ready: Promise.resolve(), pause() {}, resume() {}, destroy() {} };
  await handoff.afterMount(mount);
  assert.deepEqual(f.paints, [carried]); assert.deepEqual(f.resumed, [.001]); assert.equal(f.pending, 0);
  const session = new AbortController(); handoff.transferTo(session.signal); f.controller.abort(); assert.equal(f.destroyed, 0);
  session.abort(); assert.equal(f.destroyed, 1); f.service.destroy();
});

test('preserved preparation failures release leases and stationary reduced-motion handoffs retain the retiring view', async () => {
  const f = fixture(), failure = new Error('lease decode failed');
  const factory = { navigation: { prepare: async () => { throw failure; } } } as unknown as SceneFactory;
  await assert.rejects(f.prepare({ preserveView: true, toFactory: factory }), error => error === failure);
  const handoff = await f.prepare({ preserveView: true, reducedMotion: true, presentWorld: () => { throw new Error('no reduced-motion carry'); } });
  const retiring = { ...f.navigation.capture(), projectionScale: 2 }; f.set(retiring);
  handoff.beforeRetire!({ ...f.navigation, zoomRate: () => .001 });
  assert.equal(handoff.mountOptions.initialWorldCamera, retiring); assert.equal(f.pending, 0);
  await assert.rejects(handoff.afterMount({ sharedView: unusedSharedView } as never), /destination camera is unavailable/);
  f.controller.abort(); assert.equal(f.destroyed, 1); f.service.destroy();
});

test('navigation validates frame compatibility, duplicate saved views and prepared handoff limits', async () => {
  const f = fixture();
  assert.equal(f.service.supports('0', 'missing'), false);
  assert.equal(f.service.centerTarget({ objectId: '0', fromId: '0' }), null);
  assert.equal(f.service.overviewTarget({ objectId: '0', fromId: '0', scope: 'unknown', mount: f.mount }), null);
  assert.equal(f.service.datasetVolumeTarget({ objectId: '0', volumeId: 'unknown', mount: f.mount }), null);
  await assert.rejects(f.prepare({ toId: 'missing' }), /Objects do not share a prepared world frame/);
  await assert.rejects(f.prepare({ fromMount: null }), /drawn world camera is not ready/);
  await assert.rejects(f.prepare({ url: 'https://offline.test/1/?v=a&v=b' }), /only one saved view/);
  f.navigation.optics = () => ({ focalPixels: 1000, principalOffsetPixels: [0, 0], framingRadiusPixels: 200, detailHandoffDiameterPixels: 0, visibleRect: null });
  await assert.rejects(drain(f, f.prepare()), /prepared detail handoff diameter/); f.service.destroy();
});

test('rejected flight publications do not acknowledge motion and unrelated key input does not cancel focus', async () => {
  const f = fixture(), original = f.navigation.apply;
  let attempts = 0;
  f.navigation.apply = world => { if (++attempts === 1) return Promise.resolve(false); original(world); };
  const timing: string[] = [], target = { ...f.navigation.capture(), projectionScale: 2 };
  const task = f.service.focus({ objectId: '0', mount: f.mount, signal: f.controller.signal, targetWorldCamera: target, timing: { mark: name => timing.push(name) } });
  void task.catch(() => {}); 
  const event = new Event('keydown'); Object.defineProperties(event, { key: { value: 'a' }, target: { value: { closest: () => true } } });
  f.documentTarget.dispatchEvent(event);
  f.tick(); await nextTurn(); assert.equal(f.paints.length, 0, 'false publication cannot become the acknowledged view');
  await drain(f, task);
  assert.equal(attempts, 99); assert.equal(f.paints.length, 98); assert.equal(f.navigation.capture().projectionScale, 2);
  assert.deepEqual(timing, Array<string>(97).fill('first-motion')); f.service.destroy();
});

test('a saved endpoint beside the source has no coarse departure interval and preparation errors retain identity', async () => {
  const f = fixture(), target = f.navigation.capture();
  const handoff = await drain(f, f.prepare({ targetWorldCamera: target }));
  assert.deepEqual(handoff.mountOptions.initialWorldCamera?.pose.positionM, target.pose.positionM);
  f.controller.abort(); assert.equal(f.destroyed, 1); f.service.destroy();
  const failed = fixture(), error = new Error('departure publication failed');
  failed.navigation.apply = () => { throw error; };
  await assert.rejects(drain(failed, failed.prepare()), failure => failure === error);
  assert.equal(failed.destroyed, 1); failed.service.destroy();
});

test('forced recentering stops exactly two body radii out', () => {
  const f = fixture(); f.set({ ...f.navigation.capture(), pose: { positionM: [0, 0, 500], orientationXyzw: [0, 0, 0, 1] } });
  const target = required(f.service.centerTarget({ objectId: '0', fromId: '0', mount: f.mount, force: true }));
  assert.equal(presentWorldCamera(target, f.frames[0], f.navigation.optics()).distanceM, 2000);
  assert.deepEqual(target.pose.positionM, [0, 0, 2000]); f.service.destroy();
});

test('a magnified dataset fits through normal optics and refuses another host', () => {
  const f = fixture();
  const banks = DATASET_VOLUMES as Map<string, { frame: Parameters<typeof volumeZoomTarget>[1]; host?: string }>;
  const volume = { referenceFrame: 'world', epochJdTt: 1, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1, boundsUnits: { min: [-1000, -1000, -1000], max: [1000, 1000, 1000] } } as const;
  banks.set('fixture-volume', { frame: volume, host: '0' });
  try {
    f.set({ ...f.navigation.capture(), projectionScale: 4 });
    f.navigation.optics = () => ({ focalPixels: 4000, projectionScale: 4, principalOffsetPixels: [0, 0], framingRadiusPixels: 200, detailHandoffDiameterPixels: 14, visibleRect: { left: -500, right: 500, top: -500, bottom: 500 } });
    const target = required(f.service.datasetVolumeTarget({ objectId: '0', volumeId: 'fixture-volume', mount: f.mount }));
    assert.deepEqual(target.focusPositionM, [0, 0, 0]);
    assert.equal(presentWorldCamera(target.world, f.frames[0], f.navigation.optics()).distanceM, 3212.3893805309735);
    assert.equal(f.service.datasetVolumeTarget({ objectId: '1', volumeId: 'fixture-volume', mount: f.mount }), null);
  } finally { banks.delete('fixture-volume'); f.service.destroy(); }
});
