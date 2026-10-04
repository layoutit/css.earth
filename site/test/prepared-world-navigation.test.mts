import { sourceTest } from '@cssearth/objects/node/source-test';
import { readSystemViewFile } from './system-view-file.mts';
const test = sourceTest();
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { parseHTML } from 'linkedom';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createSelectionFlight, sampleSelectionFlight, createSelectionFlightSample, advanceSelectionFlightInto, type WorldCameraPose } from '@cssearth/engine';
import { createWorldSelectionTarget, formatSharedView, savedWorldCamera } from '@cssearth/renderer/navigation';
import { presentWorldCamera } from '@cssearth/renderer/navigation/world-camera.ts';
import { createPreparedWorldNavigation } from '../prepared-world-navigation.mts';

import { required, position, navigationFixture, unusedSharedView } from './navigation-test-values.mts';
import { type PreparedWorldCameraFrame, type PreparedArrivalView } from '@cssearth/objects';
import type { WorldCameraPresentation } from '@cssearth/renderer/navigation/world-camera.ts';
import type { ObjectWorldNavigation } from '@cssearth/renderer/runtime/world-navigation-types.ts';
import type { ObjectSceneLifecycle } from '@cssearth/renderer/runtime/object-scene.ts';
import type { ObjectPreparationView } from '@cssearth/renderer/runtime/prepared-object-navigation.ts';
import type { SceneFactory } from '../browser/browser-types.mts';
import type { WorldHandoff } from '../prepared-world-navigation.mts';
import { SYSTEM_VIEW_HOSTS, loadSystemView } from '../system-framing.mts';
// System framing's candidates load after the first body mounts in the app; these tests need them loaded.
await Promise.all([...SYSTEM_VIEW_HOSTS].map(id => loadSystemView(id, readSystemViewFile)));
type Mutable<T> = { -readonly [K in keyof T]: T[K] };
type Resources = { destroyed: number; destroy(): void };
type MockLease = { resources: Resources; destroy(): void; projection(): undefined; prepareView(getView: () => ObjectPreparationView): Promise<void> };
type MockPreparation = { frame: Mutable<PreparedWorldCameraFrame>; framingRadius(): Promise<number>; framingScale(): Promise<number>; prepare(options: { getView(): ObjectPreparationView }): Promise<MockLease> };
type MockFactory = { navigation: MockPreparation };
type PrepareOptions = Omit<Partial<Parameters<ReturnType<typeof createPreparedWorldNavigation>['prepare']>[0]>, 'toFactory'> & { toFactory?: MockFactory | Promise<MockFactory> };
type MockNavigation = Omit<ObjectWorldNavigation, 'frame'> & { frame: Mutable<PreparedWorldCameraFrame> };
const lifecycle = { ready: Promise.resolve(), sharedView: unusedSharedView, pause() {}, resume() {}, destroy() {} } satisfies Omit<ObjectSceneLifecycle, 'navigation'>;
/** CSS presentation to a right-handed reference: a reflection. */
const identity = [1,0,0,0,-1,0,0,0,1] as const;
function fixtureFactory(arrival?: PreparedArrivalView) {
  const frames: Mutable<PreparedWorldCameraFrame>[] = [0, 1].map(index => ({ referenceFrame: 'world', epochJdTt: 1,
    originM: [index * 1e8, 0, 0], presentationToReference: identity, metersPerUnit: 1, bodyRadiusM: 1000,
    orbitUpReference: [0,1,0] }));
  const objects = frames.map((worldFrame, index) => ({ id: String(index), worldFrame,
    ...(arrival && index === 1 ? { discovery: { featured: true, imagery: true, illustration: false, arrival } } : {}) }));
  const callbacks = new Map<number, FrameRequestCallback>(), documentTarget = new EventTarget();
  let next = 0, time = 0;
  let current: WorldCameraPose = { referenceFrame: 'world', epochJdTt: 1,
    pose: { positionM: [0,0,10000], orientationXyzw: [0,0,0,1] } };
  const paints: WorldCameraPose[] = [], resources = { destroyed: 0, destroy() { this.destroyed++; } };
  const windowTarget = { performance: { now: () => time }, matchMedia: () => ({ matches: true }), requestAnimationFrame(fn: FrameRequestCallback) { callbacks.set(++next, fn); return next; },
    cancelAnimationFrame(id: number) { callbacks.delete(id); } };
  const navigation: MockNavigation = { ...navigationFixture(frames[0], () => current, () => { throw new Error("optics overridden"); }), frame: frames[0], capture: () => current,
    optics: () => ({ focalPixels: 1000, principalOffsetPixels: [0,0], widthPixels: 2000, heightPixels: 2000,
      framingRadiusPixels: 200, detailHandoffDiameterPixels: 14, visibleRect: null }),
    apply(value) { current = value; paints.push(value); } };
  const factory: MockFactory = { navigation: { frame: frames[1], framingRadius: async () => 200, framingScale: async () => 1, prepare: async () => ({ resources, destroy: () => resources.destroy(), projection: () => undefined, prepareView: async () => {} }) } };
  const service = createPreparedWorldNavigation({ objects, windowTarget: windowTarget as unknown as Window, documentTarget: documentTarget as unknown as Document });
  const controller = new AbortController();
  return { service, controller, resources, navigation, factory, paints, documentTarget, windowTarget,
    start({ toFactory = factory, ...options }: PrepareOptions = {}) { return service.prepare({ fromId: '0', toId: '1', fromMount: { sharedView: unusedSharedView, navigation },
      toFactory: toFactory as unknown as SceneFactory | Promise<SceneFactory>, signal: controller.signal, reducedMotion: false, ...options }); },
    mounted(): ObjectSceneLifecycle & { navigation: MockNavigation } { return { ...lifecycle, navigation: { ...navigation, frame: frames[1] } }; },
    tick(value: number) { time = value; const entries = [...callbacks.values()]; callbacks.clear(); for (const fn of entries) fn(time); },
    step(milliseconds = 1000 / 60) { this.tick(time + milliseconds); },
    input() { const event = new Event('pointerdown', { cancelable: true }); Object.defineProperty(event, 'target', { value: { closest: () => true } }); documentTarget.dispatchEvent(event); return event; },
    escape() { const event = new Event('keydown', { cancelable: true }); Object.defineProperties(event, { target: { value: { closest: () => true } }, key: { value: 'Escape' } }); documentTarget.dispatchEvent(event); return event; },
    wheel() { const event = new Event('wheel', { cancelable: true }); Object.defineProperty(event, 'target', { value: { closest: () => true } }); documentTarget.dispatchEvent(event); return event; },
    get pending() { return callbacks.size; } };
}
function assertFlightInputReleased(f: ReturnType<typeof fixtureFactory>) {
  for (const name of ['pointerdown', 'keydown']) assert.equal(getEventListeners(f.documentTarget, name).length, 0);
  assert.equal(getEventListeners(f.documentTarget, 'wheel').length, 1, 'The navigation owner retains one native wheel listener');
  assert.equal(f.wheel().defaultPrevented, false, 'A settled or cancelled flight no longer intercepts wheel input');
}

