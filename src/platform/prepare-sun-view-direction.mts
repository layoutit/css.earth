import { isArray } from './is-array.mts';
import type { Vector3, Matrix3 } from "../renderers/css/solar-system/types.ts";
// Converts a scene-frame Sun direction into the view-space direction the
// retained sky uses at the default camera pose.
//
// The scene frame is whatever the scene matrix
// `Rx(initialScenePitch) * Ry(defaultControlYaw)` (see `createSceneMatrix` in
// camera-orientation.ts) is applied to: the body-fixed frame by default, or a
// prepared presentation frame when `sceneDirection` is given. These rotations
// reproduce DOMMatrix.rotateAxisAngle exactly, so the value prepared here is
// the one the runtime would compute in the browser. Preparation-time only.

import { requireBodyFixedSunDirection } from "./solar-geometry.mts";
import { cssDirectionToViewDirection } from "./solar-view-direction.mts";

export function prepareSunReferenceViewDirection({
  bodyId,
  initialScenePitchDegrees,
  defaultControlYawDegrees,
  sceneDirection = requireBodyFixedSunDirection(bodyId),
}: { bodyId: string; initialScenePitchDegrees: number; defaultControlYawDegrees: number; sceneDirection?: Vector3 }) {
  if (!Number.isFinite(initialScenePitchDegrees) ||
      !Number.isFinite(defaultControlYawDegrees)) {
    throw new TypeError("Sun reference view direction needs a camera pose.");
  }
  if (!isArray(sceneDirection) || sceneDirection.length !== 3 ||
      sceneDirection.some((component) => !Number.isFinite(component))) {
    throw new TypeError("Sun scene direction is invalid.");
  }
  const yawed = rotateY(sceneDirection, defaultControlYawDegrees);
  return normalize(cssDirectionToViewDirection(
    rotateX(yawed, initialScenePitchDegrees),
  ));
}

// The scene matrix is Rx * Ry, so a direction is rotated by Ry first.
function rotateY([x, y, z]: Vector3, degrees: number) {
  const angle = degrees * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [cos * x + sin * z, y, -sin * x + cos * z];
}

function rotateX([x, y, z]: Vector3, degrees: number) {
  const angle = degrees * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x, cos * y - sin * z, sin * y + cos * z];
}

function normalize(vector: Vector3) {
  const magnitude = Math.hypot(...vector);
  if (!(magnitude > 0)) throw new RangeError("Direction has no magnitude.");
  return Object.freeze(vector.map((component) => component / magnitude));
}
