import type { Matrix3 } from "@cssearth/renderer/solar-system/types.ts";
// Astrometric registration of an object's sky: the derived rotation from the
// ICRF cube frame of the shared universe sky into the object's ecliptic
// presentation frame, in place of hand-tuned Euler angles.
//
//   ICRF                              [sky cube frame]
//     ->  body-fixed (IAU pole and prime meridian at the epoch)
//     ->  ecliptic presentation frame [scene frame]
//
// Cube-local x, y, z are ICRF x, y, z, a proper (right-handed) identification
// because the CSS cube frame (+x right, +y down, +z toward the viewer) is
// right-handed too. The runtime multiplies the registration into the scene
// matrix, so the stars cross the screen exactly as the body's geometry does.

import { multiplyMatrices, transposeMatrix } from "./galactic-frame.mts";
import {
  SOLAR_GEOMETRY_EPOCH_LABEL,
  requireBodyFixedToIcrf,
} from "./solar-geometry.mts";
import { prepareEclipticPresentationFrame } from
  "./solar-presentation-frame.mts";

const ASTROMETRIC_CUBE_FRAME = "icrf-j2000-as-cube-local-axes";

// Scene registration for a body: cube-local (ICRF) direction -> ecliptic
// presentation frame direction, so the runtime's `scene * registration`
// places the stars where the body's own geometry puts them.
export function prepareAstrometricSkySceneRegistration(bodyId: string) {
  const frame = prepareEclipticPresentationFrame(bodyId);
  const bodyFixedToIcrf = requireBodyFixedToIcrf(bodyId);
  // Rows of the presentation basis are the presentation axes in body-fixed
  // coordinates, so the basis as a matrix takes body-fixed into presentation.
  const presentation = frame.basis.flat();
  const matrix = multiplyMatrices(
    presentation,
    transposeMatrix(bodyFixedToIcrf),
  );
  return Object.freeze({
    model: "icrf-cube-in-ecliptic-presentation-frame",
    chain:
      "galactic -> ICRF (J2000 constants) -> body-fixed (IAU pole and prime " +
      "meridian at the epoch) -> ecliptic presentation frame",
    bodyId,
    epoch: SOLAR_GEOMETRY_EPOCH_LABEL,
    cubeFrame: ASTROMETRIC_CUBE_FRAME,
    matrix: Object.freeze(matrix),
    cssTransform: formatMatrix3d(matrix),
  });
}

// CSS matrix3d lists columns first: the first four values are the image of
// +x, so a row-major rotation is written column by column.
function formatMatrix3d(matrix: Matrix3) {
  const values = [
    matrix[0], matrix[3], matrix[6], 0,
    matrix[1], matrix[4], matrix[7], 0,
    matrix[2], matrix[5], matrix[8], 0,
    0, 0, 0, 1,
  ];
  return `matrix3d(${values.map((value) =>
    Math.abs(value) < 1e-15 ? "0" : String(value)).join(",")})`;
}
