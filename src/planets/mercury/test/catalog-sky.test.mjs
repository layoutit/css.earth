import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { validatePreparedCatalogSky, visibleBandCount } from "../../../platform/catalog-sky-contract.mjs";
import {
  apparentMagnitudeFromAbsolute,
  createExposure,
  starIntensity,
  starRadiusPx,
} from "../../../platform/point-photometry.mjs";
import { PREPARED_MERCURY_CATALOG_SKY } from "../runtime/preparedCatalogSky.mjs";
import { PREPARED_MERCURY_SCENE } from "../runtime/preparedScene.mjs";
import { PREPARED_MERCURY_STARFIELD } from "../runtime/preparedStarfield.mjs";

const plan = PREPARED_MERCURY_CATALOG_SKY;

test("the prepared catalogue sky is the vendored HYG catalogue, byte for byte", async () => {
  assert.equal(validatePreparedCatalogSky(plan), plan);
  assert.equal(plan.source.key, "catalogs/stars-hyg");
  assert.equal(plan.source.license, "CC-BY-SA-4.0");
  const bytes = await readFile(new URL(`../../../../${plan.source.path}`, import.meta.url));
  assert.equal(bytes.byteLength, plan.source.bytes);
  assert.equal(createHash("sha256").update(bytes).digest("hex"), plan.source.sha256);
  assert.equal(plan.source.totalRows, 109389);
});

test("the stars sit in the frame the photographic sky was sampled in, under the same projection", () => {
  assert.equal(plan.cubeFrame, PREPARED_MERCURY_STARFIELD.astrometricRegistration.cubeFrame);
  assert.equal(plan.cubeFrame, "icrf-j2000-as-cube-local-axes");
  assert.equal(plan.projection.horizontalFovDegrees, PREPARED_MERCURY_STARFIELD.projection.horizontalFovDegrees);
  assert.equal(plan.projection.cssPerspective, PREPARED_MERCURY_SCENE.camera.projection.cssPerspective);
  assert.equal(PREPARED_MERCURY_SCENE.starfield.cameraContract, "scene-locked-unbounded-accumulated-matrix3d");
});

test("bands: six by apparent magnitude to 5.0, 1,599 stars, brightest first, every band drawn at every viewport", () => {
  assert.deepEqual(plan.bands.map((band) => [band.edgeMagnitude, band.count]),
    [[1, 16], [2, 34], [3, 125], [4, 340], [4.5, 389], [5, 695]]);
  assert.equal(plan.count, 1599);
  for (let index = 1; index < plan.count; index += 1) {
    assert.ok(plan.stars.magnitude[index] >= plan.stars.magnitude[index - 1], `order at ${index}`);
  }
  // The point population stops above the photometric pin: nothing prepared
  // is drawn pinned and faded; the photograph carries what is fainter.
  assert.ok(plan.coexistence.pointFaintestMagnitude < plan.photometry.pinMagnitude);
  assert.ok(Math.abs(plan.photometry.limitingMagnitude - 7.35) < 0.05);
  // The shared 60-degree projection is fixed, so the gate shows every band
  // from the smallest screen factor the chain compensates to the largest.
  assert.equal(visibleBandCount(plan, { screenFactor: 0.7 }), 6);
  assert.equal(visibleBandCount(plan, { screenFactor: 1.5 }), 6);
  assert.equal(visibleBandCount(plan, { screenFactor: 1, magnitudeLimit: 3 }), 3);
});

test("each star's radius and luminance are the photometric chain at the shared projection", () => {
  const exposure = createExposure({ fovDegrees: plan.projection.horizontalFovDegrees });
  for (const index of [0, 1, 100, 500, 1000, plan.count - 1]) {
    const magnitude = plan.stars.magnitude[index];
    assert.ok(Math.abs(plan.stars.radiusPx[index] - starRadiusPx(exposure, magnitude)) < 1e-3, `radius ${index}`);
    assert.ok(Math.abs(plan.stars.alpha[index] - starIntensity(exposure, magnitude)) < 1e-3, `alpha ${index}`);
  }
  assert.equal(plan.stars.radiusPx[0], 1.25);
  assert.ok(plan.stars.radiusPx.at(-1) > 0.6 && plan.stars.radiusPx.at(-1) < 1);
});

