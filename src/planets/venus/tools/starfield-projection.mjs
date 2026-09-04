const DEGREES_PER_RADIAN = 180 / Math.PI;

export const ICRS_STANDARD_TO_GALACTIC = Object.freeze([
  -0.0548755604, -0.8734370902, -0.4838350155,
  0.4941094279, -0.44482963, 0.7469822445,
  -0.867666149, -0.1980763734, 0.4559837762,
]);

export const ESO_GALACTIC_CENTER_X_DEGREES = 180;
export const ESO_GALACTIC_LONGITUDE_DIRECTION = -1;
export const ESO_CUBEMAP_REGISTRATION_ROTATION_DEGREES = Object.freeze({
  x: -35.5,
  y: 158.5,
  z: -123,
});
export const ESO_CUBEMAP_REGISTRATION_MATRIX = Object.freeze(
  rotationMatrix(ESO_CUBEMAP_REGISTRATION_ROTATION_DEGREES),
);

/**
 * Convert the repository's Y-up ICRS direction into IAU Galactic coordinates.
 *
 * The published ICRS-to-Galactic matrix expects [x, y, z] where z is the
 * north celestial pole. cssEarth stores celestial directions as
 * [cos(dec) cos(ra), sin(dec), cos(dec) sin(ra)], so its Y and Z components
 * must be reordered before the matrix is applied.
 */
export function equatorialDirectionToGalactic([x, y, z]) {
  const standardX = x;
  const standardY = z;
  const standardZ = y;
  const matrix = ICRS_STANDARD_TO_GALACTIC;
  const galacticX = matrix[0] * standardX + matrix[1] * standardY +
    matrix[2] * standardZ;
  const galacticY = matrix[3] * standardX + matrix[4] * standardY +
    matrix[5] * standardZ;
  const galacticZ = matrix[6] * standardX + matrix[7] * standardY +
    matrix[8] * standardZ;
  const length = Math.hypot(galacticX, galacticY, galacticZ);
  return Object.freeze({
    longitudeDegrees: modulo(
      Math.atan2(galacticY, galacticX) * DEGREES_PER_RADIAN,
      360,
    ),
    latitudeDegrees: Math.asin(clamp(galacticZ / length, -1, 1)) *
      DEGREES_PER_RADIAN,
  });
}

/**
 * Map Galactic coordinates to ESO eso0932a's 2:1 full-sky panorama.
 * The Galactic centre is at the image centre, Galactic north is up, and
 * longitude increases to the left. X wraps at the panorama seam.
 */
export function galacticToEsoPanoramaSample(
  longitudeDegrees,
  latitudeDegrees,
  width,
  height,
) {
  return Object.freeze({
    x: modulo(
      ESO_GALACTIC_CENTER_X_DEGREES +
        ESO_GALACTIC_LONGITUDE_DIRECTION * longitudeDegrees,
      360,
    ) / 360 * width - 0.5,
    y: clamp((90 - latitudeDegrees) / 180 * height - 0.5, 0, height - 1),
  });
}

export function rotateDirectionForEsoRegistration([x, y, z]) {
  const matrix = ESO_CUBEMAP_REGISTRATION_MATRIX;
  return Object.freeze([
    matrix[0] * x + matrix[1] * y + matrix[2] * z,
    matrix[3] * x + matrix[4] * y + matrix[5] * z,
    matrix[6] * x + matrix[7] * y + matrix[8] * z,
  ]);
}

function rotationMatrix({ x, y, z }) {
  const columns = [
    rotateEuler([1, 0, 0], x, y, z),
    rotateEuler([0, 1, 0], x, y, z),
    rotateEuler([0, 0, 1], x, y, z),
  ];
  return [
    columns[0][0], columns[1][0], columns[2][0],
    columns[0][1], columns[1][1], columns[2][1],
    columns[0][2], columns[1][2], columns[2][2],
  ];
}

function rotateEuler(direction, x, y, z) {
  return rotateZ(rotateY(rotateX(direction, x), y), z);
}

function rotateX([x, y, z], degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x, y * cosine - z * sine, y * sine + z * cosine];
}

function rotateY([x, y, z], degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine + z * sine, y, -x * sine + z * cosine];
}

function rotateZ([x, y, z], degrees) {
  const radians = degrees * Math.PI / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  return [x * cosine - y * sine, x * sine + y * cosine, z];
}

function modulo(value, divisor) {
  return (value % divisor + divisor) % divisor;
}

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}
