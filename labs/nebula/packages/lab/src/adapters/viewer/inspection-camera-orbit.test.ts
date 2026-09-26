/**
 * The orbit's horizontal response must not depend on the camera's pose, and in particular must not
 * change when the Earth-view pose is applied. The whole shipped chain runs: the real drag delta from
 * `projectTrackballDelta`/`rotationFromAngularVelocity` over the camera's own trackball metrics, the real
 * `createInspectionCamera.rotate` composition (including its east-left conjugation), the real
 * `inspectionCameraRenderer.publication`, and the prepared volume's own camera transform.
 *
 * The measured quantity is camera-attached: a point two units along the camera's own +z (toward the eye)
 * is chosen before each drag, so "near" never swaps meaning when the camera passes a pole. A natural
 * orbit carries that point rightward for a rightward drag, at every pose.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createInspectionCamera, type InspectionCameraBindings } from '@cssearth/volume-viewer/camera/inspection-camera';
import { interactionTrackball, projectTrackballDelta, rotationFromAngularVelocity,
  directAngularDegreesPerTrackballRadius, directPitchResponseForZoom } from '@cssearth/engine';
import type { DensityVolumeFrame } from '@cssearth/bake/volume';
import { inspectionCameraRenderer } from './inspection-camera-renderer';
import { preparedVolumeCameraTransform } from '@cssearth/renderer/volume/prepared-volume-runtime.ts';
import type { VolumeCameraPublication } from '@cssearth/renderer/volume/types.ts';

const WIDTH = 1300, HEIGHT = 950, DRAG_PX = 80;
/** The prepared LMC frame's own shape: an Earth observer 49.59 units away, east-left like the lab's. */
const frame: DensityVolumeFrame = { referenceFrame: 'lab', epochJdTt: 2451545,
  originM: [0, 0, -49.590672750490434], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1,
  boundsUnits: { min: [-5, -5, -5], max: [5, 5, 5] } };

/** Executable fixture: only the members `rotationFromMatrix3d` and the inspection camera actually read. */
class TestMatrix {
  values: number[];
  constructor(values?: number[]) { this.values = values ? [...values] : [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  static rotation(x: number, y: number, z: number, degrees: number): number[] {
    const length = Math.hypot(x, y, z) || 1, [ax, ay, az] = [x / length, y / length, z / length];
    const c = Math.cos(degrees * Math.PI / 180), s = Math.sin(degrees * Math.PI / 180), t = 1 - c;
    // Column-major 4x4, as a DOMMatrix stores it.
    return [t * ax * ax + c, t * ax * ay + s * az, t * ax * az - s * ay, 0,
      t * ax * ay - s * az, t * ay * ay + c, t * ay * az + s * ax, 0,
      t * ax * az + s * ay, t * ay * az - s * ax, t * az * az + c, 0, 0, 0, 0, 1];
  }
  rotateAxisAngle(x: number, y: number, z: number, degrees: number) { return this.multiply(new TestMatrix(TestMatrix.rotation(x, y, z, degrees))); }
  multiply(other: TestMatrix) {
    const a = this.values, b = other.values, out = new Array<number>(16).fill(0);
    for (let column = 0; column < 4; column++) for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row]! * b[column * 4 + k]!;
      out[column * 4 + row] = sum;
    }
    return new TestMatrix(out);
  }
  toFloat64Array() { return new Float64Array(this.values); }
  toString() { return `matrix3d(${this.values.join(',')})`; }
  get m11() { return this.values[0]!; } get m21() { return this.values[4]!; } get m31() { return this.values[8]!; }
  get m12() { return this.values[1]!; } get m22() { return this.values[5]!; } get m32() { return this.values[9]!; }
  get m13() { return this.values[2]!; } get m23() { return this.values[6]!; } get m33() { return this.values[10]!; }
}

function harness(eastLeft: boolean) {
  const host = { clientWidth: WIDTH, clientHeight: HEIGHT, style: {} as Record<string, string>, dataset: {} as Record<string, string>,
    getBoundingClientRect: () => ({ x: 0, y: 0, width: WIDTH, height: HEIGHT }) };
  let bindings: InspectionCameraBindings | null = null;
  let published: VolumeCameraPublication | null = null;
  const previous = { DOMMatrix: globalThis.DOMMatrix, ResizeObserver: globalThis.ResizeObserver,
    requestAnimationFrame: globalThis.requestAnimationFrame, cancelAnimationFrame: globalThis.cancelAnimationFrame };
  Object.assign(globalThis, {
    DOMMatrix: TestMatrix,
    ResizeObserver: class { observe() {} disconnect() {} },
    requestAnimationFrame: () => 0, cancelAnimationFrame: () => {},
  });
  const view = createInspectionCamera<VolumeCameraPublication>({
    host: host as unknown as HTMLElement,
    backend: { rotationFromQuaternion: inspectionCameraRenderer.rotationFromQuaternion,
      publication: inspectionCameraRenderer.publication,
      connect(next) { bindings = next; return { stop() {}, destroy() {} }; } },
    configuration: () => ({ frame, projectionScale: 1, eastLeft }),
    render(publication) { published = publication; }, changed() {}, error(failure) { throw failure; },
  });
  const restore = () => Object.assign(globalThis, previous);
  return { view, host, restore, get bindings() { if (!bindings) throw new Error('Backend was never connected.'); return bindings; },
    publish() { view.publish(); if (!published) throw new Error('Nothing was published.'); return published; } };
}

