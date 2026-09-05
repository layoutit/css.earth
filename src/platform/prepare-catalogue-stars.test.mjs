import assert from "node:assert/strict";
import test from "node:test";
import {
  CATALOGUE_STAR_BANDS,
  RETAINED_RADIUS_MAX_PX,
  SKIP_RADIUS_PX,
  apparentMagnitude,
  createExposure,
  cubeFaceOf,
  lightGrasp,
  magnitudeForRadiusPx,
  pointRadiusPx,
  prepareCatalogueStars,
  retainedStarTransform,
  starColor,
  starPresentation,
} from "./prepare-catalogue-stars.mjs";

const exposure = createExposure({ fovDegrees: 60, viewportWidthPx: 1440, viewportHeightPx: 900 });

test("the photometric chain matches the reference at its fixed points", () => {
  // The naked eye at 60 degrees gathers exactly the reference's unit grasp.
  assert.equal(lightGrasp(60), 1);
  assert.ok(lightGrasp(6) > 90 && lightGrasp(6) < 110, "a ten-fold narrower field buys about five magnitudes");
  // The screen factor is 1 at a 600 px short side, clamped to 0.7..1.5; at
  // 900 px it is 1.5, so the radius gain is 1.5 x 1.5.
  assert.equal(exposure.radiusScale, 2.25);
  assert.equal(exposure.radiusExponent, 0.55);
  // Radius falls monotonically with magnitude, and the inversion is exact.
  let previous = Number.POSITIVE_INFINITY;
  for (let magnitude = -2; magnitude <= 10; magnitude += 0.5) {
    const radius = pointRadiusPx(exposure, magnitude);
    assert.ok(radius < previous, `radius at ${magnitude}`);
    assert.ok(Math.abs(magnitudeForRadiusPx(exposure, radius) - magnitude) < 1e-9);
    previous = radius;
  }
  // The limit the chain derives: the magnitude whose radius is the skip
  // threshold, about 8.8 at this field.
  const limit = magnitudeForRadiusPx(exposure, SKIP_RADIUS_PX);
  assert.ok(limit > 8.7 && limit < 8.9, `limiting magnitude ${limit}`);
  assert.equal(starPresentation(exposure, limit + 0.01), null);
  const faint = starPresentation(exposure, limit - 0.5);
  assert.ok(faint.luminance > 0 && faint.luminance < 0.3, "a star near the limit fades out");
  // Distance modulus.
  assert.ok(Math.abs(apparentMagnitude(4.83, 10) - 4.83) < 1e-12);
  // Sirius: absolute 1.45 at 2.64 pc is -1.46 (HYG carries -1.44).
  assert.ok(Math.abs(apparentMagnitude(1.45, 2.64) - -1.46) < 0.02, "Sirius");
});

test("the retained band's presented size follows magnitude under a three-pixel ceiling, and colour follows temperature", () => {
  const sirius = starPresentation(exposure, -1.44);
  const polaris = starPresentation(exposure, 1.97);
  const alcyone = starPresentation(exposure, 2.85);
  assert.equal(sirius.retainedRadiusPx, RETAINED_RADIUS_MAX_PX);
  assert.ok(polaris.retainedRadiusPx > alcyone.retainedRadiusPx && alcyone.retainedRadiusPx > 0.6);
  // The reference's own cap would draw all three at 1.25 px.
  assert.equal(sirius.radiusPx, 1.25);
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

test("the real catalogue prepares to the derived limit, banded, brightest first, directions unit", async () => {
  const prepared = await prepareCatalogueStars({ fovDegrees: 60 });
  assert.ok(prepared.count > 60000 && prepared.count < 80000, `count ${prepared.count}`);
  assert.equal(prepared.stars.every((star) => star.magnitude <= prepared.limitingMagnitude), true);
  assert.deepEqual([...prepared.bands.map((band) => band.id)], [...CATALOGUE_STAR_BANDS.map((band) => band.id)]);
  assert.equal(prepared.bands.reduce((sum, band) => sum + band.count, 0), prepared.count);
  assert.ok(prepared.retainedCount > 200 && prepared.retainedCount < 400);
  for (let index = 1; index < prepared.stars.length; index += 1) {
    assert.ok(prepared.stars[index].magnitude >= prepared.stars[index - 1].magnitude);
  }
  for (const star of prepared.stars.slice(0, 500)) {
    assert.ok(Math.abs(Math.hypot(...star.direction) - 1) < 1e-6);
    // Banded on the unrounded magnitude; the recorded one is rounded.
    if (Math.abs(star.magnitude - 3.5) > 0.002) {
      assert.equal(star.presentation, star.magnitude < 3.5 ? "retained" : "photographic");
    }
  }
  const sirius = prepared.stars.find((star) => star.name === "Sirius");
  assert.ok(sirius && sirius.magnitude < -1.4 && sirius.band === "brilliant");
  assert.equal(prepared.runtimeGeometryDerivation, false);
});
