import { createCameraMotion } from './camera-motion.js';
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { getEventListeners } from 'node:events';
import scene from '../../../../src/objects/mercury/prepared/scene.json' with { type: 'json' };
import { createRetainedCubicSkyOrbit } from './object-orbit.js';
import { createPerspectiveDolly } from './perspective-dolly.js';
import { presentWorldCamera } from './world-camera.js';
import { worldRotationCss, worldRotationFromQuaternion } from './world-camera-math.js';
import type { PreparedNavigationFocus } from './prepared-focus.js';

const frame = Object.freeze({ referenceFrame: 'sun-icrf', epochJdTt: 1, originM: [3e7, 4e7, 5e7] as const,
  presentationToReference: [0,1,0,1,0,0,0,0,1], metersPerUnit: 2, bodyRadiusM: 200 });
const focus: PreparedNavigationFocus = { id: 'catalogue:7', positionM: [1e20, 2e20, -3e20], framingRadiusM: 1e18,
  limits: { minimumDistanceM: 1e13, maximumDistanceM: 1e22 }, upReference: [0, 0, 1], arrivalDistanceM: 4e18 };
const optics = { focalPixels: 1000, principalOffsetPixels: [-170, 0] as const, framingRadiusPixels: 200 };

function fixture(preparedSurfaceHitTest?: (clientX: number, clientY: number) => boolean) {
  class Surface extends EventTarget {
    style: Record<string, any> = { setProperty() {}, removeProperty() {} };
    dataset: Record<string, string> = {};
    isConnected = true;
    ownerDocument: any;
    readonly x: number;
    constructor(x = 0) { super(); this.x = x; }
    getBoundingClientRect() { return { x: this.x, y: 0, left: this.x, top: 0, width: 1600, height: 900 }; }
  }
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0, time = 0;
  const view = Object.assign(new EventTarget(), { getComputedStyle: () => ({ perspective: '1000px', perspectiveOrigin: '800px 450px' }),
    matchMedia: () => ({ matches: false }), performance: { now: () => time },
    requestAnimationFrame(callback: FrameRequestCallback) { frames.set(++nextFrame, callback); return nextFrame; },
    cancelAnimationFrame(id: number) { frames.delete(id); } });
  const roots = [new Surface(), new Surface(170), new Surface(), new Surface()];
  roots.forEach(root => { root.ownerDocument = { defaultView: view }; });
  const [stage, cameraElement, sceneElement, skyElement] = roots;
  let rotation = [1,0,0,0,1,0,0,0,1];
  let physicalOwners = 0, publications = 0;
  const callbacks: any = {};
  const control = { stop() {}, destroy() {}, update() {}, stats: () => ({}), invalidateTrackball() {} };
  const cameraMotion = createCameraMotion();
  const orbit = createRetainedCubicSkyOrbit({ cameraMotion, stage, inputSurface: stage, cameraElement, sceneElement,
    viewport: { read: () => ({ bounds: stage.getBoundingClientRect(), focalPixels: 1000, previewTop: null, openArea: null }), subscribe: () => () => {}, destroy() {} },
    framePresenter: { present(request: any) { request.commit(); } },
    worldContext: { frame, bodyRadiusUnits: 100, kilometersPerUnit: .002, maximumExtentUnits: 1e8 },
    cameraPlan: scene.camera, objectId: 'unit', runtimePolicy: { MOBILE_VIEWPORT_QUERY: '(max-width: 500px)' },
    preparedSurfaceHitTest,
    onPublish() { publications++; }, onError(error: unknown) { throw error; },
  } as any, { HTMLElement: Surface,
    createPerspectiveDolly(options: any, orientation: any) { physicalOwners++; return createPerspectiveDolly(options, orientation); },
    createCameraOrientation() {
      return { scene: () => worldRotationCss(rotation), sceneMatrix: () => ({
        m11: rotation[0], m21: rotation[1], m31: rotation[2], m12: rotation[3], m22: rotation[4], m32: rotation[5],
        m13: rotation[6], m23: rotation[7], m33: rotation[8] }),
      setSceneRotation(value: number[]) { rotation = [...value]; },
      sunViewDirection: () => null,
      snapshot: () => ({ schema: 'cssearth-camera-pose@2', scene: worldRotationCss(rotation) }),
      captureCounterRotation: () => () => worldRotationCss(rotation),
      restore(pose: any) { const m = pose.scene.slice(9,-1).split(',').map(Number); rotation = [m[0],m[4],m[8],m[1],m[5],m[9],m[2],m[6],m[10]]; },
      rotate(delta: any) { if (!delta.rotation) return;
        const next = worldRotationFromQuaternion(delta.rotation);
        rotation = [0,1,2].flatMap(row => [0,1,2].map(column => [0,1,2].reduce((sum,k) => sum + next[row*3+k] * rotation[k*3+column], 0)));
      } };
    },
    createUnboundedMatrixDragControls(options: any) { callbacks.drag = options; return control; },
    createPreparedWheelZoomControls(options: any) { callbacks.wheel = options; return { ...control, stop() {}, destroy() {} }; },
    bindResponsiveOrbitPolicy: () => ({ mobile: false, destroy() {} }),
    selectPreparedResponsiveZoom: () => ({ zoom: 1, model: 'unit', widthShare: .5 }),
  } as any);
  const world = () => orbit.captureWorldCamera(frame);
  const range = (point = focus.positionM) => Math.hypot(...world().pose.positionM.map((v, axis) => v - point[axis]));
  const focusView = () => presentWorldCamera(world(), { ...frame, originM: focus.positionM, bodyRadiusM: focus.framingRadiusM }, optics);
  let ticking: AbortSignal | undefined, started = 0;
  const paint = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(time)); };
  return { orbit, callbacks, roots, world, range, focusView, view,
    get physicalOwners() { return physicalOwners; }, get publications() { return publications; },
    tick(progress: number) {
      if (ticking !== cameraMotion.signal) { ticking = cameraMotion.signal; started = time; paint(); }
      time = started + progress * 1000; paint();
    },
  };
}