function deferred<T = void>() {
  let complete: ((value: T) => void) | undefined;
  const promise = new Promise<T>(done => { complete = done; });
  return { promise, resolve(value: T) { required(complete)(value); } };

}
function drainFrames<T>(fixture: ReturnType<typeof fixtureFactory>, options: { task: Promise<T>; stepMs?: number }): Promise<T>;
function drainFrames(fixture: ReturnType<typeof fixtureFactory>, options?: { stepMs?: number }): Promise<void>;
async function drainFrames<T>(fixture: ReturnType<typeof fixtureFactory>, { task, stepMs = 1000 / 60 }: { task?: Promise<T>; stepMs?: number } = {}): Promise<T | undefined> {
  let settled = false, value: T | undefined, failure: unknown;
  task?.then(result => { settled = true; value = result; }, error => { settled = true; failure = error; });
  for (let frame = 0; frame <= 1000; frame++) {
    // Let preparation and owner-handoff promises settle between actual paints.
    await nextTurn();
    if (settled) { if (failure) throw failure; return value; }
    if (!fixture.pending) {
      assert.equal(task, undefined, 'Flight became idle before its requested task settled.');
      return;
    }
    assert.ok(frame < 1000, 'Flight exceeded the bounded 1000-frame drain.');
    fixture.step(stepMs);
  }
}
const range = (pose: WorldCameraPose["pose"], origin: readonly number[]) => Math.hypot(...pose.positionM.map((value, axis) => value - origin[axis]));

const photographicArrival: PreparedArrivalView = { defaultDataset: 'photo', datasetIds: ['photo'], rotation: [1,0,0,0,-1,0,0,0,-1] };

test('billboard covers attachment at the final viewport framing with no second camera flight', async () => {
  const arrival: PreparedArrivalView = { ...photographicArrival, billboard: {
    url: '/scenes/body/arrival.webp', dataset: 'photo', size: 1024, distanceM: 8000,
    focalPixels: 1000, rotation: photographicArrival.rotation } };
  const f = fixtureFactory(arrival), { document, window } = parseHTML('<html><body><div class="object-input-surface"><main></main></div></body></html>');
  Object.defineProperty(window.HTMLImageElement.prototype, 'decode', { configurable: true, value: async () => {} });
  Object.defineProperty(document, 'defaultView', { value: f.windowTarget });
  const stage = document.querySelector('main');
  assert.ok(stage);
  const surface = document.querySelector<HTMLElement>('.object-input-surface');
  assert.ok(surface);
  const target = createWorldSelectionTarget(f.navigation.capture(), f.factory.navigation.frame, f.navigation.optics());
  assert.ok(target);
  const handoff = await drainFrames(f, { task: f.start({ stage }) });
  assert.equal(handoff.mountOptions.progressiveActivation, true);
  assert.equal(surface.inert, true);
  const initial = required(handoff.mountOptions.initialWorldCamera);
  const expected = presentWorldCamera(target, f.factory.navigation.frame, f.navigation.optics());
  const mountedProjection = presentWorldCamera(initial, f.factory.navigation.frame, f.navigation.optics());
  assert.ok(Math.abs(mountedProjection.distanceM - arrival.billboard!.distanceM) < 0.01);
  assert.ok(Math.abs(mountedProjection.silhouette!.tangentialSemiAxis - expected.silhouette!.tangentialSemiAxis) < 0.01);
  assert.equal(document.querySelector('img')?.dataset.arrivalBillboard, 'mounting');
  const arrived = f.paints.length;
  const mount = f.mounted(), publication = deferred<boolean>(), apply = mount.navigation.apply;
  mount.navigation.apply = (world, options) => { apply(world, options); return publication.promise; };
  const heldTransform = document.querySelector('img')?.style.transform;
  mount.navigation.subscribe = () => { throw new Error('The billboard must not consume stage-coordinate publications.'); };
  handoff.mountOptions.onNavigationReady?.(mount.navigation);
  assert.equal(document.querySelector('img')?.style.transform, heldTransform, 'attachment cannot reposition the held cover');
  const completion = handoff.afterMount(mount);
  await nextTurn();
  f.step(5000); await nextTurn();
  assert.equal(document.querySelector('img')?.style.opacity, '1', 'elapsed time cannot reveal an unacknowledged mesh');
  assert.equal(f.input().defaultPrevented, true, 'the covered destination cannot start a drag');
  assert.equal(f.wheel().defaultPrevented, true, 'the covered destination cannot zoom');
  assert.equal(document.querySelector('img')?.dataset.arrivalBillboard, 'mounting');
  publication.resolve(true); await nextTurn();
  assert.equal(document.querySelector('img'), null, 'the acknowledged destination reveals at the original fly-to boundary');
  await drainFrames(f, { task: completion });
  assert.equal(surface.inert, false);
  surface.inert = true; // A newer arrival owns the input lock now.
  f.controller.abort();
  assert.equal(surface.inert, true, 'late cleanup cannot unlock the next arrival');
  assert.equal(document.querySelector('img'), null);
  for (const camera of f.paints.slice(arrived)) {
    closePose(camera.pose, initial.pose);
    assert.equal(camera.projectionScale, initial.projectionScale);
  }
  const actual = presentWorldCamera(f.navigation.capture(), f.factory.navigation.frame, f.navigation.optics());
  assert.ok(Math.abs(actual.distanceM - arrival.billboard!.distanceM) < 0.01);
});

test('billboard arrival converges its projected size before completing across viewports', async () => {
  const arrival: PreparedArrivalView = { ...photographicArrival, billboard: {
    url: '/scenes/body/arrival.webp', dataset: 'photo', size: 1024, distanceM: 8000,
    focalPixels: 1000, rotation: photographicArrival.rotation } };
  for (const [widthPixels, heightPixels, framingRadiusPixels] of [[390, 844, 100], [820, 1180, 240], [1440, 900, 300]]) {
    for (const hz of [60, 120]) {
      const f = fixtureFactory(arrival), { document, window } = parseHTML('<html><body><main></main></body></html>');
      Object.defineProperty(window.HTMLImageElement.prototype, 'decode', { configurable: true, value: async () => {} });
      Object.defineProperty(document, 'defaultView', { value: f.windowTarget });
      const optics = { ...f.navigation.optics(), widthPixels, heightPixels, framingRadiusPixels };
      f.navigation.optics = () => optics;
      f.factory.navigation.framingRadius = async () => framingRadiusPixels;
      await drainFrames(f, { task: f.start({ stage: required(document.querySelector('main')) }), stepMs: 1000 / hz });
      const radii = f.paints.map(world => required(presentWorldCamera(world, f.factory.navigation.frame, optics).silhouette).tangentialSemiAxis);
      const finalStep = Math.abs(required(radii.at(-1)) - required(radii.at(-2)));
      assert.ok(finalStep < 0.25, `${widthPixels}x${heightPixels} at ${hz} Hz snaps the final edge by ${finalStep.toFixed(3)} px`);
      assert.ok(Math.abs(required(radii.at(-1)) - framingRadiusPixels) < 0.01, 'arrival retains its prepared responsive fit');
      f.controller.abort();
      await nextTurn();
    }
  }
});

