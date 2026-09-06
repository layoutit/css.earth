import assert from "node:assert/strict";
import test from "node:test";
import {
  CATALOGUE_STAR_BANDS,
  EXPOSURE_KNOBS,
  POINT_MIN_RADIUS_PX,
  SKIP_RADIUS_PX,
  STAR_RADIUS_MAX_PX,
  apparentMagnitude,
  createExposure,
  cubeFaceOf,
  exposureLimits,
  lightGrasp,
  magnitudeForRadiusPx,
  pointRadiusPx,
  prepareCatalogueStars,
  retainedStarTransform,
  screenFactor,
  starColor,
  starPresentation,
} from "./prepare-catalogue-stars.mjs";

const exposure = createExposure({ fovDegrees: 60 });

test("the photometric chain matches the reference at its fixed points", () => {
  // The naked eye at 60 degrees gathers exactly the reference's unit grasp.
  assert.equal(lightGrasp(60), 1);
  assert.ok(lightGrasp(6) > 90 && lightGrasp(6) < 110, "a ten-fold narrower field buys about five magnitudes");
  // The prepared sizes are quoted at screen factor 1 with the reference's
  // radius gain; the live factor is 1 at a 600 px short side, 1.5 at 900.
  assert.equal(exposure.radiusScale, 1.0727);
  assert.equal(exposure.radiusExponent, 0.55);
  assert.equal(screenFactor(1440, 900), 1.5);
  assert.equal(screenFactor(390, 844), 0.7);
  assert.equal(screenFactor(800, 600), 1);
  // Radius falls monotonically with magnitude, and the inversion is exact.
  let previous = Number.POSITIVE_INFINITY;
  for (let magnitude = -2; magnitude <= 10; magnitude += 0.5) {
    const radius = pointRadiusPx(exposure, magnitude);
    assert.ok(radius < previous, `radius at ${magnitude}`);
    assert.ok(Math.abs(magnitudeForRadiusPx(exposure, radius) - magnitude) < 1e-9);
    previous = radius;
  }
  // The limits the chain derives at the prepared exposure (the reference's
  // 7.35 / 6.42 / 5.61 at factor 1).
  const limits = exposureLimits(exposure);
  assert.ok(Math.abs(limits.limitingMagnitude - 7.352) < 0.01, `limiting magnitude ${limits.limitingMagnitude}`);
  assert.ok(Math.abs(limits.hintsLimitMagnitude - 6.421) < 0.01, `hints limit ${limits.hintsLimitMagnitude}`);
  assert.ok(Math.abs(limits.pinMagnitude - 5.615) < 0.01, `pin magnitude ${limits.pinMagnitude}`);
  assert.equal(starPresentation(exposure, limits.limitingMagnitude + 0.01), null);
  const faint = starPresentation(exposure, limits.limitingMagnitude - 0.1);
  assert.ok(faint.luminance > 0 && faint.luminance < 0.3, "a star near the limit fades out");
  assert.equal(faint.radiusPx, POINT_MIN_RADIUS_PX, "a star below the pin keeps the minimum radius");
  // Distance modulus.
  assert.ok(Math.abs(apparentMagnitude(4.83, 10) - 4.83) < 1e-12);
  // Sirius: absolute 1.45 at 2.64 pc is -1.46 (HYG carries -1.44).
  assert.ok(Math.abs(apparentMagnitude(1.45, 2.64) - -1.46) < 0.02, "Sirius");
});

test("the reference caps the disc, so magnitude reaches the eye as luminance and halo; colour follows temperature", () => {
  const sirius = starPresentation(exposure, -1.44);
  const polaris = starPresentation(exposure, 1.97);
  const faintest = starPresentation(exposure, 5.0);
  assert.equal(sirius.radiusPx, STAR_RADIUS_MAX_PX);
  assert.equal(polaris.radiusPx, STAR_RADIUS_MAX_PX);
  assert.ok(sirius.rawRadiusPx > polaris.rawRadiusPx && polaris.rawRadiusPx > faintest.rawRadiusPx);
  // The tone map saturates for the bright stars; the faintest retained band
  // reads dimmer (the reference's 0.798 at magnitude 5).
  assert.equal(sirius.luminance, EXPOSURE_KNOBS.intensityMax);
  assert.ok(Math.abs(faintest.luminance - 0.798) < 0.01, `magnitude 5 luminance ${faintest.luminance}`);
  assert.equal(sirius.haloAlpha, 2 * EXPOSURE_KNOBS.haloPeak);
  // The knobs: a lit-room adaptation dims the faint end and leaves the
  // saturated bright end; the intensity ceiling clips the bright end.
  const lit = createExposure({ fovDegrees: 60, adaptationLuminanceCdM2: 0.2 });
  assert.ok(Math.abs(starPresentation(lit, 5.0).luminance - 0.107) < 0.01);
  assert.equal(starPresentation(lit, -1.44).luminance, EXPOSURE_KNOBS.intensityMax);
  assert.ok(Math.abs(exposureLimits(lit).limitingMagnitude - 6.029) < 0.01);
  assert.equal(starPresentation(createExposure({ fovDegrees: 60, intensityMax: 0.75 }), -1.44).luminance, 0.75);
  assert.equal(starPresentation(createExposure({ fovDegrees: 60, maxRadiusPx: 2 }), -1.44).radiusPx, 2);
  for (const bad of [{ adaptationLuminanceCdM2: 0 }, { intensityMax: 1.5 }, { maxRadiusPx: 0.1 }, { haloPeak: -1 }]) {
    assert.throws(() => createExposure({ fovDegrees: 60, ...bad }), /invalid/u);
  }
  const [red, , blue] = starColor(9940, Number.NaN);
  assert.ok(blue > red, "a 9940 K star is blue-white");
  const [warmRed, , warmBlue] = starColor(4290, Number.NaN);
  assert.ok(warmRed > warmBlue, "a 4290 K star is orange");
  assert.deepEqual(starColor(Number.NaN, Number.NaN), [255, 255, 255]);
});

