// Astrometric registration of a retained cubic sky: the derived rotation
// chain that replaces hand-tuned Euler angles for objects that opt in.
//
//   panorama pixel  <-  mosaic frame (anchor-fitted correction)
//                   <-  J2000 galactic (Hipparcos constants)
//                   <-  ICRF                              [cube-local frame]
//                   <-  body-fixed (IAU pole and prime meridian at the epoch)
//                   <-  ecliptic presentation frame       [scene frame]
//
// The cubemap is sampled in ICRF: cube-local x, y, z are ICRF x, y, z, which
// is a proper (right-handed) identification because the CSS cube frame
// (+x right, +y down, +z toward the viewer) is right-handed too. The scene
// registration the runtime multiplies into the scene matrix then carries the
// body- and epoch-specific part, so the same sampled cube is correct for any
// body whose solar geometry is prepared.

import {
  GALACTIC_FRAME_J2000,
  ICRS_TO_GALACTIC,
  multiplyMatrices,
  transposeMatrix,
} from "./galactic-frame.mjs";
import {
  ESO_PANORAMA,
  ESO_PANORAMA_ANCHORS,
  ESO_PANORAMA_REGISTRATION,
} from "./eso-panorama-registration.mjs";
import {
  SOLAR_GEOMETRY_EPOCH_LABEL,
  requireBodyFixedToIcrf,
} from "./solar-geometry.mjs";
import { prepareEclipticPresentationFrame } from
  "./solar-presentation-frame.mjs";

export const ASTROMETRIC_CUBE_FRAME = "icrf-j2000-as-cube-local-axes";

// Cube-local (ICRF) direction -> panorama galactic direction, row-major.
export function prepareAstrometricCubeSampling() {
  const matrix = multiplyMatrices(
    ESO_PANORAMA_REGISTRATION.matrix,
    ICRS_TO_GALACTIC,
  );
  return Object.freeze({
    model: "icrf-cube-through-j2000-galactic-into-anchor-registered-panorama",
    cubeFrame: ASTROMETRIC_CUBE_FRAME,
    matrix: Object.freeze(matrix),
    galacticFrame: GALACTIC_FRAME_J2000,
    icrsToGalactic: ICRS_TO_GALACTIC,
    panorama: Object.freeze({
      ...ESO_PANORAMA,
      anchors: ESO_PANORAMA_ANCHORS,
      frameCorrection: Object.freeze({
        model: ESO_PANORAMA_REGISTRATION.model,
        matrix: ESO_PANORAMA_REGISTRATION.matrix,
        angleDegrees: ESO_PANORAMA_REGISTRATION.angleDegrees,
        axisGalacticDegrees: ESO_PANORAMA_REGISTRATION.axisGalacticDegrees,
        residualsDegrees: ESO_PANORAMA_REGISTRATION.residualsDegrees,
        uncorrectedResidualsDegrees:
          ESO_PANORAMA_REGISTRATION.uncorrectedResidualsDegrees,
      }),
    }),
  });
}

// Scene registration for a body: cube-local (ICRF) direction -> ecliptic
// presentation frame direction, so the runtime's `scene * registration`
// places the stars where the body's own geometry puts them.
export function prepareAstrometricSkySceneRegistration(bodyId) {
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
function formatMatrix3d(matrix) {
  const values = [
    matrix[0], matrix[3], matrix[6], 0,
    matrix[1], matrix[4], matrix[7], 0,
    matrix[2], matrix[5], matrix[8], 0,
    0, 0, 0, 1,
  ];
  return `matrix3d(${values.map((value) =>
    Math.abs(value) < 1e-15 ? "0" : String(value)).join(",")})`;
}