test('a stationary camera with unfinished optical zoom does not complete early', async () => {
  const f = fixtureFactory(), from = f.navigation.capture();
  const target = { ...from, projectionScale: 2 };
  await drainFrames(f, { task: f.service.focus({ objectId: '0', mount: { ...lifecycle, navigation: f.navigation },
    signal: f.controller.signal, targetWorldCamera: target }) });
  const scales = f.paints.map(world => world.projectionScale ?? 1);
  assert.ok(scales.length > 2, 'a zoom-only flight must publish intermediate views');
  assert.equal(scales[0], 1);
  assert.equal(scales.at(-1), 2);
  assert.ok(2 / required(scales.at(-2)) - 1 < 0.001, 'the final optical step must also be visually negligible');
});

test('cross-object arrival uses the destination framing allowance', async () => {
  const f = fixtureFactory(photographicArrival);
  f.factory.navigation.framingRadius = async () => 100;
  const cameraViewport = { read() { throw new Error('The destination owns viewport measurement'); },
    subscribe() { return () => {}; }, invalidate() {}, destroy() {} };
  const handoff = await drainFrames(f, { task: f.start({ cameraViewport }) });
  const mount = f.mounted();
  handoff.mountOptions.onNavigationReady?.(mount.navigation);
  await drainFrames(f, { task: handoff.afterMount(mount) });
  const arrived = presentWorldCamera(mount.navigation.capture(), f.factory.navigation.frame, f.navigation.optics());
  assert.ok(Math.abs(arrived.silhouette!.tangentialSemiAxis - 100) < 1e-6,
    'the destination fit replaces the departing body\'s 200-pixel allowance');
});

test('scene selection and cross-object flight use the prepared photographic face', async () => {
  const f = fixtureFactory(photographicArrival), frame = f.factory.navigation.frame, optics = f.navigation.optics();
  const target = required(f.service.systemTarget({ objectId: '1', fromId: '0', mount: { ...lifecycle, navigation: f.navigation } }));
  presentWorldCamera(target, frame, optics).rotation.forEach((value, index) => assert.ok(Math.abs(value - photographicArrival.rotation[index]) < 1e-12));
  const handoff = await drainFrames(f, { task: f.start() });
  const mount = f.mounted();
  handoff.mountOptions.onNavigationReady?.(mount.navigation);
  await drainFrames(f, { task: handoff.afterMount(mount) });
  const arrived = presentWorldCamera(mount.navigation.capture(), frame, optics);
  arrived.rotation.forEach((value, index) => assert.ok(Math.abs(value - photographicArrival.rotation[index]) < 1e-12));
  assert.ok(required(arrived.centerPixels).every(value => Math.abs(value) < 1e-6));
});

test('saved views and explicit non-photographic datasets keep their requested direction', async () => {
  for (const dataset of ['shape', 'photo']) {
    const f = fixtureFactory(photographicArrival), frame = f.factory.navigation.frame, optics = f.navigation.optics();
    const target = createWorldSelectionTarget(f.navigation.capture(), frame, optics);
    const projection = presentWorldCamera(target, frame, optics);
    const saved = formatSharedView({ preparedEpochJdTt: frame.epochJdTt,
      playback: { times: [0], speed: 1, motionRequested: false },
      camera: { distanceKilometers: projection.distanceM / 1000,
        pose: { schema: 'cssearth-camera-pose@2', scene: projection.sceneMatrix } } });
    const url = `https://example.test/1/?dataset=${dataset}${dataset === 'photo' ? `&${saved}` : ''}`;
    const handoff = await drainFrames(f, { task: f.start({ url }) });
    assert.equal(handoff.mountOptions.progressiveActivation, true, 'saved views without a photographic cover still pace activation');
    const mount = f.mounted();
    handoff.mountOptions.onNavigationReady?.(mount.navigation);
    await drainFrames(f, { task: handoff.afterMount(mount) });
    closePose(mount.navigation.capture().pose, target.pose);
  }
});

test('a prepared photographic angle never rotates a system overview or an explicit target', async () => {
  const f = fixtureFactory(photographicArrival), from = f.navigation.capture();
  const system = required(f.service.systemTarget({ objectId: '1', fromId: '0', mount: { ...lifecycle, navigation: f.navigation }, force: true }));
  assert.deepEqual(system.pose.orientationXyzw, from.pose.orientationXyzw);
  const target = required(f.service.centerTarget({ objectId: '1', fromId: '0', mount: { ...lifecycle, navigation: f.navigation }, force: true }));
  assert.deepEqual(target.pose.orientationXyzw, from.pose.orientationXyzw);
  const handoff = await drainFrames(f, { task: f.start({ targetWorldCamera: target }) });
  const mount = f.mounted();
  handoff.mountOptions.onNavigationReady?.(mount.navigation);
  await drainFrames(f, { task: handoff.afterMount(mount) });
  closePose(mount.navigation.capture().pose, target.pose);
});

test('a falsy camera publication failure rejects and releases native flight listeners', async () => {
  for (const failure of [null, undefined, false, 0, '']) {
    const f = fixtureFactory();
    f.navigation.apply = () => { throw failure; };
    const task = f.service.focus({ objectId: '0', mount: { sharedView: unusedSharedView, navigation: f.navigation }, signal: f.controller.signal });
    const rejected = assert.rejects(task, error => Object.is(error, failure));
    f.tick(0);
    await rejected;
    assert.equal(f.pending, 0);
    assert.equal(getEventListeners(f.controller.signal, 'abort').length, 0);
    assertFlightInputReleased(f);
  }
});

test('a terminal extreme-range pose finishes without a tail of identical publications', async () => {
  const f = fixtureFactory();
  f.navigation.frame.bodyRadiusM = 695700000;
  f.navigation.apply({ referenceFrame: 'world', epochJdTt: 1,
    pose: { positionM: [0, 0, 2.4809028e21], orientationXyzw: [0, 0, 0, 1] } });
  const from = f.navigation.capture();
  const target = createWorldSelectionTarget(from, f.navigation.frame, f.navigation.optics());
  await drainFrames(f, { task: f.service.focus({ objectId: '0', mount: { sharedView: unusedSharedView, navigation: f.navigation }, signal: f.controller.signal }) });
  assert.deepEqual(required(f.paints.at(-1)).pose, target.pose);
  const terminal = f.paints.filter(world => JSON.stringify(world.pose) === JSON.stringify(target.pose));
  assert.equal(terminal.length, 1, 'one terminal publication, with no dead flight tail');
  assert.equal(f.pending, 0);
});