test("the cube face inverse agrees with the faces' own sampling and the point transform faces the eye", () => {
  // The faces sample directions as: front (u, v, -1), right (1, v, u), back
  // (-u, v, 1), left (-1, v, -u), top (u, -1, -v), bottom (u, 1, v).
  const cases = [
    ["front", [0.3, -0.2, -1]], ["right", [1, 0.1, 0.4]], ["back", [-0.5, 0.2, 1]],
    ["left", [-1, 0.3, -0.7]], ["top", [0.2, -1, -0.6]], ["bottom", [0.4, 1, 0.1]],
  ];
  for (const [face, [x, y, z]] of cases) {
    const length = Math.hypot(x, y, z);
    const found = cubeFaceOf([x / length, y / length, z / length]);
    assert.equal(found.face, face);
    // Re-sample the face at (u, v) and recover the direction.
    const back = { front: [found.u, found.v, -1], right: [1, found.v, found.u], back: [-found.u, found.v, 1],
      left: [-1, found.v, -found.u], top: [found.u, -1, -found.v], bottom: [found.u, 1, found.v] }[face];
    for (let index = 0; index < 3; index += 1) assert.ok(Math.abs(back[index] - [x, y, z][index]) < 1e-9, face);
  }
  // The transform: rotateY(A) rotateX(B) takes +z to -direction.
  const direction = [0.36, -0.48, -0.8];
  const transform = retainedStarTransform(direction);
  const yaw = Number(/rotateY\(([-0-9.]+)deg\)/u.exec(transform)[1]) * Math.PI / 180;
  const pitch = Number(/rotateX\(([-0-9.]+)deg\)/u.exec(transform)[1]) * Math.PI / 180;
  const normal = [Math.cos(pitch) * Math.sin(yaw), -Math.sin(pitch), Math.cos(pitch) * Math.cos(yaw)];
  for (let index = 0; index < 3; index += 1) assert.ok(Math.abs(normal[index] + direction[index]) < 1e-4);
  assert.match(transform, /translate3d\(calc\(0\.3564 \* var\(--planet-cubic-sky-half-side\)\)/u);
});

test("the real catalogue prepares to the derived limit, banded to magnitude 5 as retained points, brightest first, directions unit", async () => {
  const prepared = await prepareCatalogueStars({ fovDegrees: 60 });
  // Fainter than the reference's limit at factor 1 nothing is listed.
  assert.ok(prepared.count > 15000 && prepared.count < 30000, `count ${prepared.count}`);
  assert.ok(Math.abs(prepared.limitingMagnitude - 7.352) < 0.01);
  assert.equal(prepared.stars.every((star) => star.magnitude <= prepared.limitingMagnitude), true);
  assert.deepEqual([...prepared.bands.map((band) => band.id)], [...CATALOGUE_STAR_BANDS.map((band) => band.id)]);
  assert.equal(prepared.bands.reduce((sum, band) => sum + band.count, 0), prepared.count);
  // The reference's bands: 16, 34, 125, 340, 389, 695 (1,599 retained).
  const counts = Object.fromEntries(prepared.bands.map((band) => [band.id, band.count]));
  assert.ok(counts.brilliant >= 14 && counts.brilliant <= 18, `brilliant ${counts.brilliant}`);
  assert.ok(counts.faintest >= 650 && counts.faintest <= 750, `faintest ${counts.faintest}`);
  assert.ok(prepared.retainedCount > 1500 && prepared.retainedCount < 1700, `retained ${prepared.retainedCount}`);
  assert.equal(prepared.exposure.screenFactor, 1);
  assert.equal(prepared.exposure.adaptationLuminanceCdM2, EXPOSURE_KNOBS.adaptationLuminanceCdM2);
  for (let index = 1; index < prepared.stars.length; index += 1) {
    assert.ok(prepared.stars[index].magnitude >= prepared.stars[index - 1].magnitude);
  }
  for (const star of prepared.stars.slice(0, 2000)) {
    assert.ok(Math.abs(Math.hypot(...star.direction) - 1) < 1e-6);
    assert.ok(star.radiusPx <= STAR_RADIUS_MAX_PX && star.radiusPx >= POINT_MIN_RADIUS_PX);
    // Banded on the unrounded magnitude; the recorded one is rounded.
    if (Math.abs(star.magnitude - 5) > 0.002) {
      assert.equal(star.presentation, star.magnitude < 5 ? "retained" : "photographic");
    }
  }
  const sirius = prepared.stars.find((star) => star.name === "Sirius");
  assert.ok(sirius && sirius.magnitude < -1.4 && sirius.band === "brilliant");
  assert.equal(sirius.radiusPx, STAR_RADIUS_MAX_PX);
  assert.equal(prepared.runtimeGeometryDerivation, false);
});
