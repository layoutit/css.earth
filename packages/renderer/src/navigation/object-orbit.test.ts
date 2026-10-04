import { createCameraMotion } from './camera-motion.js';
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { getEventListeners } from 'node:events';
import scene from '../../../../src/objects/mercury/prepared/scene.json' with { type: 'json' };
import { createRetainedCubicSkyOrbit } from './object-orbit.js';
import { createPerspectiveDolly } from './perspective-dolly.js';
import { presentWorldCamera } from './world-camera.js';
import { poleHoldFor, turnPoleHeld } from './pole-held-drag.js';
import { worldRotationCss, worldRotationFromQuaternion } from '@cssearth/engine';

const frame = Object.freeze({ referenceFrame: 'sun-icrf', epochJdTt: 1, originM: [3e7, 4e7, 5e7] as const,
  presentationToReference: [0,1,0,1,0,0,0,0,1], metersPerUnit: 2, bodyRadiusM: 200 });
const optics = { focalPixels: 1000, principalOffsetPixels: [-170, 0] as const, framingRadiusPixels: 200 };

function fixture(preparedSurfaceHitTest?: (clientX: number, clientY: number) => boolean, cameraPlan: any = scene.camera) {
  class Surface extends EventTarget {
    style: Record<string, any> = { setProperty() {}, removeProperty() {} };
    dataset: Record<string, string> = {};
    isConnected = true;
    ownerDocument: any;
    readonly x: number;
    constructor(x = 0) { super(); this.x = x; }
    getBoundingClientRect() { return { x: this.x, y: 0, left: this.x, top: 0, width: 1600, height: 900 }; }
    system: { style: { transform: string } } | null = null;
    querySelector() { return this.system; }
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
  let physicalOwners = 0, publications = 0, yaw = 0;
  const callbacks: any = {};
  const control = { stop() {}, destroy() {}, update() {}, stats: () => ({}), invalidateTrackball() {} };
  const cameraMotion = createCameraMotion();
  const orbit = createRetainedCubicSkyOrbit({ cameraMotion, stage, inputSurface: stage, cameraElement, sceneElement,
    viewport: { read: () => ({ bounds: stage.getBoundingClientRect(), focalPixels: 1000, previewTop: null, openArea: null }), subscribe: () => () => {}, destroy() {} },
    framePresenter: { present(request: any) { request.commit(); } },
    worldContext: { frame, bodyRadiusUnits: 100, kilometersPerUnit: .002, maximumExtentUnits: 1e8 },
    cameraPlan, objectId: 'unit', runtimePolicy: { MOBILE_VIEWPORT_QUERY: '(max-width: 500px)' },
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
      rotate(delta: any) { yaw += delta.yawDelta ?? 0; if (!delta.rotation) return;
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
  let ticking: AbortSignal | undefined, started = 0;
  const paint = () => { const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback(time)); };
  return { orbit, callbacks, roots, world, view,
    get physicalOwners() { return physicalOwners; }, get publications() { return publications; }, get yaw() { return yaw; },
    tick(progress: number) {
      if (ticking !== cameraMotion.signal) { ticking = cameraMotion.signal; started = time; paint(); }
      time = started + progress * 1000; paint();
    },
  };
}

function close(actual: readonly number[], expected: readonly number[], tolerance = 1e-10) {
  actual.forEach((value, axis) => assert.ok((Math.abs(value - expected[axis]) / Math.max(1, Math.abs(expected[axis]))) < tolerance));
}

it('uses prepared surface picking for detail flights', () => {
  // The published level of detail gates picking; no lane needs to write `data-lod` on the stage.
  const f = fixture((x, y) => x === 23 && y === 45);
  const hit = f.callbacks.drag.surfaceFlyToHitTest;
  assert.equal(hit(23, 45), true);
  assert.equal(hit(24, 45), false);
  f.orbit.destroy();
});

it('holds a pole-held drag to the body pole without a stage level-of-detail attribute', () => {
  // Earth's paged globe writes no `data-lod`; its drags still turn about the system node's +Z pole.
  const f = fixture(undefined, { ...scene.camera, drag: { model: 'pole-held-tumble' } });
  f.roots[2]!.system = { style: { transform: 'rotateX(90deg)' } };
  assert.equal(f.roots[0]!.dataset.lod, undefined);
  const { pole, meridian } = f.callbacks.drag.trackballMetrics();
  assert.ok(Array.isArray(pole) && Array.isArray(meridian), 'pole-held drag lost its pole or its meridian');
  assert.ok(Math.abs(Math.hypot(...pole) - 1) < 1e-9 && Math.abs(Math.hypot(...meridian) - 1) < 1e-9);
  // The meridian is the system node's +X axis: across the pole.
  assert.ok(Math.abs(pole[0]! * meridian[0]! + pole[1]! * meridian[1]! + pole[2]! * meridian[2]!) < 1e-9);
  // With the drawn body and the viewport from the dolly, the controller has all a pole-held drag needs.
  const metrics = f.callbacks.drag.trackballMetrics(), hold = poleHoldFor(metrics);
  assert.ok(hold, 'the published trackball does not start a pole-held drag');
  // The drag turns its own copy of the pole and meridian; the camera, given the same rotation, publishes the same two.
  const rotation = turnPoleHeld(hold, metrics, { startX: metrics.centerX, startY: metrics.centerY, endX: metrics.centerX + 30, endY: metrics.centerY + 12 });
  assert.equal(hold.rotating, false, 'the disc centre missed the drawn body');
  f.callbacks.drag.rotate({ controlPitchDelta: 0, controlYawDelta: 0, rotation });
  const turned = f.callbacks.drag.trackballMetrics();
  close(turned.pole, hold.pole, 1e-9); close(turned.meridian, hold.meridian, 1e-9);
  assert.ok(Math.abs(turned.pole[0] - pole[0]!) + Math.abs(turned.pole[2] - pole[2]!) > 1e-3, 'the drag did not turn the body');
  f.orbit.destroy();
});

it('holds its last frame while a flight passes through the body, and still refuses a camera placed inside it', async () => {
  const f = fixture();
  const before = f.orbit.captureWorldCamera(frame);
  const inside = { ...before, pose: { ...before.pose, positionM: [frame.originM[0] + 50, frame.originM[1], frame.originM[2]] as const } };
  await f.orbit.applyWorldCamera(inside, frame, new AbortController().signal);
  assert.deepEqual(f.orbit.captureWorldCamera(frame).pose.positionM, before.pose.positionM, 'the flight step inside the body is not adopted');
  assert.throws(() => f.orbit.applyWorldCamera(inside, frame), /inside the focused body/u);
  f.orbit.destroy();
});

it('turns sideways at a steady rate from the current view, keeping its distance, until its signal aborts', async () => {
  const f = fixture();
  const before = f.orbit.state();
  const turn = f.orbit.turn(60, 1000);
  for (const [progress, degrees] of [[.25, 15], [.5, 30], [1, 60]] as const) {
    f.tick(progress); await Promise.resolve();
    assert.ok(Math.abs(f.yaw - degrees) < 1e-9, `${degrees} degrees at ${progress}: ${f.yaw}`);
  }
  assert.deepEqual(await turn, { completed: true });
  assert.equal(f.orbit.state().zoom, before.zoom);
  assert.equal(f.orbit.state().distance, before.distance);
  const takeover = new AbortController();
  const stopped = f.orbit.turn(60, 1000, takeover.signal);
  f.tick(.5); await Promise.resolve();
  takeover.abort();
  f.tick(1);
  assert.deepEqual(await stopped, { completed: false });
  assert.ok(Math.abs(f.yaw - 90) < 1e-9, `a taken-over turn stays where it was: ${f.yaw}`);
  assert.deepEqual(await f.orbit.turn(60, 1000, takeover.signal), { completed: false });
  f.orbit.destroy();
});