test('a long fly-to ends once its remaining approach no longer moves the body on screen', async () => {
  const f = fixtureFactory(), frame = f.navigation.frame, optics = f.navigation.optics();
  f.navigation.apply({ referenceFrame: 'world', epochJdTt: 1, pose: { positionM: [0, 0, 2.3e9], orientationXyzw: [0, 0, 0, 1] } });
  f.paints.length = 0;
  const target = createWorldSelectionTarget(f.navigation.capture(), frame, optics);
  await drainFrames(f, { task: f.service.focus({ objectId: '0', mount: { sharedView: unusedSharedView, navigation: f.navigation }, signal: f.controller.signal }) });
  assert.deepEqual(required(f.paints.at(-1)).pose, target.pose, 'The flight still ends on its exact target');
  // Pixel oracle: how far each publication still draws the body from where it finally rests.
  const shown = f.paints.map(world => presentWorldCamera(world, frame, optics)), final = required(shown.at(-1));
  const offset = (view: typeof final) => view.silhouette && view.centerPixels && final.silhouette && final.centerPixels
    ? Math.max(Math.abs(view.centerPixels[0] - final.centerPixels[0]), Math.abs(view.centerPixels[1] - final.centerPixels[1]),
      Math.abs(view.silhouette.radialSemiAxis - final.silhouette.radialSemiAxis), Math.abs(view.silhouette.tangentialSemiAxis - final.silhouette.tangentialSemiAxis))
    : Infinity;
  let settled = shown.length - 1;
  while (settled > 0 && offset(required(shown[settled - 1])) <= 0.25) settled--;
  assert.ok(shown.length - 1 - settled <= 30, `${shown.length - 1 - settled} of ${shown.length} publications drew the body within a quarter pixel of its resting place`);
});

test('a short center selection slows into its target instead of stopping at full speed', async () => {
  const f = fixtureFactory(), frame = f.navigation.frame, optics = f.navigation.optics();
  f.navigation.apply({ referenceFrame: 'world', epochJdTt: 1, pose: { positionM: [0, 0, 2.3e9], orientationXyzw: [0, 0, 0, 1] } });
  f.paints.length = 0;
  const target = createWorldSelectionTarget(f.navigation.capture(), frame, optics);
  await drainFrames(f, { task: f.service.focus({ objectId: '0', mount: { sharedView: unusedSharedView, navigation: f.navigation },
    signal: f.controller.signal, targetWorldCamera: target, centerSelection: true }) });
  assert.deepEqual(required(f.paints.at(-1)).pose, target.pose, 'The flight still ends on its exact target');
  // Pixel oracle: how far the drawn body edge moves between publications.
  const radii = f.paints.map(world => presentWorldCamera(world, frame, optics).silhouette?.tangentialSemiAxis ?? 0);
  const steps = radii.slice(1).map((radius, index) => Math.abs(radius - required(radii[index])));
  assert.ok(Math.max(...steps.slice(-5)) <= 5, `the last five publications moved the body edge by up to ${Math.max(...steps.slice(-5)).toFixed(1)} px`);
});

test('small bodies and planets grow through a readable close-up at both 60 and 120 Hz', async () => {
  for (const radiusM of [1000, 9948, 300000, 6051840, 24764000]) {
    const durations: number[] = [];
    for (const hz of [60, 120]) {
      const f = fixtureFactory(), frame = f.navigation.frame, optics = f.navigation.optics();
      frame.bodyRadiusM = radiusM;
      f.navigation.apply({ referenceFrame: 'world', epochJdTt: 1,
        pose: { positionM: [0, 0, 2e13], orientationXyzw: [0, 0, 0, 1] } });
      f.paints.length = 0;
      const target = createWorldSelectionTarget(f.navigation.capture(), frame, optics);
      await drainFrames(f, { stepMs: 1000 / hz, task: f.service.focus({ objectId: '0',
        mount: { sharedView: unusedSharedView, navigation: f.navigation }, signal: f.controller.signal }) });
      assert.deepEqual(required(f.paints.at(-1)).pose, target.pose);
      const diameters = f.paints.map(world => 2 * required(presentWorldCamera(world, frame, optics).silhouette).tangentialSemiAxis);
      const first = diameters.findIndex(diameter => diameter >= 14), last = diameters.findIndex(diameter => diameter >= 300);
      assert.ok(first >= 0 && last > first);
      const seconds = (last - first) / hz;
      assert.ok(seconds >= .65 && seconds <= 1.3, `${radiusM} m at ${hz} Hz rushed or stalled the close-up: ${seconds.toFixed(3)} s`);
      for (let i = first + 1; i <= last; i++) {
        assert.ok(required(diameters[i]) >= required(diameters[i - 1]), 'Approach must not reverse');
        assert.ok(required(diameters[i]) / required(diameters[i - 1]) < 1.1, 'No sudden growth between painted frames');
      }
      durations.push(seconds);
    }
    assert.ok(Math.abs(required(durations[0]) - required(durations[1])) < .05, 'Refresh rate must not set the close-up speed');
  }
});

test('the exact final camera demand finishes before the old scene is handed off', async () => {
  const f = fixtureFactory(), viewReady = deferred();
  let readView: (() => ObjectPreparationView) | undefined, finalView: ObjectPreparationView | undefined;
  let resolved = false;
  f.factory.navigation.prepare = async ({ getView }) => {
    readView = getView;
    return { resources: f.resources, destroy: () => f.resources.destroy(), projection: () => undefined, prepareView(getView) { finalView = getView(); return viewReady.promise; } };
  };
  const work = f.start().then(value => { resolved = true; return value; });
  await drainFrames(f);
  assert.ok(finalView);
  assert.equal(resolved, false);
  assert.equal(required(readView)().world, f.navigation.capture(), 'Preparation reads the moving source camera');
  assert.equal(finalView.world, required(f.paints.at(-1)), 'Decode demand uses the exact painted checkpoint');
  viewReady.resolve();
  const handoff = await work;
  assert.equal(handoff.mountOptions.initialWorldCamera, finalView.world);
  f.controller.abort();
});

test('an overview starts moving before factory and assets are ready, then holds before target detail', async () => {
  const f = fixtureFactory(), factory = deferred<MockFactory>(), bank = deferred<MockLease>(), phases: string[] = [];
  const initial: WorldCameraPose = { ...f.navigation.capture(), pose: { positionM: [0, 0, 2e8], orientationXyzw: [0,0,0,1] } };
  f.navigation.apply(initial); f.paints.length = 0;
  f.factory.navigation.prepare = () => bank.promise;
  let resolved = false;
  const task = f.start({ toFactory: factory.promise, timing: { mark: phase => phases.push(phase) } })
    .then(value => { resolved = true; return value; });
  f.tick(0); f.tick(16);
  assert.notDeepEqual(f.navigation.capture(), initial, 'Factory loading cannot delay the first camera movement');
  assert.deepEqual(phases, ['first-motion']);
  factory.resolve(f.factory);
  await drainFrames(f);
  assert.equal(resolved, false, 'Detailed mount still waits for the authenticated bank');
  const checkpoint = f.navigation.capture();
  const target = presentWorldCamera(checkpoint, f.factory.navigation.frame, f.navigation.optics());
  assert.ok(!proxyVisible(target) || required(target.silhouette).tangentialSemiAxis * 2 <= 14 + 1e-6);
  bank.resolve({ resources: f.resources, destroy: () => f.resources.destroy(), projection: () => undefined, prepareView: async () => {} });
  const handoff = await task;
  assert.deepEqual(handoff.mountOptions.initialWorldCamera, checkpoint);
  await drainFrames(f, { task: handoff.afterMount(f.mounted()) });
  assert.deepEqual(phases, ['first-motion', 'assets-ready', 'mounted']);
  assertContinuousPaints(f.paints, [f.navigation.frame, f.factory.navigation.frame]);
});

