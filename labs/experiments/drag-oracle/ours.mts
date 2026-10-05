// cssEarth's side of the oracle: the shipped drag controller and engine math from this checkout, fed the same pointer
// stream as the Cesium globe. Only the trackball below is mirrored from the app (perspective-dolly.ts trackball(),
// object-interaction-controls.ts, object-orbit.ts bodyPole()); everything it feeds is the shipped code. The input policy
// is the renderer's test one: a primary press starts a drag anywhere on the screen, as the site's does.
import { createUnboundedMatrixDragControls } from '@cssearth/renderer/navigation/camera-input.ts';
import { createCameraMotion } from '@cssearth/renderer/navigation/camera-motion.ts';
import type { TrackballMetrics } from '@cssearth/renderer/navigation/types.ts';
import { interactionTrackball, directAngularDegreesPerTrackballRadius, directPitchResponseForZoom, rotateVector } from '@cssearth/engine';
import { runtimePolicy } from '../../../packages/renderer/test/runtime-policy-fixture.mts';

export type V3 = [number, number, number];
/** The images of the body's x, y and z (north pole) axes in CSS eye axes: +x right, +y down, +z toward the eye. */
export type Columns = [V3, V3, V3];
/** The panel the body is drawn in (client px), the focal length in px, the eye's distance in body radii, the disc's
 * radius in px and the app's zoom alias. */
export interface Geometry { left: number; top: number; width: number; height: number; focal: number; distance: number; disc: number; zoom: number; }

const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: V3): V3 => { const n = Math.hypot(...a); return [a[0] / n, a[1] / n, a[2] / n]; };
const less = (a: V3, b: V3, s: number): V3 => [a[0] - b[0] * s, a[1] - b[1] * s, a[2] - b[2] * s];
const turned = (rotation: readonly number[], v: V3): V3 => { const r = rotateVector(rotation, v); return [r[0]!, r[1]!, r[2]!]; };
// Gram-Schmidt from the pole outwards: it keeps the frame's handedness (CSS eye axes are left-handed against the body's).
function orthonormal([x, y, z]: Columns): Columns {
  const p = unit(z), a = unit(less(x, p, dot(x, p)));
  return [a, unit(less(less(y, p, dot(y, p)), a, dot(y, a))), p];
}

export function createOurs(surface: HTMLElement, geometry: () => Geometry) {
  let columns: Columns = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const trackballMetrics = (): TrackballMetrics => {
    const g = geometry();
    const centerX = g.left + g.width / 2, centerY = g.top + g.height / 2;
    const radius = Math.max(g.disc, Math.min(g.width, g.height) / 5);
    const measured: TrackballMetrics = { centerX, centerY, opticalCenterX: centerX, opticalCenterY: centerY,
      grabSphere: { center: [0, 0, -g.distance], radius: 1, opticalCenterX: centerX, opticalCenterY: centerY, focalLength: g.focal },
      radius, surfaceRadius: radius, focalLength: g.focal, viewportWidth: g.width, viewportHeight: g.height, viewportCenterX: centerX, viewportCenterY: centerY,
      tumbleOnly: true, pole: columns[2], meridian: columns[0] };
    return Object.freeze({ ...measured, ...interactionTrackball(measured),
      angularDegreesPerTrackballRadius: directAngularDegreesPerTrackballRadius(g.zoom), pitchResponse: directPitchResponseForZoom(g.zoom) });
  };
  const controls = createUnboundedMatrixDragControls({ inputSurface: surface, cameraMotion: createCameraMotion(), runtimePolicy, trackballMetrics, onError: null,
    rotate(update) {
      // camera-orientation.ts: sceneMatrix = dragRotation x sceneMatrix, a turn in eye axes.
      const { rotation } = update;
      if (rotation) columns = orthonormal([turned(rotation, columns[0]), turned(rotation, columns[1]), turned(rotation, columns[2])]);
    } });
  controls.update({ wheel: false });
  return {
    get columns(): Columns { return columns; },
    /** Places the body and ends any drag or coast. */
    place(next: Columns) { controls.stop(); columns = orthonormal(next); },
    invalidate() { controls.invalidateTrackball(); },
    stop() { controls.stop(); },
  };
}
export type Ours = ReturnType<typeof createOurs>;
