import { expect, it } from 'vitest';
import { getEventListeners } from 'node:events';
import scene from '../../../objects/mercury/prepared/scene.json';
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
  const view = Object.assign(new EventTarget(), { getComputedStyle: () => ({ perspective: '1000px', perspectiveOrigin: '800px 450px' }),
    matchMedia: () => ({ matches: false }) });
  const roots = [new Surface(), new Surface(170), new Surface(), new Surface()];
  roots.forEach(root => { root.ownerDocument = { defaultView: view }; });
  const [stage, cameraElement, sceneElement, skyElement] = roots;
  let rotation = [1,0,0,0,1,0,0,0,1];
  let liveMotion: any = null, resolveMotion: any, physicalOwners = 0, publications = 0;
  const callbacks: any = {};
  function finish(completed: boolean) {
    if (liveMotion) { liveMotion.signal?.removeEventListener('abort', stop); liveMotion = null; resolveMotion({ completed }); }
  }
  function stop() { finish(false); }
  const control = { stop, destroy: stop, update() {}, stats: () => ({}), invalidateTrackball() {},
    flyTo(motion: any) { stop(); liveMotion = motion; return new Promise(resolve => {
      resolveMotion = resolve; motion.signal?.addEventListener('abort', stop, { once: true });
      if (motion.signal?.aborted) stop();
    }); } };
  const orbit = createRetainedCubicSkyOrbit({ stage, inputSurface: stage, cameraElement, sceneElement,
    cubicSky: { root: skyElement, setOrientation() {} }, requireSun: false,
    skyPlan: { cameraContract: 'scene-locked-unbounded-accumulated-matrix3d' },
    worldContext: { frame, bodyRadiusUnits: 100, kilometersPerUnit: .002, maximumExtentUnits: 1e8 },
    cameraPlan: scene.camera, objectId: 'unit', runtimePolicy: { MOBILE_VIEWPORT_QUERY: '(max-width: 500px)' },
    preparedSurfaceHitTest,
    onPublish() { publications++; }, onError(error: unknown) { throw error; },
  } as any, { HTMLElement: Surface,
    createPerspectiveDolly(options: any) { physicalOwners++; return createPerspectiveDolly(options); },
    createCubicSkyCameraOrientation() {
      return { scene: () => worldRotationCss(rotation), sceneMatrix: () => ({
        m11: rotation[0], m21: rotation[1], m31: rotation[2], m12: rotation[3], m22: rotation[4], m32: rotation[5],
        m13: rotation[6], m23: rotation[7], m33: rotation[8] }),
      setSceneRotation(value: number[]) { rotation = [...value]; },
      skybox: () => ({ matrix: worldRotationCss(rotation), sunViewDirection: null }),
      snapshot: () => ({ schema: 'cssearth-camera-pose@2', scene: worldRotationCss(rotation) }),
      counterRotation: () => worldRotationCss(rotation),
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
  return { orbit, callbacks, roots, world, range, focusView, view,
    get physicalOwners() { return physicalOwners; }, get publications() { return publications; },
    tick(progress: number) { const motion = liveMotion; if (!motion) throw new Error('No retained flight'); motion.sample(progress);
      if (progress === 1) finish(true); },
  };
}

function close(actual: readonly number[], expected: readonly number[], tolerance = 1e-10) {
  actual.forEach((value, axis) => expect(Math.abs(value - expected[axis]) / Math.max(1, Math.abs(expected[axis]))).toBeLessThan(tolerance));
}

it('uses prepared surface picking for detail flights and suppresses them while a catalogue focus owns input', () => {
  const f = fixture((x, y) => x === 23 && y === 45);
  f.roots[0]!.dataset.lod = 'geometry';
  const hit = f.callbacks.drag.surfaceFlyToHitTest;
  expect(hit(23, 45)).toBe(true);
  expect(hit(24, 45)).toBe(false);
  f.orbit.setPreparedFocus(focus, frame);
  expect(hit(23, 45)).toBe(false);
  f.orbit.setPreparedFocus(null, frame);
  expect(hit(23, 45)).toBe(true);
  f.orbit.destroy();
});

it('flies, drags and dollies around a prepared focus while retaining the original detail frame and camera', async () => {
  const f = fixture(), roots = [...f.roots], initial = f.world();
  const flight = f.orbit.flyToPreparedFocus(focus, frame, optics);
  expect(f.orbit.preparedFocus()?.id).toBe(focus.id);
  close(f.world().pose.positionM, initial.pose.positionM);
  f.tick(.35);
  expect(f.world().pose.positionM).not.toEqual(initial.pose.positionM);
  expect(f.range()).toBeGreaterThan(focus.arrivalDistanceM!);
  f.tick(1);
  expect(await flight).toEqual({ completed: true });
  expect(f.range() / focus.arrivalDistanceM!).toBeCloseTo(1, 12);
  const arrived = f.focusView().centerPixels!;
  close(arrived, [0,0], 1e-9);
  const oldDetailRange = f.range(frame.originM);
  f.callbacks.drag.rotate({ controlPitchDelta: 0, controlYawDelta: 45, rotation: [0, Math.sin(Math.PI/8), 0, Math.cos(Math.PI/8)] });
  expect(f.range() / focus.arrivalDistanceM!).toBeCloseTo(1, 12);
  close(f.focusView().centerPixels!, arrived, 1e-9);
  expect(f.range(frame.originM)).not.toBe(oldDetailRange);
  const metrics = f.callbacks.drag.trackballMetrics();
  expect(metrics.centerX).toBeCloseTo(970, 8);
  expect(metrics.centerY).toBeCloseTo(450, 8);
  const distance = f.callbacks.wheel.camera.state.distance;
  f.callbacks.wheel.rotate({ controlPitchDelta: 0, controlYawDelta: 0, distance: distance * 2 });
  expect(f.range() / (focus.arrivalDistanceM! * 2)).toBeCloseTo(1, 12);
  close(f.focusView().centerPixels!, arrived, 1e-9);
  f.callbacks.wheel.rotate({ controlPitchDelta: 0, controlYawDelta: 0, distance: 1e30 });
  expect(f.range() / focus.limits.maximumDistanceM).toBeCloseTo(1, 12);
  expect(f.orbit.sharedState().distanceKilometers! * 1000 / f.range(frame.originM)).toBeCloseTo(1, 12);
  expect(f.physicalOwners).toBe(1);
  expect(f.roots).toEqual(roots);
  expect(frame.originM).toEqual([3e7,4e7,5e7]);
  expect(f.publications).toBeGreaterThan(5);
  f.orbit.destroy();
});

it('restores a focus without moving the saved world pose, then clears it without a jump on return', async () => {
  const f = fixture();
  await f.orbit.flyToPreparedFocus(focus, frame, optics, { reducedMotion: true });
  const saved = f.orbit.sharedState(), before = f.world();
  f.orbit.setState(saved);
  expect(f.orbit.preparedFocus()).toBeNull();
  f.orbit.setPreparedFocus(focus, frame);
  close(f.world().pose.positionM, before.pose.positionM);
  close(f.world().pose.orientationXyzw, before.pose.orientationXyzw);
  const translated = { ...before, pose: { ...before.pose, positionM: before.pose.positionM.map((v, i) => v + (i === 0 ? 1e18 : 0)) as any } };
  f.orbit.applyWorldCamera(translated, frame);
  close(f.world().pose.positionM, translated.pose.positionM);
  const currentRange = f.range();
  f.callbacks.wheel.rotate({ controlPitchDelta: 0, controlYawDelta: 0, distance: f.callbacks.wheel.camera.state.distance * .9 });
  expect(f.range() / currentRange).toBeCloseTo(.9, 12);
  const returnStart = f.world();
  f.orbit.setPreparedFocus(null, frame);
  close(f.world().pose.positionM, returnStart.pose.positionM);
  const detailRange = f.range(frame.originM);
  f.callbacks.drag.rotate({ controlPitchDelta: 0, controlYawDelta: 30, rotation: [0, Math.sin(Math.PI/12), 0, Math.cos(Math.PI/12)] });
  expect(f.range(frame.originM) / detailRange).toBeCloseTo(1, 12);
  expect(f.range() / currentRange).not.toBeCloseTo(.9, 3);
  f.orbit.destroy();
});

it('uses the retained motion owner for interruption, replacement and teardown, rejecting invalid focus before moving', async () => {
  const f = fixture(), controller = new AbortController();
  const pending = f.orbit.flyToPreparedFocus(focus, frame, optics, { signal: controller.signal });
  f.tick(.2);
  const interrupted = f.world();
  controller.abort();
  expect(await pending).toEqual({ completed: false });
  expect(getEventListeners(controller.signal, 'abort')).toHaveLength(0);
  close(f.world().pose.positionM, interrupted.pose.positionM);
  expect(f.orbit.preparedFocus()?.id).toBe(focus.id);
  await expect(f.orbit.flyToPreparedFocus({ ...focus, limits: { minimumDistanceM: 1, maximumDistanceM: 0 } }, frame, optics)).rejects.toThrow('metadata');
  close(f.world().pose.positionM, interrupted.pose.positionM);
  const replacement = f.orbit.flyToPreparedFocus(focus, frame, optics);
  // Catalogue ids such as the dwarf galaxy dw1343+58 carry a plus sign.
  const final = f.orbit.flyToPreparedFocus({ ...focus, id: 'dw1343+58', positionM: [2e20, -1e20, 3e20] }, frame, optics);
  expect(await replacement).toEqual({ completed: false });
  f.orbit.destroy();
  expect(await final).toEqual({ completed: false });
  for (const name of ['pointerdown','pointermove','pointerup','wheel','resize']) expect(getEventListeners(f.view, name)).toHaveLength(0);
});

it('arrives on the line of sight from the Sun, celestial north up, whatever the previous view faced', async () => {
  const poses = [];
  for (const turned of [false, true]) {
    const f = fixture();
    // Face the opposite way first: the Crab bug arrived behind its nebula, looking back at the Sun.
    if (turned) f.callbacks.drag.rotate({ controlPitchDelta: 0, controlYawDelta: 180, rotation: [0, 1, 0, 0] });
    const flight = f.orbit.flyToPreparedFocus(focus, frame, optics);
    f.tick(1);
    expect(await flight).toEqual({ completed: true });
    poses.push(f.world().pose);
    f.orbit.destroy();
  }
  close(poses[1]!.positionM, poses[0]!.positionM, 1e-9);
  close(poses[1]!.orientationXyzw, poses[0]!.orientationXyzw, 1e-9);
  const { positionM, orientationXyzw } = poses[0]!;
  const length = (v: readonly number[]) => Math.hypot(...v);
  // Between the Sun and the focus, at the arrival distance.
  expect(length(positionM)).toBeLessThan(length(focus.positionM));
  const sight = focus.positionM.map(v => v / length(focus.positionM));
  const offset = focus.positionM.map((v, axis) => v - positionM[axis]!);
  // The ray through the principal point, offset beside the panel, is the sightline; the view axis leaves it by that angle.
  const principal = Math.cos(Math.atan2(Math.hypot(...optics.principalOffsetPixels), optics.focalPixels));
  expect(offset.reduce((sum, v, axis) => sum + v * sight[axis]!, 0) / length(offset)).toBeCloseTo(1, 9);
  const forward = [-worldRotationFromQuaternion(orientationXyzw)[2]!, -worldRotationFromQuaternion(orientationXyzw)[5]!, -worldRotationFromQuaternion(orientationXyzw)[8]!];
  expect(forward.reduce((sum, v, axis) => sum + v * sight[axis]!, 0)).toBeCloseTo(principal, 9);
  // Camera +y (up) leans toward celestial north.
  const axes = worldRotationFromQuaternion(orientationXyzw);
  expect(axes[7]).toBeGreaterThan(0);
});