test('overview preserves the latest drawn camera through slow preparation, without a flight or input interception', async () => {
  const f = fixtureFactory(), bank = deferred<MockLease>();
  f.factory.navigation.prepare = () => bank.promise;
  const task = f.start({ preserveView: true });
  await nextTurn();
  assert.equal(f.pending, 0, 'No flight frame is scheduled');
  assertFlightInputReleased(f);
  f.input();
  const latest: WorldCameraPose = { ...f.navigation.capture(), pose: { positionM: [7e8, 2e8, 3e8], orientationXyzw: [0, 0, 0, 1] } };
  f.navigation.apply(latest);
  bank.resolve({ resources: f.resources, destroy: () => f.resources.destroy(), projection: () => undefined, prepareView: async () => {} });
  const handoff = await task;
  assert.deepEqual(handoff.mountOptions.initialWorldCamera, latest, 'Snapshot is taken after input during preparation');
  const scene = new AbortController();
  handoff.transferTo(scene.signal);
  const paints = f.paints.length;
  await handoff.afterMount(f.mounted());
  assert.equal(f.paints.length, paints, 'Handoff does not write an animated or recentered pose');
  f.controller.abort();
  assert.equal(f.resources.destroyed, 0, 'The mounted scene owns its resources');
  scene.abort();
  assert.equal(f.resources.destroyed, 1, 'Session teardown releases its prepared ownership');
});

test('a cancelled preserved-view handoff releases its unmounted resources', async () => {
  const f = fixtureFactory();
  await f.start({ preserveView: true });
  f.controller.abort();
  assert.equal(f.resources.destroyed, 1);
});

test('an animated handoff transfers prepared cleanup to the scene and detaches request ownership', async () => {
  const f = fixtureFactory(), scene = new AbortController();
  const handoff = await drainFrames(f, { task: f.start() });
  handoff.transferTo(scene.signal);
  await drainFrames(f, { task: handoff.afterMount(f.mounted()) });
  assert.equal(getEventListeners(f.controller.signal, 'abort').length, 0);
  f.controller.abort(); assert.equal(f.resources.destroyed, 0);
  scene.abort(); assert.equal(f.resources.destroyed, 1);
  assert.equal(f.pending, 0);
});

test('overview handoff uses the requested distant camera instead of flying into the Sun', async () => {
  const f = fixtureFactory();
  const targetWorldCamera: WorldCameraPose = { ...f.navigation.capture(), pose: {
    positionM: [1e8, 0, 2e8], orientationXyzw: [0, 0, 0, 1],
  } };
  const task = f.start({ targetWorldCamera });
  const handoff = await drainFrames(f, { task });
  await drainFrames(f, { task: handoff.afterMount(f.mounted()) });
  closePose(f.navigation.capture().pose, targetWorldCamera.pose);
  assertContinuousPaints(f.paints, [f.navigation.frame, f.factory.navigation.frame]);
});

test('the same object can recenter at overview distance without resetting to its close-up', async () => {
  const f = fixtureFactory();
  const targetWorldCamera: WorldCameraPose = { ...f.navigation.capture(), pose: {
    positionM: [0, 0, 2e8], orientationXyzw: [0, 0, 0, 1],
  } };
  await drainFrames(f, { task: f.service.focus({ objectId: '0', mount: { sharedView: unusedSharedView, navigation: f.navigation },
    signal: f.controller.signal, targetWorldCamera }) });
  closePose(f.navigation.capture().pose, targetWorldCamera.pose);
});

// The synthetic optics use a 2000px square viewport. A sphere beside the
// eye plane can have a huge projected ellipse entirely outside that viewport.
const proxyVisible = (view: WorldCameraPresentation) => view.silhouette !== null && view.centerPixels !== null &&
  view.centerPixels.every(value => Math.abs(value) <= 1000);
function closePose(actual: WorldCameraPose["pose"], expected: WorldCameraPose["pose"]) {
  actual.positionM.forEach((value, axis) => assert.ok(Math.abs(value - expected.positionM[axis]) < 1e-5));
  actual.orientationXyzw.forEach((value, axis) => assert.ok(Math.abs(value - expected.orientationXyzw[axis]) < 1e-10));
}
function assertContinuousPaints(paints: readonly WorldCameraPose[], frames: readonly PreparedWorldCameraFrame[]) {
  const clearance = (pose: WorldCameraPose["pose"]) => Math.min(...frames.map(frame =>
    Math.max(frame.bodyRadiusM, range(pose, frame.originM) - frame.bodyRadiusM)));
  for (let index = 1; index < paints.length; index++) {
    const before = paints[index - 1].pose, after = paints[index].pose;
    const translation = range(after, before.positionM);
    const limit = (10 ** .1 - 1) * Math.min(clearance(before), clearance(after));
    assert.ok(translation <= limit + 1e-5,
      `Paint ${index} moved ${translation}m beyond its nearest-body clearance limit ${limit}m.`);
  }
}

test('handoff precedes large destination approach and continues the same numeric flight from the exact drawn checkpoint', async () => {
  const f = fixtureFactory(), initial = f.navigation.capture(), optics = f.navigation.optics();
  const target = createWorldSelectionTarget(initial, f.factory.navigation.frame, optics);
  const flight = createSelectionFlight({ from: initial.pose, to: target.pose, focusPositionM: f.factory.navigation.frame.originM });
  const task = f.start();
  f.tick(100); assert.deepEqual(f.paints[0], initial);
  // Even delayed RAFs must visibly recede before reaching the coarse boundary.
  f.tick(5100);
  const firstDeparture = presentWorldCamera(required(f.paints.at(-1)), f.navigation.frame, optics);
  assert.ok(required(firstDeparture.silhouette).tangentialSemiAxis * 2 > 14);
  const handoff = await drainFrames(f, { task, stepMs: 5000 });
  const checkpoint = required(f.paints.at(-1));
  assert.notDeepEqual(checkpoint, target);
  assert.deepEqual(handoff.mountOptions.initialWorldCamera, checkpoint);
  assert.equal(handoff.mountOptions.preparedResources, f.resources);
  const sourceView = presentWorldCamera(checkpoint, f.navigation.frame, optics);
  const targetView = presentWorldCamera(checkpoint, f.factory.navigation.frame, optics);
  assert.ok(sourceView.silhouette === null || sourceView.silhouette.tangentialSemiAxis * 2 <= 14 + 1e-8);
  assert.ok(!proxyVisible(targetView) || required(targetView.silhouette).tangentialSemiAxis * 2 < 20);
  // Invert the independently retained curve by physical target range.
  const checkpointRange = range(checkpoint.pose, flight.focusPositionM);
  let low = 0, high = flight.durationS;
  for (let i = 0; i < 60; i++) {
    const middle = (low + high) / 2;
    if (range(sampleSelectionFlight(flight, middle), flight.focusPositionM) > checkpointRange) low = middle; else high = middle;
  }
  closePose(checkpoint.pose, sampleSelectionFlight(flight, high));
  const continuation = handoff.afterMount(f.mounted());
  assert.deepEqual(required(f.paints.at(-1)), checkpoint);
  f.step(); assert.deepEqual(required(f.paints.at(-1)), checkpoint);
  f.step(400);
  const expected = createSelectionFlightSample();
  const frames = [f.navigation.frame, f.factory.navigation.frame];
  const anchors = frames.map(frame => ({ positionM: frame.originM, radiusM: frame.bodyRadiusM }));
  const elapsed = advanceSelectionFlightInto(flight, anchors, high, high + .4, expected);
  assert.ok(elapsed > high);
  closePose(required(f.paints.at(-1)).pose, expected);
  await drainFrames(f, { task: continuation });
  closePose(required(f.paints.at(-1)).pose, target.pose);
  assertContinuousPaints(f.paints, frames);
  assert.equal(f.pending, 0);
  assertFlightInputReleased(f);
});