function close(actual: readonly number[], expected: readonly number[], tolerance = 1e-10) {
  actual.forEach((value, axis) => assert.ok((Math.abs(value - expected[axis]) / Math.max(1, Math.abs(expected[axis]))) < tolerance));
}

it('uses prepared surface picking for detail flights and suppresses them while a catalogue focus owns input', () => {
  const f = fixture((x, y) => x === 23 && y === 45);
  f.roots[0]!.dataset.lod = 'geometry';
  const hit = f.callbacks.drag.surfaceFlyToHitTest;
  assert.equal(hit(23, 45), true);
  assert.equal(hit(24, 45), false);
  f.orbit.setPreparedFocus(focus, frame);
  assert.equal(hit(23, 45), false);
  f.orbit.setPreparedFocus(null, frame);
  assert.equal(hit(23, 45), true);
  f.orbit.destroy();
});

it('flies, drags and dollies around a prepared focus while retaining the original detail frame and camera', async () => {
  const f = fixture(), roots = [...f.roots], initial = f.world();
  const flight = f.orbit.flyToPreparedFocus(focus, frame, optics, { durationMilliseconds: 1000 });
  assert.equal(f.orbit.preparedFocus()?.id, focus.id);
  close(f.world().pose.positionM, initial.pose.positionM);
  f.tick(.35);
  assert.notDeepEqual(f.world().pose.positionM, initial.pose.positionM);
  assert.ok(f.range() > focus.arrivalDistanceM!);
  f.tick(1);
  assert.deepEqual((await flight), { completed: true });
  assert.ok(Math.abs((f.range() / focus.arrivalDistanceM!) - (1)) < 10 ** -12 / 2, `${(f.range() / focus.arrivalDistanceM!)} is not close to ${1}`);
  const arrived = f.focusView().centerPixels!;
  close(arrived, [0,0], 1e-9);
  const oldDetailRange = f.range(frame.originM);
  f.callbacks.drag.rotate({ controlPitchDelta: 0, controlYawDelta: 45, rotation: [0, Math.sin(Math.PI/8), 0, Math.cos(Math.PI/8)] });
  assert.ok(Math.abs((f.range() / focus.arrivalDistanceM!) - (1)) < 10 ** -12 / 2, `${(f.range() / focus.arrivalDistanceM!)} is not close to ${1}`);
  close(f.focusView().centerPixels!, arrived, 1e-9);
  assert.notEqual(f.range(frame.originM), oldDetailRange);
  const metrics = f.callbacks.drag.trackballMetrics();
  assert.ok(Math.abs(metrics.centerX - (970)) < 10 ** -8 / 2, `${metrics.centerX} is not close to ${970}`);
  assert.ok(Math.abs(metrics.centerY - (450)) < 10 ** -8 / 2, `${metrics.centerY} is not close to ${450}`);
  const distance = f.callbacks.wheel.camera.state.distance;
  f.callbacks.wheel.rotate({ controlPitchDelta: 0, controlYawDelta: 0, distance: distance * 2 });
  assert.ok(Math.abs((f.range() / (focus.arrivalDistanceM! * 2)) - (1)) < 10 ** -12 / 2, `${(f.range() / (focus.arrivalDistanceM! * 2))} is not close to ${1}`);
  close(f.focusView().centerPixels!, arrived, 1e-9);
  f.callbacks.wheel.rotate({ controlPitchDelta: 0, controlYawDelta: 0, distance: 1e30 });
  assert.ok(Math.abs((f.range() / focus.limits.maximumDistanceM) - (1)) < 10 ** -12 / 2, `${(f.range() / focus.limits.maximumDistanceM)} is not close to ${1}`);
  assert.ok(Math.abs((f.orbit.sharedState().distanceKilometers! * 1000 / f.range(frame.originM)) - (1)) < 10 ** -12 / 2, `${(f.orbit.sharedState().distanceKilometers! * 1000 / f.range(frame.originM))} is not close to ${1}`);
  assert.equal(f.physicalOwners, 1);
  assert.deepEqual(f.roots, roots);
  assert.deepEqual(frame.originM, [3e7,4e7,5e7]);
  assert.ok(f.publications > 5);
  f.orbit.destroy();
});

