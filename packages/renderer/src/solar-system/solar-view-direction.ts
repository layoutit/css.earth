import type { Vector3 } from "./types.js";
// The CSS scene frame to sprite view frame conversion the retained sky and
// the observed Sun share. Runtime-only: the preparation of a Sun's reference
// view direction from the checked-in solar geometry lives in
// prepare-sun-view-direction.mjs, so the shared runtime closure carries no
// per-body catalogue.

// The scene matrix is a CSS transform, so it yields CSS coordinates: +x
// right, +y down, +z toward the viewer. The prepared Sun consumers use the
// sprite's view convention: +x right, +y up, +z toward the viewer, with the
// camera looking down -z (the sprite projects `forward = -z`, so it is only
// visible when the Sun lies beyond the body, at a negative z). The two frames
// share x and z and differ only by the y flip. Flipping z here mirrored the
// Sun through the screen plane: the sprite showed the Sun whenever it was
// really behind the camera.
export function cssDirectionToViewDirection([x, y, z]: Vector3): Vector3 {
  return [x, -y, z];
}
