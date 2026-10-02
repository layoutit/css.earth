import { normalizeOrThrow, isArray } from '@cssearth/core';
import type { Vector3, FlatMatrix3 as Matrix3 } from '@cssearth/engine';
// Converts a scene-frame Sun direction into the view-space direction the
// retained sky uses at the default camera pose.
//
// The scene frame is whatever the scene matrix
// `Rx(initialScenePitch) * Ry(defaultControlYaw)` (see `createSceneMatrix` in
// camera-orientation.ts) is applied to: the body-fixed frame by default, or a
// prepared presentation frame when `sceneDirection` is given. These rotations
// reproduce DOMMatrix.rotateAxisAngle exactly, so the value prepared here is
// the one the runtime would compute in the browser. Preparation-time only.

import type { SolarGeometry } from "./solar-geometry.ts";
import { cssDirectionToViewDirection } from '@cssearth/engine';

export function prepareSunReferenceViewDirection(geometry: SolarGeometry, {
  bodyId,
  initialScenePitchDegrees,
  defaultControlYawDegrees,
  sceneDirection = geometry.requireBodyFixedSunDirection(bodyId),
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
  return Object.freeze(normalizeOrThrow(vector, () => new RangeError("Direction has no magnitude.")));
}