it('restores a focus without moving the saved world pose, then clears it without a jump on return', async () => {
  const f = fixture();
  await f.orbit.flyToPreparedFocus(focus, frame, optics, { reducedMotion: true });
  const saved = f.orbit.sharedState(), before = f.world();
  f.orbit.setState(saved);
  assert.equal(f.orbit.preparedFocus(), null);
  f.orbit.setPreparedFocus(focus, frame);
  close(f.world().pose.positionM, before.pose.positionM);
  close(f.world().pose.orientationXyzw, before.pose.orientationXyzw);
  const translated = { ...before, pose: { ...before.pose, positionM: before.pose.positionM.map((v, i) => v + (i === 0 ? 1e18 : 0)) as any } };
  f.orbit.applyWorldCamera(translated, frame);
  close(f.world().pose.positionM, translated.pose.positionM);
  const currentRange = f.range();
  f.callbacks.wheel.rotate({ controlPitchDelta: 0, controlYawDelta: 0, distance: f.callbacks.wheel.camera.state.distance * .9 });
  assert.ok(Math.abs((f.range() / currentRange) - (.9)) < 10 ** -12 / 2, `${(f.range() / currentRange)} is not close to ${.9}`);
  const returnStart = f.world();
  f.orbit.setPreparedFocus(null, frame);
  close(f.world().pose.positionM, returnStart.pose.positionM);
  const detailRange = f.range(frame.originM);
  f.callbacks.drag.rotate({ controlPitchDelta: 0, controlYawDelta: 30, rotation: [0, Math.sin(Math.PI/12), 0, Math.cos(Math.PI/12)] });
  assert.ok(Math.abs((f.range(frame.originM) / detailRange) - (1)) < 10 ** -12 / 2, `${(f.range(frame.originM) / detailRange)} is not close to ${1}`);
  assert.ok(!(Math.abs((f.range() / currentRange) - (.9)) < 10 ** -3 / 2));
  f.orbit.destroy();
});

