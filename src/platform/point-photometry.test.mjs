import assert from "node:assert/strict";
import test from "node:test";

import {
  POINT_PHOTOMETRY,
  STAR_PRESENTATION,
  apparentLuminance,
  apparentMagnitudeFromAbsolute,
  bvToTeffK,
  createExposure,
  hintsLimitMagnitude,
  lightGrasp,
  limitingMagnitude,
  magnitudeForRadiusPx,
  pinMagnitude,
  pointSourceAlpha,
  rawRadiusPx,
  screenFactor,
  starColorOf,
  starIntensity,
  starRadiusPx,
  teffKToRgb,
} from "./point-photometry.mjs";

const exposure = createExposure({ fovDegrees: 60 });

test("the chain lands on physical numbers: a magnitude-0 star through the eye's PSF", () => {
  // 2.53016e-6 lux over 1.66138e-6 sr, with unit grasp at 60 degrees.
  assert.ok(Math.abs(apparentLuminance(exposure, 0) - 1.5229) < 1e-3);
  assert.equal(lightGrasp(60), 1);
  // Narrowing the field ten times buys about five magnitudes.
  const narrow = createExposure({ fovDegrees: 6 });
  assert.ok(Math.abs((limitingMagnitude(narrow) - limitingMagnitude(exposure)) - 5) < 0.6);
});

test("every limit is the exact inverse of the radius curve", () => {
  for (const radius of [POINT_PHOTOMETRY.skipRadiusPx, POINT_PHOTOMETRY.hintsRadiusPx, POINT_PHOTOMETRY.minRadiusPx, 1.25, 6]) {
    const magnitude = magnitudeForRadiusPx(exposure, radius);
    assert.ok(Math.abs(rawRadiusPx(exposure, magnitude) - radius) < 1e-9, `radius ${radius}`);
  }
  // At 60 degrees, screen factor 1: the faintest drawn star is near 7.35,
  // the faintest named near 6.4, and the pin sits near 5.6.
  assert.ok(Math.abs(limitingMagnitude(exposure) - 7.35) < 0.05, String(limitingMagnitude(exposure)));
  assert.ok(Math.abs(hintsLimitMagnitude(exposure) - 6.42) < 0.05, String(hintsLimitMagnitude(exposure)));
  assert.ok(Math.abs(pinMagnitude(exposure) - 5.61) < 0.05, String(pinMagnitude(exposure)));
});

test("alpha is zero at and past the limit, and decreases monotonically with magnitude", () => {
  const limit = limitingMagnitude(exposure);
  assert.equal(pointSourceAlpha(exposure, limit), 0);
  assert.equal(pointSourceAlpha(exposure, limit + 3), 0);
  let previous = Number.POSITIVE_INFINITY;
  for (let magnitude = -2; magnitude <= limit; magnitude += 0.05) {
    const alpha = pointSourceAlpha(exposure, magnitude);
    assert.ok(alpha <= previous + 1e-12, `alpha rose at magnitude ${magnitude}`);
    assert.ok(alpha >= 0 && alpha <= 1);
    previous = alpha;
  }
  // The fade between the skip radius and the pin is a square, so it is
  // strictly below the luminance there and exactly one above the pin.
  assert.ok(pointSourceAlpha(exposure, pinMagnitude(exposure) + 1) < pointSourceAlpha(exposure, pinMagnitude(exposure) - 0.01));
});

test("a star's drawn radius runs from the pin to the presentation ceiling, and Sirius outranks a naked-eye star", () => {
  assert.equal(starRadiusPx(exposure, -1.44), STAR_PRESENTATION.maxRadiusPx);
  assert.equal(starRadiusPx(exposure, 6.5), POINT_PHOTOMETRY.minRadiusPx);
  const sirius = starRadiusPx(exposure, -1.44);
  const faint = starRadiusPx(exposure, 4.8);
  assert.ok(sirius > faint, `${sirius} > ${faint}`);
  assert.ok(starIntensity(exposure, -1.44) <= STAR_PRESENTATION.intensityMax);
  assert.ok(starIntensity(exposure, -1.44) > starIntensity(exposure, 4.8));
});

test("the screen factor is the reference's clamp and it moves the limit the expected way", () => {
  assert.equal(screenFactor(390, 844), POINT_PHOTOMETRY.screenFactorMin);
  assert.equal(screenFactor(1440, 900), POINT_PHOTOMETRY.screenFactorMax);
  assert.ok(Math.abs(screenFactor(800, 720) - 1.2) < 1e-12);
  const small = createExposure({ fovDegrees: 60, screenFactor: 0.7 });
  const large = createExposure({ fovDegrees: 60, screenFactor: 1.5 });
  assert.ok(limitingMagnitude(small) < limitingMagnitude(exposure));
  assert.ok(limitingMagnitude(large) > limitingMagnitude(exposure));
});

test("a less dark-adapted eye dims every star in order and lowers every derived limit; the exposure scale lifts them", () => {
  const lit = createExposure({ fovDegrees: 60, adaptationLuminanceCdM2: 0.2 });
  for (const magnitude of [-1.4, 1, 3, 4.5]) {
    assert.ok(pointSourceAlpha(lit, magnitude) <= pointSourceAlpha(exposure, magnitude), `magnitude ${magnitude}`);
  }
  assert.ok(pointSourceAlpha(lit, 4.5) < pointSourceAlpha(exposure, 4.5));
  assert.ok(limitingMagnitude(lit) < limitingMagnitude(exposure));
  assert.ok(hintsLimitMagnitude(lit) < hintsLimitMagnitude(exposure));
  const gained = createExposure({ fovDegrees: 60, adaptationLuminanceCdM2: 0.2, exposureScale: 4 });
  assert.ok(pointSourceAlpha(gained, 4.5) > pointSourceAlpha(lit, 4.5));
  assert.throws(() => createExposure({ fovDegrees: 60, exposureScale: 0 }), /exposure scale/u);
});

test("apparent magnitude is the distance modulus", () => {
  assert.ok(Math.abs(apparentMagnitudeFromAbsolute(1.45, 2.64) - (-1.44)) < 0.01);
  assert.equal(apparentMagnitudeFromAbsolute(0, 10), 0);
});

test("colour is ordered by temperature and neutral without data", () => {
  const cool = teffKToRgb(3500);
  const hot = teffKToRgb(12000);
  assert.ok(cool[0] > cool[2], "a cool star is redder than blue");
  assert.ok(hot[2] >= hot[0], "a hot star is at least as blue as red");
  assert.ok(Math.abs(bvToTeffK(0.65) - 5700) < 150, "the Sun's B-V lands near 5800 K");
  assert.deepEqual(starColorOf(Number.NaN, Number.NaN), [1, 1, 1]);
  assert.deepEqual(starColorOf(Number.NaN, 0.65), teffKToRgb(bvToTeffK(0.65)));
});
