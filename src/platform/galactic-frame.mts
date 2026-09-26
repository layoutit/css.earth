import type { Vector3, Matrix3 } from "@cssearth/renderer/solar-system/types.ts";
// The J2000 galactic frame: the fixed rotation between ICRS (J2000
// equatorial) and galactic coordinates. Defined by the three IAU 1958
// constants as re-expressed on J2000 in the Hipparcos Catalogue (ESA SP-1200,
// 1997, volume 1, section 1.5.3); the same values define the galactic frame in
// astropy and SOFA. There is no epoch dependence: the frame is fixed by
// convention.

export const GALACTIC_FRAME_J2000 = Object.freeze({
  source:
    "Hipparcos Catalogue vol. 1 §1.5.3 (ESA SP-1200, 1997); J2000 galactic " +
    "frame constants shared by astropy and SOFA",
  // North galactic pole in ICRS.
  northPoleRaDegrees: 192.85948,
  northPoleDecDegrees: 27.12825,
  // Galactic longitude of the north celestial pole. Hipparcos tabulates the
  // ascending node instead (l_Omega = 32.93192); this is l_Omega + 90.
  northCelestialPoleLongitudeDegrees: 122.93192,
});

// Row-major 3x3 rotation taking an ICRS unit vector (x toward RA 0 on the
// equator, z toward the north celestial pole) into galactic coordinates (x
// toward the galactic centre, z toward the north galactic pole):
//   galactic = Rz(180 - l_NCP) * Ry(90 - dec_NGP) * Rz(ra_NGP) * icrs
// with frame (passive) rotations. The unit tests check the result against the
// published Hipparcos matrix.
export function icrsToGalacticMatrix(frame = GALACTIC_FRAME_J2000) {
  return multiply(
    frameRotationZ(180 - frame.northCelestialPoleLongitudeDegrees),
    multiply(
      frameRotationY(90 - frame.northPoleDecDegrees),
      frameRotationZ(frame.northPoleRaDegrees),
    ),
  );
}

export const ICRS_TO_GALACTIC = Object.freeze(icrsToGalacticMatrix());

export function transformDirection(matrix: Matrix3, [x, y, z]: Vector3): [number, number, number] {
  return [
    matrix[0] * x + matrix[1] * y + matrix[2] * z,
    matrix[3] * x + matrix[4] * y + matrix[5] * z,
    matrix[6] * x + matrix[7] * y + matrix[8] * z,
  ];
}

export function transposeMatrix(matrix: Matrix3) {
  return [
    matrix[0], matrix[3], matrix[6],
    matrix[1], matrix[4], matrix[7],
    matrix[2], matrix[5], matrix[8],
  ];
}

export function multiplyMatrices(a: Matrix3, b: Matrix3) {
  return multiply(a, b);
}

export function directionFromDegrees(longitudeDegrees: number, latitudeDegrees: number): [number, number, number] {
  const longitude = longitudeDegrees * Math.PI / 180;
  const latitude = latitudeDegrees * Math.PI / 180;
  return [
    Math.cos(latitude) * Math.cos(longitude),
    Math.cos(latitude) * Math.sin(longitude),
    Math.sin(latitude),
  ];
}

export function degreesFromDirection([x, y, z]: Vector3): [number, number] {
  const length = Math.hypot(x, y, z);
  return [
    (Math.atan2(y, x) * 180 / Math.PI + 360) % 360,
    Math.asin(Math.max(-1, Math.min(1, z / length))) * 180 / Math.PI,
  ];
}

function frameRotationZ(degrees: number) {
  const angle = degrees * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [cos, sin, 0, -sin, cos, 0, 0, 0, 1];
}

function frameRotationY(degrees: number) {
  const angle = degrees * Math.PI / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [cos, 0, -sin, 0, 1, 0, sin, 0, cos];
}

function multiply(a: Matrix3, b: Matrix3) {
  const result = new Array<number>(9);
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      result[row * 3 + column] = a[row * 3] * b[column] +
        a[row * 3 + 1] * b[3 + column] + a[row * 3 + 2] * b[6 + column];
    }
  }
  return result;
}