it('uses the retained motion owner for interruption, replacement and teardown, rejecting invalid focus before moving', async () => {
  const f = fixture(), controller = new AbortController();
  const pending = f.orbit.flyToPreparedFocus(focus, frame, optics, { signal: controller.signal, durationMilliseconds: 1000 });
  f.tick(.2);
  const interrupted = f.world();
  controller.abort();
  assert.deepEqual((await pending), { completed: false });
  assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
  close(f.world().pose.positionM, interrupted.pose.positionM);
  assert.equal(f.orbit.preparedFocus()?.id, focus.id);
  await assert.rejects(f.orbit.flyToPreparedFocus({ ...focus, limits: { minimumDistanceM: 1, maximumDistanceM: 0 } }, frame, optics), /metadata/);
  close(f.world().pose.positionM, interrupted.pose.positionM);
  const replacement = f.orbit.flyToPreparedFocus(focus, frame, optics, { durationMilliseconds: 1000 });
  // Catalogue ids such as the dwarf galaxy dw1343+58 carry a plus sign.
  const final = f.orbit.flyToPreparedFocus({ ...focus, id: 'dw1343+58', positionM: [2e20, -1e20, 3e20] }, frame, optics);
  assert.deepEqual((await replacement), { completed: false });
  f.orbit.destroy();
  assert.deepEqual((await final), { completed: false });
  for (const name of ['pointerdown','pointermove','pointerup','wheel','resize']) assert.equal(getEventListeners(f.view, name).length, 0);
});

it('arrives on the line of sight from the Sun, celestial north up, whatever the previous view faced', async () => {
  const poses = [];
  for (const turned of [false, true]) {
    const f = fixture();
    // Face the opposite way first: the Crab bug arrived behind its nebula, looking back at the Sun.
    if (turned) f.callbacks.drag.rotate({ controlPitchDelta: 0, controlYawDelta: 180, rotation: [0, 1, 0, 0] });
    const flight = f.orbit.flyToPreparedFocus(focus, frame, optics, { durationMilliseconds: 1000 });
    f.tick(1);
    assert.deepEqual((await flight), { completed: true });
    poses.push(f.world().pose);
    f.orbit.destroy();
  }
  close(poses[1]!.positionM, poses[0]!.positionM, 1e-9);
  close(poses[1]!.orientationXyzw, poses[0]!.orientationXyzw, 1e-9);
  const { positionM, orientationXyzw } = poses[0]!;
  const length = (v: readonly number[]) => Math.hypot(...v);
  // Between the Sun and the focus, at the arrival distance.
  assert.ok(length(positionM) < length(focus.positionM));
  const sight = focus.positionM.map(v => v / length(focus.positionM));
  const offset = focus.positionM.map((v, axis) => v - positionM[axis]!);
  // The ray through the principal point, offset beside the panel, is the sightline; the view axis leaves it by that angle.
  const principal = Math.cos(Math.atan2(Math.hypot(...optics.principalOffsetPixels), optics.focalPixels));
  assert.ok(Math.abs((offset.reduce((sum, v, axis) => sum + v * sight[axis]!, 0) / length(offset)) - (1)) < 10 ** -9 / 2, `${(offset.reduce((sum, v, axis) => sum + v * sight[axis]!, 0) / length(offset))} is not close to ${1}`);
  const forward = [-worldRotationFromQuaternion(orientationXyzw)[2]!, -worldRotationFromQuaternion(orientationXyzw)[5]!, -worldRotationFromQuaternion(orientationXyzw)[8]!];
  assert.ok(Math.abs(forward.reduce((sum, v, axis) => sum + v * sight[axis]!, 0) - (principal)) < 10 ** -9 / 2, `${forward.reduce((sum, v, axis) => sum + v * sight[axis]!, 0)} is not close to ${principal}`);
  // Camera +y (up) leans toward celestial north.
  const axes = worldRotationFromQuaternion(orientationXyzw);
  assert.ok(axes[7] > 0);
});