test('slow asset preparation holds only the distant checkpoint and resumes after readiness', async () => {
  const f = fixtureFactory(), bank = deferred<MockLease>();
  f.factory.navigation.prepare = () => bank.promise;
  let resolved = false;
  const task = f.start().then(value => { resolved = true; return value; });
  f.tick(0); f.tick(5000); await drainFrames(f);
  const checkpoint = required(f.paints.at(-1)), count = f.paints.length;
  await Promise.resolve(); assert.equal(resolved, false);
  f.step(10000); assert.equal(f.paints.length, count);
  const target = presentWorldCamera(checkpoint, f.factory.navigation.frame, f.navigation.optics());
  assert.ok(!proxyVisible(target) || required(target.silhouette).tangentialSemiAxis * 2 < 20);
  bank.resolve({ resources: f.resources, destroy: () => f.resources.destroy(), projection: () => undefined, prepareView: async () => {} });
  const handoff = await task;
  assert.deepEqual(handoff.mountOptions.initialWorldCamera, checkpoint);
  const continuation = handoff.afterMount(f.mounted());
  f.step(5000); assert.deepEqual(required(f.paints.at(-1)), checkpoint);
  await drainFrames(f, { task: continuation });
});

test('new selection cancellation stops painting and releases destination preparation', async () => {
  const f = fixtureFactory(), task = f.start();
  f.tick(0); f.tick(400); const count = f.paints.length;
  f.controller.abort();
  await assert.rejects(task, { name: 'AbortError' });
  f.tick(6000); assert.equal(f.paints.length, count);
  assert.equal(f.pending, 0); assert.equal(f.resources.destroyed, 1);
});

test('cancellation between prepared handoff and mount releases resources and all interruption listeners', async () => {
  const f = fixtureFactory(), task = f.start();
  f.tick(0); f.tick(5000); await drainFrames(f, { task });
  f.controller.abort();
  assertFlightInputReleased(f);
  assert.equal(f.resources.destroyed, 1);
  assert.equal(f.pending, 0);
});

test('input between handoff and mount keeps the prepared lease for the mount to claim', async () => {
  const f = fixtureFactory(), task = f.start();
  f.tick(0); f.tick(5000); const handoff = await drainFrames(f, { task });
  f.input();
  assert.equal(f.resources.destroyed, 0, 'The router is about to mount these resources');
  assert.doesNotThrow(() => handoff.mountOptions.onNavigationReady?.(f.mounted().navigation), 'An interrupted flight still mounts its destination');
  f.controller.abort();
  assert.equal(f.resources.destroyed, 1, 'Only the router request releases a handed-off lease');
});

test('an already cancelled request cannot start a frame or retain input listeners', async () => {
  const f = fixtureFactory();
  f.controller.abort();
  await assert.rejects(f.start(), { name: 'AbortError' });
  f.tick(0);
  assert.equal(f.paints.length, 0);
  assert.equal(f.pending, 0);
  assertFlightInputReleased(f);
  assert.equal(f.resources.destroyed, 1);
});

test('input during a delayed preparation interrupts at the last drawn checkpoint and releases late resources', async () => {
  const f = fixtureFactory(), bank = deferred<MockLease>();
  f.factory.navigation.prepare = () => bank.promise;
  const task = f.start();
  f.tick(0); f.tick(5000); await drainFrames(f);
  const checkpoint = f.navigation.capture();
  f.input();
  await assert.rejects(task, error => error instanceof Error && error.name === 'AbortError' && 'preserveView' in error && error.preserveView === true);
  bank.resolve({ resources: f.resources, destroy: () => f.resources.destroy(), projection: () => undefined, prepareView: async () => {} });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(f.resources.destroyed, 1);
  assert.deepEqual(f.navigation.capture(), checkpoint);
  assert.equal(f.pending, 0);
});

test('input after the early handoff hurries between bodies, then preserves the drawn approach pose', async () => {
  const f = fixtureFactory(), task = f.start();
  f.tick(0); f.tick(5000); const handoff = await drainFrames(f, { task });
  const continuation = handoff.afterMount(f.mounted());
  f.step(); f.step(400);
  assert.equal(f.input().defaultPrevented, true, 'A click between bodies cannot strand the camera there');
  // The fixture target (1 km radius, 1000 px focal) outgrows its 14 px proxy inside 143 km.
  for (let frame = 0; frame < 1000 && range(f.navigation.capture().pose, [1e8, 0, 0]) > 1.2e5; frame++) { f.step(); await nextTurn(); }
  assert.ok(range(f.navigation.capture().pose, [1e8, 0, 0]) <= 1.2e5, 'The hurried flight reaches the drawn approach');
  const drawn = f.navigation.capture();
  assert.equal(f.input().defaultPrevented, false, 'Input during the drawn approach reaches the camera');
  await assert.rejects(continuation, error => error instanceof Error && error.name === 'AbortError' && 'preserveView' in error && error.preserveView === true);
  f.tick(12000);
  assert.deepEqual(f.navigation.capture(), drawn);
  assert.equal(f.pending, 0);
});

test('reduced motion waits for preparation, then mounts the exact arrival without enlarging a source proxy', async () => {
  const f = fixtureFactory(), bank = deferred<MockLease>();
  f.factory.navigation.prepare = () => bank.promise;
  const initial = f.navigation.capture(), target = createWorldSelectionTarget(initial, f.factory.navigation.frame, f.navigation.optics());
  const task = f.start({ reducedMotion: true });
  assert.equal(f.service.supports('0', '1'), true);
  assert.equal(f.service.supports('0', 'unprepared'), false);
  f.tick(0); f.tick(5000); assert.equal(f.paints.length, 0);
  bank.resolve({ resources: f.resources, destroy: () => f.resources.destroy(), projection: () => undefined, prepareView: async () => {} });
  const handoff = await task;
  assert.deepEqual(handoff.mountOptions.initialWorldCamera, target);
  await handoff.afterMount(f.mounted());
  assert.equal(f.paints.length, 1);
  assert.equal(f.pending, 0);
});

