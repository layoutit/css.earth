import assert from "node:assert/strict";
import test from "node:test";

import {
  ASTROMETRIC_CUBE_FRAME,
  prepareAstrometricCubeSampling,
  prepareAstrometricSkySceneRegistration,
} from "./astrometric-sky-registration.mjs";
import { ESO_PANORAMA_REGISTRATION } from "./eso-panorama-registration.mjs";
import {
  ICRS_TO_GALACTIC,
  multiplyMatrices,
  transformDirection,
  transposeMatrix,
} from "./galactic-frame.mjs";
import {
  requireBodyFixedEclipticNorth,
  requireBodyFixedSunDirection,
  requireBodyFixedToIcrf,
} from "./solar-geometry.mjs";
import { prepareEclipticPresentationFrame } from
  "./solar-presentation-frame.mjs";

// IAU 1976 obliquity at J2000 (84381.448 arcseconds): the J2000 ecliptic north
// pole in ICRF is +z tilted about +x by it. Independent of the prepared
// geometry, which was produced with the same constant by another tool.
const OBLIQUITY = 84381.448 / 3600 * Math.PI / 180;
const ECLIPTIC_NORTH_ICRF = [0, -Math.sin(OBLIQUITY), Math.cos(OBLIQUITY)];

const BODIES = [
  "mercury",
  "venus",
  "earth",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
];

test("cube sampling composes the panorama correction after the galactic rotation", () => {
  const sampling = prepareAstrometricCubeSampling();
  assert.equal(sampling.cubeFrame, ASTROMETRIC_CUBE_FRAME);
  const expected = multiplyMatrices(
    ESO_PANORAMA_REGISTRATION.matrix,
    ICRS_TO_GALACTIC,
  );
  for (let index = 0; index < 9; index += 1) {
    assert.ok(Math.abs(sampling.matrix[index] - expected[index]) < 1e-15);
  }
  // Order matters: the correction lives in the panorama's galactic frame.
  const swapped = multiplyMatrices(
    ICRS_TO_GALACTIC,
    ESO_PANORAMA_REGISTRATION.matrix,
  );
  assert.ok(Math.max(...swapped.map((value, index) =>
    Math.abs(value - sampling.matrix[index]))) > 1e-3);
  assert.equal(sampling.panorama.anchors.length, 5);
  assert.ok(sampling.panorama.frameCorrection.angleDegrees > 3);
});

test("the checked-in body-fixed to ICRF rotations agree with the checked-in ecliptic north", () => {
  for (const bodyId of BODIES) {
    const matrix = requireBodyFixedToIcrf(bodyId);
    const bodyNorth = transformDirection(transposeMatrix(matrix), ECLIPTIC_NORTH_ICRF);
    const stored = requireBodyFixedEclipticNorth(bodyId);
    for (let axis = 0; axis < 3; axis += 1) {
      assert.ok(Math.abs(bodyNorth[axis] - stored[axis]) < 1e-9, bodyId);
    }
    // The body pole (+z body-fixed) is the third column of the matrix.
    assert.ok(Math.abs(Math.hypot(matrix[2], matrix[5], matrix[8]) - 1) < 1e-12);
  }
});

test("the scene registration puts ecliptic north up and the Sun where the presentation frame puts it", () => {
  for (const bodyId of BODIES) {
    const registration = prepareAstrometricSkySceneRegistration(bodyId);
    assert.equal(registration.bodyId, bodyId);
    assert.match(registration.cssTransform, /^matrix3d\((?:[^,]+,){15}1\)$/u);
    // Ecliptic north in ICRF (a cube-local direction) must land on CSS -y.
    const north = transformDirection(registration.matrix, ECLIPTIC_NORTH_ICRF);
    assert.ok(Math.abs(north[0]) < 1e-9 && Math.abs(north[2]) < 1e-9, bodyId);
    assert.ok(Math.abs(north[1] + 1) < 1e-9, `${bodyId} north ${north}`);
    // The Sun, taken through ICRF, must coincide with the presentation-frame
    // Sun the scene and the Sun sprite already use.
    const sunIcrf = transformDirection(
      requireBodyFixedToIcrf(bodyId),
      requireBodyFixedSunDirection(bodyId),
    );
    const sunScene = transformDirection(registration.matrix, sunIcrf);
    const frame = prepareEclipticPresentationFrame(bodyId);
    for (let axis = 0; axis < 3; axis += 1) {
      assert.ok(Math.abs(sunScene[axis] - frame.sunDirection[axis]) < 1e-9, bodyId);
    }
    // A proper rotation: CSS matrix column 0 is the image of +x.
    const parsed = registration.cssTransform.slice(9, -1).split(",").map(Number);
    assert.ok(Math.abs(parsed[0] - registration.matrix[0]) < 1e-15);
    assert.ok(Math.abs(parsed[1] - registration.matrix[3]) < 1e-15);
    assert.ok(Math.abs(parsed[2] - registration.matrix[6]) < 1e-15);
  }
});

test("the galactic plane crosses Mercury's presentation frame at 60.2 degrees", () => {
  const registration = prepareAstrometricSkySceneRegistration("mercury");
  const galacticToIcrs = transposeMatrix(ICRS_TO_GALACTIC);
  const poleScene = transformDirection(
    registration.matrix,
    transformDirection(galacticToIcrs, [0, 0, 1]),
  );
  // Screen up is CSS -y; the pole's angle from it is the plane's inclination.
  const inclination = Math.acos(-poleScene[1]) * 180 / Math.PI;
  assert.ok(Math.abs(inclination - 60.19) < 0.02, `inclination ${inclination}`);
  // The galactic frame origin sits 5.54 degrees below the ecliptic (Sgr A*
  // itself is at -5.61); screen up is ecliptic north, so that latitude is
  // read straight off the presentation -y component.
  const centreScene = transformDirection(
    registration.matrix,
    transformDirection(galacticToIcrs, [1, 0, 0]),
  );
  assert.ok(Math.abs(Math.asin(-centreScene[1]) * 180 / Math.PI + 5.54) < 0.02);
});

test("a wrong rotation direction in the chain is caught", () => {
  // Mutation guard: with the body rotation applied un-transposed the Sun no
  // longer lands on the presentation Sun.
  const frame = prepareEclipticPresentationFrame("mercury");
  const wrong = multiplyMatrices(
    frame.basis.flat(),
    requireBodyFixedToIcrf("mercury"),
  );
  const sunIcrf = transformDirection(
    requireBodyFixedToIcrf("mercury"),
    requireBodyFixedSunDirection("mercury"),
  );
  const sunScene = transformDirection(wrong, sunIcrf);
  assert.ok(Math.max(...sunScene.map((value, axis) =>
    Math.abs(value - frame.sunDirection[axis]))) > 0.1);
});
