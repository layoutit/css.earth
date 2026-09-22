import assert from "node:assert/strict";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();

import {
  GALACTIC_FRAME_J2000,
  ICRS_TO_GALACTIC,
  degreesFromDirection,
  directionFromDegrees,
  icrsToGalacticMatrix,
  transformDirection,
  transposeMatrix,
} from "./galactic-frame.mts";

// Hipparcos Catalogue vol. 1, equation 1.5.11: the published ICRS -> galactic
// matrix. Reproducing it from the three angles proves the rotation order and
// the passive-rotation convention used to build the matrix.
const HIPPARCOS_ICRS_TO_GALACTIC = [
  -0.0548755604162154, -0.8734370902348850, -0.4838350155487132,
  0.4941094278755837, -0.4448296299600112, 0.7469822444972189,
  -0.8676661490190047, -0.1980763734312015, 0.4559837761750669,
];

// IAU 1976 mean obliquity of the ecliptic at J2000, 84381.448 arcseconds.
const OBLIQUITY_J2000_DEGREES = 84381.448 / 3600;

test("the galactic matrix derived from the J2000 constants is the Hipparcos matrix", () => {
  const derived = icrsToGalacticMatrix();
  for (let index = 0; index < 9; index += 1) {
    assert.ok(
      Math.abs(derived[index] - HIPPARCOS_ICRS_TO_GALACTIC[index]) < 2e-7,
      `element ${index}: ${derived[index]} vs ${HIPPARCOS_ICRS_TO_GALACTIC[index]}`,
    );
  }
  assert.deepEqual([...ICRS_TO_GALACTIC], derived);
  // A proper rotation.
  const product = multiply(derived, transposeMatrix(derived));
  for (let index = 0; index < 9; index += 1) {
    assert.ok(Math.abs(product[index] - (index % 4 === 0 ? 1 : 0)) < 1e-12);
  }
  assert.ok(determinant(derived) > 0.999999);
});

test("the galactic centre, pole and celestial pole land on their definitions", () => {
  const centre = transformDirection(
    ICRS_TO_GALACTIC,
    directionFromDegrees(266.405, -28.93617),
  );
  const [centreLongitude, centreLatitude] = degreesFromDirection(centre);
  assert.ok(Math.min(centreLongitude, 360 - centreLongitude) < 2e-4);
  assert.ok(Math.abs(centreLatitude) < 2e-4);
  const pole = transformDirection(ICRS_TO_GALACTIC, directionFromDegrees(
    GALACTIC_FRAME_J2000.northPoleRaDegrees,
    GALACTIC_FRAME_J2000.northPoleDecDegrees,
  ));
  assert.ok(Math.abs(degreesFromDirection(pole)[1] - 90) < 1e-9);
  const celestialPole = degreesFromDirection(
    transformDirection(ICRS_TO_GALACTIC, [0, 0, 1]),
  );
  assert.ok(Math.abs(
    celestialPole[0] - GALACTIC_FRAME_J2000.northCelestialPoleLongitudeDegrees,
  ) < 1e-6);
  assert.ok(Math.abs(
    celestialPole[1] - GALACTIC_FRAME_J2000.northPoleDecDegrees,
  ) < 1e-6);
});

// The origin of the frame (l = 0, b = 0) lies at ecliptic longitude 266.84 and
// latitude -5.54; Sgr A* itself, 0.07 degrees away, is at -5.61.
test("the galactic plane is inclined 60.2 degrees to the ecliptic with the centre at 266.84, -5.54", () => {
  const galacticToIcrs = transposeMatrix(ICRS_TO_GALACTIC);
  const eclipticFromIcrs = ([x, y, z]: readonly number[]) => {
    const obliquity = OBLIQUITY_J2000_DEGREES * Math.PI / 180;
    return [
      x,
      y * Math.cos(obliquity) + z * Math.sin(obliquity),
      -y * Math.sin(obliquity) + z * Math.cos(obliquity),
    ];
  };
  const centre = degreesFromDirection(eclipticFromIcrs(
    transformDirection(galacticToIcrs, [1, 0, 0]),
  ));
  assert.ok(Math.abs(centre[0] - 266.84) < 0.02, `centre longitude ${centre[0]}`);
  assert.ok(Math.abs(centre[1] + 5.54) < 0.02, `centre latitude ${centre[1]}`);
  const pole = eclipticFromIcrs(transformDirection(galacticToIcrs, [0, 0, 1]));
  const inclination = Math.acos(pole[2]) * 180 / Math.PI;
  assert.ok(Math.abs(inclination - 60.19) < 0.02, `inclination ${inclination}`);
});

function multiply(a: readonly number[], b: readonly number[]) {
  const result = new Array<number>(9);
  for (let row = 0; row < 3; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      result[row * 3 + column] = a[row * 3] * b[column] +
        a[row * 3 + 1] * b[3 + column] + a[row * 3 + 2] * b[6 + column];
    }
  }
  return result;
}

function determinant([a, b, c, d, e, f, g, h, i]: readonly number[]) {
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}