test("Sirius leads, named and where the catalogue puts it", () => {
  const sirius = plan.named[0];
  assert.equal(sirius.name, "Sirius");
  assert.equal(sirius.hip, 32349);
  assert.equal(sirius.index, 0);
  assert.equal(plan.stars.hip[0], 32349);
  assert.ok(Math.abs(plan.stars.magnitude[0] - apparentMagnitudeFromAbsolute(1.45, 2.64)) < 0.02);
  // ICRS direction of Sirius (RA 101.287 deg, Dec -16.716 deg).
  const ra = 101.287 * Math.PI / 180;
  const dec = -16.716 * Math.PI / 180;
  const expected = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
  expected.forEach((value, axis) => assert.ok(Math.abs(sirius.direction[axis] - value) < 2e-3, `axis ${axis}`));
  // And the prepared angles place it there.
  const yaw = plan.stars.rotateYDegrees[0] * Math.PI / 180;
  const pitch = plan.stars.rotateXDegrees[0] * Math.PI / 180;
  const placed = [-Math.cos(pitch) * Math.sin(yaw), Math.sin(pitch), -Math.cos(pitch) * Math.cos(yaw)];
  placed.forEach((value, axis) => assert.ok(Math.abs(value - sirius.direction[axis]) < 1e-4, `placed axis ${axis}`));
  assert.equal(plan.named.length, 387);
  assert.ok(plan.named.every((star) => plan.stars.magnitude[star.index] <= plan.labels.magnitudeLimit));
});

test("captions follow the shell rail's typography by token and the shared label policy's geometry", () => {
  assert.deepEqual(plan.labels.typography, {
    model: "shell-navigation-rail-scale-label",
    fontFamilyToken: "--shell-ui-font",
    colorToken: "--shell-text-secondary",
    fontSizePx: 14,
    fontWeight: 400,
    lineHeight: 1.3,
    opacity: 0.72,
  });
  assert.equal(plan.labels.policy.capPixels, 10.08);
  assert.equal(plan.labels.policy.maxAlpha, 0.72);
  assert.equal(plan.labels.policy.poolSize, 12);
  assert.equal(plan.labels.policy.gapPixels, 7);
  assert.equal(plan.labels.policy.spacingPixels, 4);
  // The reference's ordinary-caption budget: one named star at a time.
  assert.equal(plan.labels.ordinaryLimit, 1);
});

test("the point presentation carries the reference's star constants", () => {
  assert.deepEqual(plan.presentation.star, { maxRadiusPx: 1.25, haloRadii: 2.5, haloPeak: 0.08, intensityMax: 0.95 });
  assert.equal(plan.presentation.halo.model, "box-shadow-bloom");
  assert.equal(plan.presentation.halo.spreadRadii + plan.presentation.halo.blurRadii + 1, plan.presentation.star.haloRadii);
  assert.ok(plan.stars.alpha.every((alpha) => alpha <= 0.95));
});

test("keeps the catalogue sky runtime retained and free of forbidden features", async () => {
  const [runtime, styles, contract] = await Promise.all([
    readFile(new URL("../../../platform/catalog-sky-runtime.mjs", import.meta.url), "utf8"),
    readFile(new URL("../../../platform/catalog-sky.css", import.meta.url), "utf8"),
    readFile(new URL("../../../platform/catalog-sky-contract.mjs", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(runtime, /\bfetch\s*\(|XMLHttpRequest|WebSocket|@cssearth\/catalog|\.gxct/u);
  assert.doesNotMatch(runtime, /createElement\(["'](?:canvas|svg)["']\)/u);
  assert.doesNotMatch(styles, /(?:clip-path|(?:-webkit-)?mask|filter\s*:|gradient\(|mix-blend-mode)/iu);
  // Tokens, not literals, for the caption typography.
  assert.match(styles, /font-family: var\(--shell-ui-font\)/u);
  assert.match(styles, /color: var\(--shell-text-secondary\)/u);
  // The runtime writes one transform per publication for every star and
  // never creates elements after mount.
  assert.match(runtime, /orientation\.style\.transform = view\.skyboxMatrix/u);
  assert.doesNotMatch(runtime.split("return Object.freeze({")[1], /createElement/u);
  assert.match(contract, /runtimeGeometryDerivation !== false/u);
});
