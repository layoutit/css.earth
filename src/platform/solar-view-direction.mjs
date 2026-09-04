// Converts a scene-frame Sun direction into the view-space direction the
// retained sky uses at the default camera pose.
//
// The scene frame is whatever the scene matrix
// `Rx(initialScenePitch) * Ry(defaultControlYaw)` (see `createSceneMatrix` in
// cubic-sky-runtime.mjs) is applied to: the body-fixed frame by default, or a
// prepared presentation frame when `sceneDirection` is given. These rotations
// reproduce DOMMatrix.rotateAxisAngle exactly, so the value prepared here is
// the one the runtime would compute in the browser.

import { requireBodyFixedSunDirection } from "./solar-geometry.mjs";

export function prepareSunReferenceViewDirection({
  bodyId,
  initialScenePitchDegrees,
  defaultControlYawDegrees,
  sceneDirection = requireBodyFixedSunDirection(bodyId),
}) {
  if (!Number.isFinite(initialScenePitchDegrees) ||
      !Number.isFinite(defaultControlYawDegrees)) {
    throw new TypeError("Sun reference view direction needs a camera pose.");
  }
  if (!Array.isArray(sceneDirection) || sceneDirection.length !== 3 ||
      sceneDirection.some((component) => !Number.isFinite(component))) {
    throw new TypeError("Sun scene direction is invalid.");
  }
  const yawed = rotateY(sceneDirection, defaultControlYawDegrees);
  return normalize(cssDirectionToViewDirection(
    rotateX(yawed, initialScenePitchDegrees),
  ));
}

// The scene matrix is a CSS transform, so it yields CSS coordinates: +x
// right, +y down, +z toward the viewer. The prepared Sun consumers use the
// sprite's view convention: +x right, +y up, +z toward the viewer, with the
// camera looking down -z (the sprite projects `forward = -z`, so it is only
// visible when the Sun lies beyond the body, at a negative z). The two frames
// share x and z and differ only by the y flip. Flipping z here mirrored the
// Sun through the screen plane: the sprite showed the Sun whenever it was
// really behind the camera.
export function cssDirectionToViewDirection([x, y, z]) {
  return [x, -y, z];
}

// The scene matrix is Rx * Ry, so a direction is rotated by Ry first.
function rotateY([x, y, z], degrees) {
  const angle = degrees * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [cos * x + sin * z, y, -sin * x + cos * z];
}

function rotateX([x, y, z], degrees) {
  const angle = degrees * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [x, cos * y - sin * z, sin * y + cos * z];
}

function normalize(vector) {
  const magnitude = Math.hypot(...vector);
  if (!(magnitude > 0)) throw new RangeError("Direction has no magnitude.");
  return Object.freeze(vector.map((component) => component / magnitude));
}