test('saved camera endpoints survive the early owner handoff unchanged', async () => {
  const f = fixtureFactory();
  const saved = { camera: { distanceKilometers: 12, pose: { schema: 'cssearth-camera-pose@2' as const,
    scene: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)' } }, preparedEpochJdTt: 1,
    playback: { times: [123], speed: 1, motionRequested: false } };
  const target = savedWorldCamera(saved, f.factory.navigation.frame, f.navigation.optics());
  const task = f.start({ url: `https://example.test/1/?${formatSharedView(saved)}` });
  f.tick(0); f.tick(5000); const handoff = await drainFrames(f, { task });
  assert.notDeepEqual(handoff.mountOptions.initialWorldCamera, target);
  const continuation = handoff.afterMount(f.mounted());
  f.step(); await drainFrames(f, { task: continuation });
  closePose(f.navigation.capture().pose, target.pose);
});

test('refocusing the selected object paints one existing owner without reloading its prepared bank', async () => {
  const f = fixtureFactory();
  const initial = f.navigation.capture();
  const target = createWorldSelectionTarget(initial, f.navigation.frame, f.navigation.optics());
  const task = f.service.focus({ objectId: '0', mount: { sharedView: unusedSharedView, navigation: f.navigation }, signal: f.controller.signal });
  await drainFrames(f, { task });
  assert.ok(f.paints.length > 2);
  closePose(f.navigation.capture().pose, target.pose);
  assert.equal(f.resources.destroyed, 0);
  assert.equal(f.pending, 0);
  assertFlightInputReleased(f);
});

test('the application keeps flying while destination groups activate, then transfers the live pose without a reset', async () => {
  const f = fixtureFactory(), context: WorldCameraPose[] = [];
  const task = f.start({ presentWorld: (world, _viewport, options) => { options?.commit?.(); context.push(world); } });
  const handoff = await drainFrames(f, { task });
  const checkpoint = handoff.mountOptions.initialWorldCamera;
  for (let i=0; i<12; i++) f.step();
  assert.ok(context.length > 5, 'The universe still presents frames while no detail owner is ready');
  assert.notDeepEqual(context.at(-1), checkpoint, 'Mounting must not freeze the camera at handoff');
  const mount = f.mounted();
  required(handoff.mountOptions.onNavigationReady)(mount.navigation);
  assert.deepEqual(mount.navigation.capture(), context.at(-1));
  for (let i=0; i<12; i++) f.step();
  assert.deepEqual(mount.navigation.capture(), context.at(-1), 'The incoming camera tracks the live world before full readiness');
  const incoming = mount.navigation.capture(), count = context.length;
  const finished = handoff.afterMount(mount);
  assert.deepEqual(mount.navigation.capture(), incoming, 'Full readiness does not reset to the initial checkpoint');
  await drainFrames(f, {task:finished});
  assert.equal(context.length,count, 'The mounted owner takes over publication without duplicate universe writes');
  assert.equal(f.pending,0);
});

test('session cancellation during activation stops the flight before afterMount and releases its resources', async () => {
  const f = fixtureFactory(), context=[];
  const handoff = await drainFrames(f,{task:f.start({presentWorld:(world, _viewport, options) => { options?.commit?.(); context.push(world); }})});
  const scene = new AbortController();
  handoff.transferTo(scene.signal);
  f.step(); const count=context.length;
  scene.abort(); f.step();
  assert.equal(context.length,count);
  assert.equal(f.pending,0);
  assert.equal(f.resources.destroyed,1);
  assertFlightInputReleased(f);
});

test('an activating detail waits for its world publication and interruption preserves the last acknowledged pose', async () => {
  const f = fixtureFactory(), pending: (() => void)[] = [], context: unknown[] = [];
  const presentWorld: NonNullable<PrepareOptions['presentWorld']> = (world, _viewport, { signal, commit }) => new Promise<boolean>(resolve => {
    const cancel = () => resolve(false);
    signal.addEventListener('abort', cancel, { once: true });
    pending.push(() => {
      signal.removeEventListener('abort', cancel);
      if (signal.aborted) { resolve(false); return; }
      commit?.(); context.push(world); resolve(true);
    });
  });
  const acknowledge = () => { const reply = pending.shift(); assert.ok(reply, 'A world publication is awaiting its reply'); reply(); };
  const handoff = await drainFrames(f, { task: f.start({ presentWorld }) });
  const mount = f.mounted(); required(handoff.mountOptions.onNavigationReady)(mount.navigation);
  const checkpoint = mount.navigation.capture();
  f.step();
  for (let i = 0; i < 12; i++) f.step();
  assert.equal(pending.length, 1, 'Slow planning cannot queue a second unacknowledged flight pose');
  assert.deepEqual(mount.navigation.capture(), checkpoint, 'Detail cannot move ahead of its surrounding world');
  acknowledge(); await nextTurn();
  assert.deepEqual(mount.navigation.capture(), context.at(-1), 'Detail and world commit the same pose');
  f.step(); acknowledge(); await nextTurn();
  const drawn = mount.navigation.capture();
  assert.notDeepEqual(drawn, checkpoint);
  f.step(); f.controller.abort();
  acknowledge(); await nextTurn();
  assert.deepEqual(mount.navigation.capture(), drawn, 'An obsolete worker reply cannot move the interrupted view');
  assert.equal(f.pending, 0);
  assert.equal(f.resources.destroyed, 1);
});

test('real input interrupts a same-object focus at the last painted camera', async () => {
  const f = fixtureFactory();
  const task = f.service.focus({ objectId: '0', mount: { sharedView: unusedSharedView, navigation: f.navigation }, signal: f.controller.signal });
  f.tick(0); f.tick(100);
  const drawn = f.navigation.capture();
  f.input();
  await assert.rejects(task, error => error instanceof Error && error.name === 'AbortError' && 'preserveView' in error && error.preserveView === true);
  f.tick(10000);
  assert.deepEqual(f.navigation.capture(), drawn);
  assert.equal(f.pending, 0);
});

test('replacement departure uses the retained world while its previous detail owner is retired', async () => {
  const f = fixtureFactory(), context: WorldCameraPose[] = [];
  f.navigation.apply({ ...f.navigation.capture(), pose: { positionM: [0, 0, 2e8], orientationXyzw: [0, 0, 0, 1] } });
  const handoff = await drainFrames(f, { task: f.start({ presentWorld: (world, _viewport, options) => { options?.commit?.(); context.push(world); } }) });
  required(handoff.mountOptions.onNavigationReady)(f.mounted().navigation);
  for (let frame = 0; frame < 12; frame++) f.step();
  const drawn = required(context.at(-1));
  f.controller.abort();
  const retiredPaintCount = f.paints.length, beforeReplacement = context.length;
  const replacement = new AbortController(), factory = deferred<MockFactory>(), phases: string[] = [];
  const task = f.start({ fromId: '1', toId: '0', fromMount: null, toFactory: factory.promise,
    signal: replacement.signal, presentWorld: (world, _viewport, options) => { options.commit?.(); context.push(world); }, timing: { mark: phase => phases.push(phase) } });
  f.step(); f.step();
  assert.deepEqual(context[beforeReplacement], drawn, 'Replacement starts from the last drawn world pose');
  assert.notDeepEqual(context.at(-1), drawn, 'Retiring detail must not make motion wait for the next factory');
  assert.deepEqual(phases, ['first-motion']);
  assert.equal(f.paints.length, retiredPaintCount, 'The disposed detail owner receives no camera writes');
  factory.resolve(f.factory);
  const nextHandoff = await drainFrames(f, { task });
  const target = createWorldSelectionTarget(drawn, f.navigation.frame, f.navigation.optics());
  const mount = { ...lifecycle, navigation: f.navigation };
  required(nextHandoff.mountOptions.onNavigationReady)(mount.navigation);
  await drainFrames(f, { task: nextHandoff.afterMount(mount) });
  closePose(f.navigation.capture().pose, target.pose);
  assert.equal(f.pending, 0);
  assertFlightInputReleased(f);
});

test('the current body accepts wide-view centering only while below its prepared detail threshold', () => {
  const f = fixtureFactory(), mount = { sharedView: unusedSharedView, navigation: f.navigation };
  const close = f.navigation.capture();
  assert.equal(f.service.centerTarget({ fromId: '0', objectId: '0', mount }), null);
  f.navigation.apply({ ...close, pose: { ...close.pose, positionM: [0, 0, 2e8] } });
  assert.ok(f.service.centerTarget({ fromId: '0', objectId: '0', mount }));
  f.navigation.apply(close);
  assert.equal(f.service.centerTarget({ fromId: '0', objectId: '0', mount }), null);
});

test('centering changes the focus at the same range and orientation, then focus zooms in', async () => {
  const f = fixtureFactory();
  assert.equal(f.service.centerTarget({ fromId: '0', objectId: '0', mount: { sharedView: unusedSharedView, navigation: f.navigation } }), null);
  f.navigation.apply({ ...f.navigation.capture(), pose: { positionM: [0, 0, 2e8], orientationXyzw: [0, 0, 0, 1] } });
  const target = required(f.service.centerTarget({ fromId: '0', objectId: '1', mount: { sharedView: unusedSharedView, navigation: f.navigation } }));
  assert.deepEqual(target.pose.positionM, [1e8, 0, 2e8]);
  assert.deepEqual(target.pose.orientationXyzw, [0, 0, 0, 1]);
  const handoff = await drainFrames(f, { task: f.start({ targetWorldCamera: target, centerSelection: true }) });
  const mount = f.mounted();
  handoff.mountOptions.onNavigationReady?.(mount.navigation);
  await drainFrames(f, { task: handoff.afterMount(mount) });
  const projection = presentWorldCamera(mount.navigation.capture(), mount.navigation.frame, mount.navigation.optics());
  required(projection.centerPixels).forEach(value => assert.ok(Math.abs(value) < 1e-6));
  assert.ok(Math.abs(projection.distanceM / 2e8 - 1) < 1e-12);
  await drainFrames(f, { task: f.service.focus({ objectId: '1', mount, signal: f.controller.signal }) });
  assert.ok(range(mount.navigation.capture().pose, mount.navigation.frame.originM) < 2e6);
});

test('flights retain the same native wheel listener until navigation is destroyed', async () => {
  const f = fixtureFactory(), listener = getEventListeners(f.documentTarget, 'wheel')[0];
  for (let index = 0; index < 2; index++) {
    await drainFrames(f, { task: f.service.focus({ objectId: '0', mount: { sharedView: unusedSharedView, navigation: f.navigation }, signal: f.controller.signal }) });
    assertFlightInputReleased(f);
    assert.equal(getEventListeners(f.documentTarget, 'wheel')[0], listener);
  }
  f.service.destroy();
  assert.equal(getEventListeners(f.documentTarget, 'wheel').length, 0);
});

test('a wheel during a flight hurries the arrival instead of stopping it', async () => {
  const normal = fixtureFactory(), hurried = fixtureFactory();
  const fly = (f: ReturnType<typeof fixtureFactory>) => f.service.focus({ objectId: '0', mount: { sharedView: unusedSharedView, navigation: f.navigation }, signal: f.controller.signal });
  const frames = async (f: ReturnType<typeof fixtureFactory>, task: Promise<void>) => {
    let settled = false, failure: unknown = null, count = 0;
    task.then(() => { settled = true; }, error => { settled = true; failure = error; });
    while (count < 1000) { await nextTurn(); if (settled) break; f.step(); count++; }
    if (failure) throw failure;
    return count;
  };
  const normalTask = fly(normal), hurriedTask = fly(hurried);
  for (const f of [normal, hurried]) { f.tick(0); f.tick(100); }
  const wheel = hurried.wheel();
  assert.equal(wheel.defaultPrevented, true, 'The flight keeps the wheel from zooming the camera mid-flight');
  const normalFrames = await frames(normal, normalTask), hurriedFrames = await frames(hurried, hurriedTask);
  assert.ok(hurriedFrames < normalFrames / 2, `A hurried flight arrives in under half the frames (${hurriedFrames} of ${normalFrames})`);
  closePose(hurried.navigation.capture().pose, normal.navigation.capture().pose);
  assertFlightInputReleased(hurried);
});

test('a wheel, click or key between bodies hurries a prepared navigation to the destination instead of abandoning it', async () => {
  const run = async (hurried: 'wheel' | 'input' | 'escape' | null) => {
    const f = fixtureFactory(), context: WorldCameraPose[] = [];
    f.navigation.apply({ ...f.navigation.capture(), pose: { positionM: [0, 0, 2e8], orientationXyzw: [0, 0, 0, 1] } });
    const task = f.start({ presentWorld: (world, _viewport, options) => { options?.commit?.(); context.push(world); } });
    f.step(); f.step();
    if (hurried) assert.equal(f[hurried]().defaultPrevented, true, `The navigation keeps the ${hurried} from moving the camera mid-flight`);
    const handoff = await drainFrames(f, { task });
    required(handoff.mountOptions.onNavigationReady)(f.mounted().navigation);
    await drainFrames(f, { task: handoff.afterMount({ ...lifecycle, navigation: f.navigation }) });
    assert.equal(f.pending, 0);
    assertFlightInputReleased(f);
    return { frames: context.length + f.paints.length, pose: f.navigation.capture().pose };
  };
  const normal = await run(null);
  for (const input of ['wheel', 'input', 'escape'] as const) {
    const hurried = await run(input);
    assert.ok(hurried.frames < normal.frames / 2, `A navigation hurried by ${input} arrives in under half the frames (${hurried.frames} of ${normal.frames})`);
    closePose(hurried.pose, normal.pose);
  }
});

test('only the departing owner receives departure publications', async () => {
  const f = fixtureFactory(), modes: (boolean | undefined)[] = [];
  const apply = f.navigation.apply;
  f.navigation.apply = (world, options) => { modes.push(options?.departing); return apply(world, options); };
  const handoff = await drainFrames(f, { task: f.start() });
  assert.ok(modes.length > 0);
  assert.ok(modes.every(value => value === true));
  const count = modes.length;
  await drainFrames(f, { task: handoff.afterMount(f.mounted()) });
  assert.ok(modes.length > count);
  assert.ok(modes.slice(count).every(value => value === undefined), 'destination detail always publishes');
});
