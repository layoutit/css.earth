import assert from "node:assert/strict";
import { sourceTest } from '../../source-test.mts';
const test = sourceTest('mercury');

import { prepareAstrometricSkySceneRegistration } from "../../../../src/platform/astrometric-sky-registration.mts";
import {
  ICRS_TO_GALACTIC,
  transformDirection,
  transposeMatrix,
} from "../../../../src/platform/galactic-frame.mts";
import {
  requireBodyFixedSunDirection,
  requireBodyFixedToIcrf,
} from "../../../../src/platform/solar-geometry.mts";
import PREPARED_MERCURY_SCENE from "../../../../src/objects/mercury/prepared/scene.json" with {type: "json"};
import PREPARED_MERCURY_SKY_SUN from "../../../../src/objects/mercury/prepared/sun.json" with {type: "json"};

// The published registration, parsed the way the runtime parses it
// (DOMMatrix column order), as a row-major 3x3.
function parseRegistration(cssTransform: string) {
  const values = cssTransform.slice("matrix3d(".length, -1).split(",")
    .map(Number);
  assert.equal(values.length, 16);
  assert.ok(values.every(Number.isFinite));
  return [
    values[0], values[4], values[8],
    values[1], values[5], values[9],
    values[2], values[6], values[10],
  ];
}

test("the published scene registration is the derived ICRF -> presentation rotation", () => {
  const starfield = PREPARED_MERCURY_SCENE.starfield;
  assert.equal(starfield.sceneRegistrationModel,
    "icrf-cube-in-ecliptic-presentation-frame");
  assert.match(starfield.sceneRegistrationChain, /galactic -> ICRF/u);
  const published = parseRegistration(starfield.sceneRegistration);
  const derived = prepareAstrometricSkySceneRegistration("mercury");
  for (let index = 0; index < 9; index += 1) {
    assert.ok(Math.abs(published[index] - derived.matrix[index]) < 1e-12,
      `registration element ${index}`);
  }
  // Independent of the derivation: the registration must take the Sun, via
  // ICRF, onto the Sun direction the terminator uses.
  const sunIcrf = transformDirection(
    requireBodyFixedToIcrf("mercury"),
    requireBodyFixedSunDirection("mercury"),
  );
  const sunScene = transformDirection(published, sunIcrf);
  for (let axis = 0; axis < 3; axis += 1) {
    assert.ok(
      Math.abs(sunScene[axis] - PREPARED_MERCURY_SKY_SUN.localDirection[axis]) < 1e-9,
      `Sun axis ${axis}: ${sunScene[axis]} vs ${PREPARED_MERCURY_SKY_SUN.localDirection[axis]}`,
    );
  }
});

test("through the published registration the Milky Way is inclined 60.2 degrees to screen up", () => {
  const published = parseRegistration(
    PREPARED_MERCURY_SCENE.starfield.sceneRegistration,
  );
  const galacticToIcrs = transposeMatrix(ICRS_TO_GALACTIC);
  const poleScene = transformDirection(
    published,
    transformDirection(galacticToIcrs, [0, 0, 1]),
  );
  const inclination = Math.acos(-poleScene[1]) * 180 / Math.PI;
  assert.ok(Math.abs(inclination - 60.19) < 0.02, `inclination ${inclination}`);
  // The galactic centre stands 5.54 degrees below the ecliptic (screen up is
  // ecliptic north), and its ecliptic longitude, 266.84, is the Sun's
  // ecliptic longitude as seen from Mercury plus the angle the presentation
  // frame shows between them about ecliptic north.
  const centreScene = transformDirection(
    published,
    transformDirection(galacticToIcrs, [1, 0, 0]),
  );
  assert.ok(Math.abs(Math.asin(-centreScene[1]) * 180 / Math.PI + 5.54) < 0.02);
  const obliquity = 84381.448 / 3600 * Math.PI / 180;
  const sunIcrf = transformDirection(
    requireBodyFixedToIcrf("mercury"),
    requireBodyFixedSunDirection("mercury"),
  );
  const sunEclipticLongitude = Math.atan2(
    sunIcrf[1] * Math.cos(obliquity) + sunIcrf[2] * Math.sin(obliquity),
    sunIcrf[0],
  ) * 180 / Math.PI;
  // Longitude about ecliptic north (-y) in the presentation frame, counted
  // the same way as ecliptic longitude (right-handed about the pole: with
  // +x as the first axis the second is (-y) x (+x) = +z).
  const presentationLongitude = ([x, , z]:readonly number[]) =>
    Math.atan2(z, x) * 180 / Math.PI;
  const sun = PREPARED_MERCURY_SKY_SUN.localDirection;
  const separation = presentationLongitude(centreScene) -
    presentationLongitude(sun);
  const expected = 266.84 - sunEclipticLongitude;
  const difference = ((separation - expected) % 360 + 540) % 360 - 180;
  assert.ok(Math.abs(difference) < 0.05,
    `separation ${separation} vs ${expected} (Sun at ${sunEclipticLongitude})`);
});