/** Exactly what `createObjectInteractionControls` hands the camera for one straight drag. */
function dragDelta(bindings: InspectionCameraBindings, zoom: number, dx: number, dy: number) {
  const metrics = { ...interactionTrackball(bindings.trackballMetrics()),
    angularDegreesPerTrackballRadius: directAngularDegreesPerTrackballRadius(zoom),
    pitchResponse: directPitchResponseForZoom(zoom) };
  const projected = projectTrackballDelta({ previousX: WIDTH / 2, previousY: HEIGHT / 2,
    currentX: WIDTH / 2 + dx, currentY: HEIGHT / 2 + dy, centerX: metrics.centerX, centerY: metrics.centerY,
    radius: metrics.radius, angularDegreesPerTrackballRadius: metrics.angularDegreesPerTrackballRadius });
  // A sky gesture, which `tumbleOnly` makes every inspection drag.
  const rotation = rotationFromAngularVelocity([-projected.pitchDegrees * Math.PI / 180, projected.yawDegrees * Math.PI / 180, 0], 1);
  return { controlPitchDelta: projected.pitchDegrees, controlYawDelta: projected.yawDegrees, rotation };
}

/** The camera's own +z (toward the eye) in the prepared local frame, and a point's CSS screen x. */
function cameraFrame(publication: VolumeCameraPublication) {
  const transform = preparedVolumeCameraTransform(publication, frame, 50);
  const r = transform.rotation;
  // Row 2 is the camera's +z with the renderer's [y,x,z] column swap.
  const toEye: [number, number, number] = [r[7]!, r[6]!, r[8]!];
  const screenX = (point: readonly [number, number, number]) => {
    const css = [point[1]! * 50, point[0]! * 50, point[2]! * 50];
    const eye = [0, 1, 2].map(row => r[row * 3]! * css[0]! + r[row * 3 + 1]! * css[1]! + r[row * 3 + 2]! * css[2]! + transform.translationCssPixels[row]!);
    const near = transform.focalPixels - eye[2]!;
    assert.ok(near > 0, 'The probe must stay in front of the camera.');
    const [ox] = publication.viewport.principalOffsetPixels;
    return ox + (eye[0]! - ox) * transform.focalPixels / near;
  };
  return { toEye, screenX };
}

for (const eastLeft of [true, false]) {
  test(`horizontal orbit keeps one sign at every pose, including the Earth-view pose (eastLeft ${eastLeft})`, () => {
    const rig = harness(eastLeft);
    try {
      rig.view.setRadius(5);
      const shifts: { pitchDrags: number; shift: number }[] = [];
      // 0 to 10 rightward-drag-sized pitch drags carries the camera right over the pole and back.
      for (let pitchDrags = 0; pitchDrags <= 10; pitchDrags++) {
        rig.view.referenceView(5, [49.590672750490434]);
        for (let step = 0; step < pitchDrags; step++)
          rig.bindings.rotate(dragDelta(rig.bindings, rig.view.values.zoom, 0, DRAG_PX));
        const before = cameraFrame(rig.publish());
        const probe: [number, number, number] = [before.toEye[0] * 2, before.toEye[1] * 2, before.toEye[2] * 2];
        const startX = before.screenX(probe);
        rig.bindings.rotate(dragDelta(rig.bindings, rig.view.values.zoom, DRAG_PX, 0));
        const endX = cameraFrame(rig.publish()).screenX(probe);
        shifts.push({ pitchDrags, shift: endX - startX });
      }
      // An east-left subject also mirrors its host with `scaleX(-1)`, so the direction the user sees is the
      // projected shift through that mirror. It must be rightward for a rightward drag, at every pose.
      const seen = (shift: number) => shift * (eastLeft ? -1 : 1);
      for (const { pitchDrags, shift } of shifts) {
        assert.ok(Math.abs(shift) > 1, `Pose ${pitchDrags} produced no measurable horizontal response (${shift}).`);
        assert.ok(seen(shift) > 0,
          `Pose ${pitchDrags} reversed the horizontal orbit: the near point moved ${seen(shift).toFixed(2)} px on screen for a rightward drag.`);
      }
      // The Earth-view pose is the one the button writes, and it must not be a special case.
      rig.view.referenceView(5, [49.590672750490434]);
      const earth = cameraFrame(rig.publish());
      const earthProbe: [number, number, number] = [earth.toEye[0] * 2, earth.toEye[1] * 2, earth.toEye[2] * 2];
      const earthStart = earth.screenX(earthProbe);
      rig.bindings.rotate(dragDelta(rig.bindings, rig.view.values.zoom, DRAG_PX, 0));
      const earthShift = cameraFrame(rig.publish()).screenX(earthProbe) - earthStart;
      assert.ok(seen(earthShift) > 0, `The Earth-view pose reversed the horizontal orbit (${seen(earthShift).toFixed(2)} px on screen).`);
      // `reset` reaches the same pose by another path and must agree with it.
      rig.view.reset();
      const fit = cameraFrame(rig.publish());
      const fitProbe: [number, number, number] = [fit.toEye[0] * 2, fit.toEye[1] * 2, fit.toEye[2] * 2];
      const fitStart = fit.screenX(fitProbe);
      rig.bindings.rotate(dragDelta(rig.bindings, rig.view.values.zoom, DRAG_PX, 0));
      const fitShift = cameraFrame(rig.publish()).screenX(fitProbe) - fitStart;
      assert.ok(Math.sign(fitShift) === Math.sign(earthShift),
        `Earth view and Reset disagree on the horizontal orbit direction (${earthShift.toFixed(2)} vs ${fitShift.toFixed(2)} px).`);
      // Every pose responded by the same amount: the response is pose-independent, not merely same-signed.
      const magnitudes = shifts.map(row => Math.abs(row.shift));
      assert.ok(Math.max(...magnitudes) - Math.min(...magnitudes) < 1e-6,
        `The horizontal response is pose-dependent: ${magnitudes.map(v => v.toFixed(3)).join(', ')}`);
      rig.view.destroy();
    } finally { rig.restore(); }
  });
}
