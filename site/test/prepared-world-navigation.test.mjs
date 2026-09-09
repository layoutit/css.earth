import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getEventListeners } from 'node:events';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { createSelectionFlight, sampleSelectionFlight, createSelectionFlightSample, advanceSelectionFlightInto } from '@cssearth/engine';
import { createWorldSelectionTarget, presentWorldCamera, formatSharedView, savedWorldCamera } from '../../src/renderers/css/dist/navigation.js';
import { createPreparedWorldNavigation } from '../prepared-world-navigation.mjs';

const identity = [1,0,0,0,1,0,0,0,1];
function fixture() {
  const frames = [0, 1].map(index => ({ referenceFrame: 'world', epochJdTt: 1,
    originM: [index * 1e8, 0, 0], presentationToReference: identity, metersPerUnit: 1, bodyRadiusM: 1000,
    orbitUpReference: [0,1,0] }));
  const objects = frames.map((worldFrame, index) => ({ id: String(index), worldFrame }));
  const callbacks = new Map(), documentTarget = new EventTarget();
  let next = 0, time = 0, current = { referenceFrame: 'world', epochJdTt: 1,
    pose: { positionM: [0,0,10000], orientationXyzw: [0,0,0,1] } };
  const paints = [], resources = { destroyed: 0, destroy() { this.destroyed++; } };
  const windowTarget = { requestAnimationFrame(fn) { callbacks.set(++next, fn); return next; },
    cancelAnimationFrame(id) { callbacks.delete(id); } };
  const navigation = { frame: frames[0], capture: () => current,
    activePreparedFocus: null,
    preparedFocus() { return this.activePreparedFocus; },
    setPreparedFocus(focus) { this.activePreparedFocus = focus; },
    optics: () => ({ focalPixels: 1000, principalOffsetPixels: [0,0], widthPixels: 2000, heightPixels: 2000,
      framingRadiusPixels: 200, detailHandoffDiameterPixels: 14 }),
    apply(value) { current = value; paints.push(value); } };
  const factory = { navigation: { frame: frames[1], prepare: async () => ({ resources, destroy: () => resources.destroy(), projection: () => undefined, prepareView: async () => {} }) } };
  const service = createPreparedWorldNavigation({ objects, windowTarget, documentTarget });
  const controller = new AbortController();
  return { service, controller, resources, navigation, factory, paints, documentTarget,
    start(options = {}) { return service.prepare({ fromId: '0', toId: '1', fromMount: { navigation },
      toFactory: factory, signal: controller.signal, reducedMotion: false, ...options }); },
    mounted() { return { navigation: { ...navigation, frame: frames[1] } }; },
    tick(value) { time = value; const entries = [...callbacks.values()]; callbacks.clear(); for (const fn of entries) fn(time); },
    step(milliseconds = 1000 / 60) { this.tick(time + milliseconds); },
    input() { const event = new Event('wheel'); Object.defineProperty(event, 'target', { value: { closest: () => true } }); documentTarget.dispatchEvent(event); },
    get pending() { return callbacks.size; } };
}
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
async function drainFrames(fixture, { task, stepMs = 1000 / 60 } = {}) {
  let settled = false, value, failure;
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
const range = (pose, origin) => Math.hypot(...pose.positionM.map((value, axis) => value - origin[axis]));

test('a terminal extreme-range pose finishes without a tail of identical publications', async () => {
  const f = fixture();
  f.navigation.frame.bodyRadiusM = 695700000;
  f.navigation.apply({ referenceFrame: 'world', epochJdTt: 1,
    pose: { positionM: [0, 0, 2.4809028e21], orientationXyzw: [0, 0, 0, 1] } });
  const from = f.navigation.capture();
  const target = createWorldSelectionTarget(from, f.navigation.frame, f.navigation.optics());
  await drainFrames(f, { task: f.service.focus({ objectId: '0', mount: { navigation: f.navigation }, signal: f.controller.signal }) });
  assert.deepEqual(f.paints.at(-1).pose, target.pose);
  const terminal = f.paints.filter(world => JSON.stringify(world.pose) === JSON.stringify(target.pose));
  assert.equal(terminal.length, 1, 'one terminal publication, with no dead flight tail');
  assert.equal(f.pending, 0);
});

test('the exact final camera demand finishes before the old scene is handed off', async () => {
  const f = fixture(), viewReady = deferred();
  let readView, finalView, resolved = false;
  f.factory.navigation.prepare = async ({ getView }) => {
    readView = getView;
    return { resources: f.resources, destroy: () => f.resources.destroy(), projection: () => undefined, prepareView(getView) { finalView = getView(); return viewReady.promise; } };
  };
  const work = f.start().then(value => { resolved = true; return value; });
  await drainFrames(f);
  assert.ok(finalView);
  assert.equal(resolved, false);
  assert.equal(readView().world, f.navigation.capture(), 'Preparation reads the moving source camera');
  assert.equal(finalView.world, f.paints.at(-1), 'Decode demand uses the exact painted checkpoint');
  viewReady.resolve();
  const handoff = await work;
  assert.equal(handoff.mountOptions.initialWorldCamera, finalView.world);
  f.controller.abort();
});

test('an overview starts moving before factory and assets are ready, then holds before target detail', async () => {
  const f = fixture(), factory = deferred(), bank = deferred(), phases = [];
  const initial = { ...f.navigation.capture(), pose: { positionM: [0, 0, 2e8], orientationXyzw: [0,0,0,1] } };
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
  assert.ok(!proxyVisible(target) || target.silhouette.tangentialSemiAxis * 2 <= 14 + 1e-6);
  bank.resolve({ resources: f.resources, destroy: () => f.resources.destroy(), projection: () => undefined, prepareView: async () => {} });
  const handoff = await task;
  assert.deepEqual(handoff.mountOptions.initialWorldCamera, checkpoint);
  await drainFrames(f, { task: handoff.afterMount(f.mounted(), { signal: f.controller.signal }) });
  assert.deepEqual(phases, ['first-motion', 'assets-ready', 'mounted']);
  assertContinuousPaints(f.paints, [f.navigation.frame, f.factory.navigation.frame]);
});

test('overview preserves the latest drawn camera through slow preparation, without a flight or input interception', async () => {
  const f = fixture(), bank = deferred();
  f.factory.navigation.prepare = () => bank.promise;
  const task = f.start({ preserveView: true });
  await nextTurn();
  assert.equal(f.pending, 0, 'No flight frame is scheduled');
  for (const name of ['pointerdown', 'wheel', 'keydown']) assert.equal(getEventListeners(f.documentTarget, name).length, 0);
  f.input();
  const latest = { ...f.navigation.capture(), pose: { positionM: [7e8, 2e8, 3e8], orientationXyzw: [0, 0, 0, 1] } };
  f.navigation.apply(latest);
  bank.resolve({ resources: f.resources, destroy: () => f.resources.destroy(), projection: () => undefined, prepareView: async () => {} });
  const handoff = await task;
  assert.deepEqual(handoff.mountOptions.initialWorldCamera, latest, 'Snapshot is taken after input during preparation');
  const paints = f.paints.length;
  await handoff.afterMount(f.mounted(), { signal: f.controller.signal });
  assert.equal(f.paints.length, paints, 'Handoff does not write an animated or recentered pose');
  f.controller.abort();
  assert.equal(f.resources.destroyed, 0, 'The mounted scene owns its resources');
});

test('a cancelled preserved-view handoff releases its unmounted resources', async () => {
  const f = fixture();
  await f.start({ preserveView: true });
  f.controller.abort();
  assert.equal(f.resources.destroyed, 1);
});

test('overview handoff uses the requested distant camera instead of flying into the Sun', async () => {
  const f = fixture();
  const targetWorldCamera = { ...f.navigation.capture(), pose: {
    positionM: [1e8, 0, 2e8], orientationXyzw: [0, 0, 0, 1],
  } };
  const task = f.start({ targetWorldCamera });
  const handoff = await drainFrames(f, { task });
  await drainFrames(f, { task: handoff.afterMount(f.mounted(), { signal: f.controller.signal }) });
  closePose(f.navigation.capture().pose, targetWorldCamera.pose);
  assertContinuousPaints(f.paints, [f.navigation.frame, f.factory.navigation.frame]);
});

test('the same object can recenter at overview distance without resetting to its close-up', async () => {
  const f = fixture();
  const targetWorldCamera = { ...f.navigation.capture(), pose: {
    positionM: [0, 0, 2e8], orientationXyzw: [0, 0, 0, 1],
  } };
  await drainFrames(f, { task: f.service.focus({ objectId: '0', mount: { navigation: f.navigation },
    signal: f.controller.signal, targetWorldCamera }) });
  closePose(f.navigation.capture().pose, targetWorldCamera.pose);
});

test('ordinary planet selection clears a prepared catalogue pivot for both same-owner focus and detail handoff', async () => {
  for (const sameOwner of [true, false]) {
    const f = fixture();
    f.navigation.setPreparedFocus({ id: 'catalogue:7' });
    const before = f.navigation.capture();
    const task = sameOwner
      ? f.service.focus({ objectId: '0', mount: { navigation: f.navigation }, signal: f.controller.signal, reducedMotion: true })
      : f.start({ preserveView: true });
    assert.equal(f.navigation.preparedFocus(), null);
    assert.equal(f.navigation.capture(), before, 'Clearing the input pivot cannot move the existing observer');
    const result = await drainFrames(f, { task });
    if (!sameOwner) await result.afterMount(f.mounted());
    f.controller.abort();
  }
});
// The synthetic optics use a 2000px square viewport. A sphere beside the
// eye plane can have a huge projected ellipse entirely outside that viewport.
const proxyVisible = view => view.silhouette !== null && view.centerPixels !== null &&
  view.centerPixels.every(value => Math.abs(value) <= 1000);
function closePose(actual, expected) {
  actual.positionM.forEach((value, axis) => assert.ok(Math.abs(value - expected.positionM[axis]) < 1e-5));
  actual.orientationXyzw.forEach((value, axis) => assert.ok(Math.abs(value - expected.orientationXyzw[axis]) < 1e-10));
}
function assertContinuousPaints(paints, frames) {
  const clearance = pose => Math.min(...frames.map(frame =>
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
  const f = fixture(), initial = f.navigation.capture(), optics = f.navigation.optics();
  const target = createWorldSelectionTarget(initial, f.factory.navigation.frame, optics);
  const flight = createSelectionFlight({ from: initial.pose, to: target.pose, focusPositionM: f.factory.navigation.frame.originM });
  const task = f.start();
  f.tick(100); assert.deepEqual(f.paints[0], initial);
  // Even delayed RAFs must visibly recede before reaching the coarse boundary.
  f.tick(5100);
  const firstDeparture = presentWorldCamera(f.paints.at(-1), f.navigation.frame, optics);
  assert.ok(firstDeparture.silhouette.tangentialSemiAxis * 2 > 14);
  const handoff = await drainFrames(f, { task, stepMs: 5000 });
  const checkpoint = f.paints.at(-1);
  assert.notDeepEqual(checkpoint, target);
  assert.deepEqual(handoff.mountOptions.initialWorldCamera, checkpoint);
  assert.equal(handoff.mountOptions.preparedResources, f.resources);
  const sourceView = presentWorldCamera(checkpoint, f.navigation.frame, optics);
  const targetView = presentWorldCamera(checkpoint, f.factory.navigation.frame, optics);
  assert.ok(sourceView.silhouette === null || sourceView.silhouette.tangentialSemiAxis * 2 <= 14 + 1e-8);
  assert.ok(!proxyVisible(targetView) || targetView.silhouette.tangentialSemiAxis * 2 < 20);
  // Invert the independently retained curve by physical target range.
  const checkpointRange = range(checkpoint.pose, flight.focusPositionM);
  let low = 0, high = flight.durationS;
  for (let i = 0; i < 60; i++) {
    const middle = (low + high) / 2;
    if (range(sampleSelectionFlight(flight, middle), flight.focusPositionM) > checkpointRange) low = middle; else high = middle;
  }
  closePose(checkpoint.pose, sampleSelectionFlight(flight, high));
  const continuation = handoff.afterMount(f.mounted(), { signal: f.controller.signal });
  assert.deepEqual(f.paints.at(-1), checkpoint);
  f.step(); assert.deepEqual(f.paints.at(-1), checkpoint);
  f.step(400);
  const expected = createSelectionFlightSample();
  const frames = [f.navigation.frame, f.factory.navigation.frame];
  const anchors = frames.map(frame => ({ positionM: frame.originM, radiusM: frame.bodyRadiusM }));
  const elapsed = advanceSelectionFlightInto(flight, anchors, high, high + .4, expected);
  assert.ok(elapsed > high);
  closePose(f.paints.at(-1).pose, expected);
  await drainFrames(f, { task: continuation });
  closePose(f.paints.at(-1).pose, target.pose);
  assertContinuousPaints(f.paints, frames);
  assert.equal(f.pending, 0);
  for (const name of ['pointerdown', 'wheel', 'keydown']) assert.equal(getEventListeners(f.documentTarget, name).length, 0);
});

test('slow asset preparation holds only the distant checkpoint and resumes after readiness', async () => {
  const f = fixture(), bank = deferred();
  f.factory.navigation.prepare = () => bank.promise;
  let resolved = false;
  const task = f.start().then(value => { resolved = true; return value; });
  f.tick(0); f.tick(5000); await drainFrames(f);
  const checkpoint = f.paints.at(-1), count = f.paints.length;
  await Promise.resolve(); assert.equal(resolved, false);
  f.step(10000); assert.equal(f.paints.length, count);
  const target = presentWorldCamera(checkpoint, f.factory.navigation.frame, f.navigation.optics());
  assert.ok(!proxyVisible(target) || target.silhouette.tangentialSemiAxis * 2 < 20);
  bank.resolve({ resources: f.resources, destroy: () => f.resources.destroy(), projection: () => undefined, prepareView: async () => {} });
  const handoff = await task;
  assert.deepEqual(handoff.mountOptions.initialWorldCamera, checkpoint);
  const continuation = handoff.afterMount(f.mounted(), { signal: f.controller.signal });
  f.step(5000); assert.deepEqual(f.paints.at(-1), checkpoint);
  await drainFrames(f, { task: continuation });
});

test('new selection cancellation stops painting and releases destination preparation', async () => {
  const f = fixture(), task = f.start();
  f.tick(0); f.tick(400); const count = f.paints.length;
  f.controller.abort();
  await assert.rejects(task, { name: 'AbortError' });
  f.tick(6000); assert.equal(f.paints.length, count);
  assert.equal(f.pending, 0); assert.equal(f.resources.destroyed, 1);
});

test('cancellation between prepared handoff and mount releases resources and all interruption listeners', async () => {
  const f = fixture(), task = f.start();
  f.tick(0); f.tick(5000); await drainFrames(f, { task });
  f.controller.abort();
  for (const name of ['pointerdown', 'wheel', 'keydown']) assert.equal(getEventListeners(f.documentTarget, name).length, 0);
  assert.equal(f.resources.destroyed, 1);
  assert.equal(f.pending, 0);
});

test('an already cancelled request cannot start a frame or retain input listeners', async () => {
  const f = fixture();
  f.controller.abort();
  await assert.rejects(f.start(), { name: 'AbortError' });
  f.tick(0);
  assert.equal(f.paints.length, 0);
  assert.equal(f.pending, 0);
  for (const name of ['pointerdown', 'wheel', 'keydown']) assert.equal(getEventListeners(f.documentTarget, name).length, 0);
  assert.equal(f.resources.destroyed, 1);
});

test('input during a delayed preparation interrupts at the last drawn checkpoint and releases late resources', async () => {
  const f = fixture(), bank = deferred();
  f.factory.navigation.prepare = () => bank.promise;
  const task = f.start();
  f.tick(0); f.tick(5000); await drainFrames(f);
  const checkpoint = f.navigation.capture();
  f.input();
  await assert.rejects(task, error => error.name === 'AbortError' && error.preserveView === true);
  bank.resolve({ resources: f.resources, destroy: () => f.resources.destroy(), projection: () => undefined, prepareView: async () => {} });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(f.resources.destroyed, 1);
  assert.deepEqual(f.navigation.capture(), checkpoint);
  assert.equal(f.pending, 0);
});

test('input after the early handoff preserves the destination owner drawn pose', async () => {
  const f = fixture(), task = f.start();
  f.tick(0); f.tick(5000); const handoff = await drainFrames(f, { task });
  const continuation = handoff.afterMount(f.mounted(), { signal: f.controller.signal });
  f.step(); f.step(400);
  const drawn = f.navigation.capture();
  f.input();
  await assert.rejects(continuation, error => error.name === 'AbortError' && error.preserveView === true);
  f.tick(12000);
  assert.deepEqual(f.navigation.capture(), drawn);
  assert.equal(f.pending, 0);
});

test('reduced motion waits for preparation, then mounts the exact arrival without enlarging a source proxy', async () => {
  const f = fixture(), bank = deferred();
  f.factory.navigation.prepare = () => bank.promise;
  const initial = f.navigation.capture(), target = createWorldSelectionTarget(initial, f.factory.navigation.frame, f.navigation.optics());
  const task = f.start({ reducedMotion: true });
  assert.equal(f.service.supports('0', '1'), true);
  assert.equal(f.service.supports('0', 'unprepared'), false);
  f.tick(0); f.tick(5000); assert.equal(f.paints.length, 0);
  bank.resolve({ resources: f.resources, destroy: () => f.resources.destroy(), projection: () => undefined, prepareView: async () => {} });
  const handoff = await task;
  assert.deepEqual(handoff.mountOptions.initialWorldCamera, target);
  await handoff.afterMount(f.mounted(), { signal: f.controller.signal });
  assert.equal(f.paints.length, 1);
  assert.equal(f.pending, 0);
});

test('saved camera endpoints survive the early owner handoff unchanged', async () => {
  const f = fixture();
  const saved = { camera: { distanceKilometers: 12, pose: { schema: 'cssearth-camera-pose@2',
    scene: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)' } }, preparedEpochJdTt: 1,
    playback: { times: [123], speed: 1, motionRequested: false } };
  const target = savedWorldCamera(saved, f.factory.navigation.frame, f.navigation.optics());
  const task = f.start({ url: `https://example.test/1/?${formatSharedView(saved)}` });
  f.tick(0); f.tick(5000); const handoff = await drainFrames(f, { task });
  assert.notDeepEqual(handoff.mountOptions.initialWorldCamera, target);
  const continuation = handoff.afterMount(f.mounted(), { signal: f.controller.signal });
  f.step(); await drainFrames(f, { task: continuation });
  closePose(f.navigation.capture().pose, target.pose);
});


test('refocusing the selected object paints one existing owner without reloading its prepared bank', async () => {
  const f = fixture();
  const initial = f.navigation.capture();
  const target = createWorldSelectionTarget(initial, f.navigation.frame, f.navigation.optics());
  const task = f.service.focus({ objectId: '0', mount: { navigation: f.navigation }, signal: f.controller.signal });
  await drainFrames(f, { task });
  assert.ok(f.paints.length > 2);
  closePose(f.navigation.capture().pose, target.pose);
  assert.equal(f.resources.destroyed, 0);
  assert.equal(f.pending, 0);
  for (const name of ['pointerdown', 'wheel', 'keydown']) assert.equal(getEventListeners(f.documentTarget, name).length, 0);
});

test('the application keeps flying while destination groups activate, then transfers the live pose without a reset', async () => {
  const f = fixture(), context = [];
  const task = f.start({ presentWorld: world => context.push(world) });
  const handoff = await drainFrames(f, { task });
  const checkpoint = handoff.mountOptions.initialWorldCamera;
  for (let i=0; i<12; i++) f.step();
  assert.ok(context.length > 5, 'The universe still presents frames while no detail owner is ready');
  assert.notDeepEqual(context.at(-1), checkpoint, 'Mounting must not freeze the camera at handoff');
  const mount = f.mounted();
  handoff.mountOptions.onNavigationReady(mount.navigation);
  assert.deepEqual(mount.navigation.capture(), context.at(-1));
  for (let i=0; i<12; i++) f.step();
  assert.deepEqual(mount.navigation.capture(), context.at(-1), 'The incoming camera tracks the live world before full readiness');
  const incoming = mount.navigation.capture(), count = context.length;
  const finished = handoff.afterMount(mount, {signal:f.controller.signal});
  assert.deepEqual(mount.navigation.capture(), incoming, 'Full readiness does not reset to the initial checkpoint');
  await drainFrames(f, {task:finished});
  assert.equal(context.length,count, 'The mounted owner takes over publication without duplicate universe writes');
  assert.equal(f.pending,0);
});

test('cancellation during connected activation stops the application flight and releases its resources', async () => {
  const f = fixture(), context=[];
  const handoff = await drainFrames(f,{task:f.start({presentWorld:world=>context.push(world)})});
  f.step(); const count=context.length;
  f.controller.abort(); f.step();
  assert.equal(context.length,count);
  assert.equal(f.pending,0);
  assert.equal(f.resources.destroyed,1);
  for (const name of ['pointerdown','wheel','keydown']) assert.equal(getEventListeners(f.documentTarget,name).length,0);
});

test('real input interrupts a same-object focus at the last painted camera', async () => {
  const f = fixture();
  const task = f.service.focus({ objectId: '0', mount: { navigation: f.navigation }, signal: f.controller.signal });
  f.tick(0); f.tick(100);
  const drawn = f.navigation.capture();
  f.input();
  await assert.rejects(task, error => error.name === 'AbortError' && error.preserveView === true);
  f.tick(10000);
  assert.deepEqual(f.navigation.capture(), drawn);
  assert.equal(f.pending, 0);
});

test('replacement departure uses the retained world while its previous detail owner is retired', async () => {
  const f = fixture(), context = [];
  f.navigation.apply({ ...f.navigation.capture(), pose: { positionM: [0, 0, 2e8], orientationXyzw: [0, 0, 0, 1] } });
  const handoff = await drainFrames(f, { task: f.start({ presentWorld: world => context.push(world) }) });
  handoff.mountOptions.onNavigationReady(f.mounted().navigation);
  for (let frame = 0; frame < 12; frame++) f.step();
  const drawn = context.at(-1);
  f.controller.abort();
  const retiredPaintCount = f.paints.length, beforeReplacement = context.length;
  const replacement = new AbortController(), factory = deferred(), phases = [];
  const task = f.start({ fromId: '1', toId: '0', fromMount: null, toFactory: factory.promise,
    signal: replacement.signal, presentWorld: world => context.push(world), timing: { mark: phase => phases.push(phase) } });
  f.step(); f.step();
  assert.deepEqual(context[beforeReplacement], drawn, 'Replacement starts from the last drawn world pose');
  assert.notDeepEqual(context.at(-1), drawn, 'Retiring detail must not make motion wait for the next factory');
  assert.deepEqual(phases, ['first-motion']);
  assert.equal(f.paints.length, retiredPaintCount, 'The disposed detail owner receives no camera writes');
  factory.resolve(f.factory);
  const nextHandoff = await drainFrames(f, { task });
  const target = createWorldSelectionTarget(drawn, f.navigation.frame, f.navigation.optics());
  const mount = { navigation: f.navigation };
  nextHandoff.mountOptions.onNavigationReady(mount.navigation);
  await drainFrames(f, { task: nextHandoff.afterMount(mount, { signal: replacement.signal }) });
  closePose(f.navigation.capture().pose, target.pose);
  assert.equal(f.pending, 0);
  for (const name of ['pointerdown', 'wheel', 'keydown']) assert.equal(getEventListeners(f.documentTarget, name).length, 0);
});
