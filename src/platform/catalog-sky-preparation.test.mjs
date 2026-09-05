import assert from "node:assert/strict";
import test from "node:test";

import {
  CATALOG_SKY_CUBE_FRAME,
  PREPARED_CATALOG_SKY_SCHEMA,
  validatePreparedCatalogSky,
  visibleBandCount,
} from "./catalog-sky-contract.mjs";
import {
  STAR_COLOR_CLASS_EDGES_K,
  colorClassOf,
  prepareCatalogSky,
  starLabelPolicy,
} from "./catalog-sky-preparation.mjs";
import { DEFAULT_LABEL_POLICY } from "./label-field.mjs";

// A synthetic catalogue in the reader's shape: a handful of stars at known
// directions and magnitudes, one of them named, one unmeasured.
function syntheticCatalog(rows) {
  const count = rows.length;
  const columns = {
    posPc: new Float32Array(count * 3),
    absMag: new Float32Array(count),
    teffK: new Float32Array(count),
    colorIndexBv: new Float32Array(count),
    hip: new Int32Array(count),
  };
  const names = [];
  rows.forEach((row, index) => {
    const distance = row.distancePc ?? 10;
    columns.posPc.set(row.direction.map((value) => value * distance), index * 3);
    // Absolute magnitude that yields the requested apparent magnitude.
    columns.absMag[index] = row.magnitude - 5 * Math.log10(distance) + 5;
    columns.teffK[index] = row.teffK ?? Number.NaN;
    columns.colorIndexBv[index] = row.bv ?? Number.NaN;
    columns.hip[index] = row.hip ?? index + 1;
    names.push(row.name ?? "");
  });
  return {
    count,
    meta: { source: "synthetic" },
    names: Object.keys(columns).concat("name"),
    numeric: (name) => columns[name],
    strings: () => names,
  };
}

const provenance = Object.freeze({
  key: "catalogs/synthetic", path: "data/catalogs/synthetic.gxct", bytes: 1,
  sha256: "0".repeat(64), source: "synthetic", license: "none",
});
const projection = Object.freeze({
  horizontalFovDegrees: 60, focalLengthOverViewportWidth: Math.sqrt(3) / 2, cssPerspective: "86.60254037844386cqw",
});
const rows = [
  { direction: [0, 0, -1], magnitude: -1.4, name: "Ahead", teffK: 10000 },
  { direction: [1, 0, 0], magnitude: 0.5, name: "Right", bv: 0.65 },
  { direction: [0, 1, 0], magnitude: 2.5, teffK: 3500 },
  { direction: [0, -1, 0], magnitude: 3.9, name: "Up" },
  { direction: [-1, 0, 0], magnitude: 4.8 },
  { direction: [0, 0, 1], magnitude: 5.4, name: "Behind" },
  { direction: [0.6, 0.8, 0], magnitude: 9, name: "Too faint" },
  { direction: [0, 0, 0], magnitude: 1, name: "No distance", distancePc: 0 },
];
const plan = prepareCatalogSky({ catalog: syntheticCatalog(rows), provenance, projection, bandEdges: [1, 3, 5] });

test("selects by apparent magnitude, sorts brightest first and bands contiguously", () => {
  assert.equal(plan.schema, PREPARED_CATALOG_SKY_SCHEMA);
  assert.equal(plan.cubeFrame, CATALOG_SKY_CUBE_FRAME);
  assert.equal(plan.count, 5);
  assert.deepEqual(plan.stars.magnitude, [-1.4, 0.5, 2.5, 3.9, 4.8]);
  assert.deepEqual(plan.bands.map((band) => [band.edgeMagnitude, band.start, band.end]), [[1, 0, 2], [3, 2, 3], [5, 3, 5]]);
  assert.ok(plan.bands.every((band, index) => index === 0 || band.minimumScreenFactor > plan.bands[index - 1].minimumScreenFactor));
  assert.equal(plan.runtimeGeometryDerivation, false);
  assert.equal(validatePreparedCatalogSky(plan), plan);
});

test("the prepared angles invert to the catalogue direction (rotateY then rotateX then translateZ facing the eye)", () => {
  plan.stars.rotateYDegrees.forEach((yaw, index) => {
    const pitch = plan.stars.rotateXDegrees[index] * Math.PI / 180;
    const a = yaw * Math.PI / 180;
    const direction = [-Math.cos(pitch) * Math.sin(a), Math.sin(pitch), -Math.cos(pitch) * Math.cos(a)];
    const expected = rows.filter((row) => row.magnitude <= 5 && row.distancePc !== 0)
      .sort((left, right) => left.magnitude - right.magnitude)[index].direction;
    expected.forEach((value, axis) => assert.ok(Math.abs(direction[axis] - value) < 1e-6, `star ${index} axis ${axis}`));
  });
});

test("radius and luminance follow the photometric chain: brighter is larger and brighter, within the star ceiling", () => {
  const radius = plan.stars.radiusPx;
  const alpha = plan.stars.alpha;
  for (let index = 1; index < radius.length; index += 1) {
    assert.ok(radius[index] <= radius[index - 1], `radius ${index}`);
    assert.ok(alpha[index] <= alpha[index - 1], `alpha ${index}`);
  }
  assert.equal(radius[0], plan.photometry.star.maxRadiusPx);
  assert.ok(radius.at(-1) >= plan.photometry.minRadiusPx);
  assert.ok(alpha[0] <= plan.photometry.star.intensityMax);
});

test("named stars carry their unit direction and only the ones within the caption limit", () => {
  assert.deepEqual(plan.named.map((star) => star.name), ["Ahead", "Right", "Up"]);
  assert.deepEqual(plan.named.map((star) => star.index), [0, 1, 3]);
  for (const star of plan.named) assert.ok(Math.abs(Math.hypot(...star.direction) - 1) < 1e-6);
  const stricter = prepareCatalogSky({ catalog: syntheticCatalog(rows), provenance, projection, bandEdges: [5], labelMagnitudeLimit: 1 });
  assert.deepEqual(stricter.named.map((star) => star.name), ["Ahead", "Right"]);
  assert.equal(stricter.labels.magnitudeLimit, 1);
});

test("colour classes bin by temperature, from B-V when no temperature is published", () => {
  assert.equal(plan.colorClasses.length, STAR_COLOR_CLASS_EDGES_K.length - 1);
  assert.ok(colorClassOf(10000, Number.NaN) > colorClassOf(3500, Number.NaN));
  assert.equal(colorClassOf(Number.NaN, 0.65), colorClassOf(5800, Number.NaN));
  assert.equal(plan.stars.colorClass[0], colorClassOf(10000, Number.NaN));
  assert.equal(plan.stars.colorClass[1], colorClassOf(Number.NaN, 0.65));
  const counted = plan.colorClasses.reduce((total, entry) => total + entry.count, 0);
  assert.equal(counted, plan.count);
});

test("the band gate shows every band whose faintest star draws above the skip radius, up to the magnitude limit", () => {
  assert.equal(visibleBandCount(plan, { screenFactor: 1 }), 3);
  assert.equal(visibleBandCount(plan, { screenFactor: 1, magnitudeLimit: 2 }), 1);
  assert.equal(visibleBandCount(plan, { screenFactor: 1, magnitudeLimit: 3.9 }), 2);
  assert.equal(visibleBandCount(plan, { screenFactor: plan.bands[1].minimumScreenFactor - 1e-6 }), 1);
  assert.equal(visibleBandCount(plan, { screenFactor: 0.01 }), 0);
});

test("the star label policy is the shared policy at the rail's cap height, pool and opacity", () => {
  const policy = starLabelPolicy();
  assert.equal(policy.gapPixels, DEFAULT_LABEL_POLICY.gapPixels);
  assert.equal(policy.spacingPixels, DEFAULT_LABEL_POLICY.spacingPixels);
  assert.equal(policy.capPixels, 10.08);
  assert.equal(policy.poolSize, 12);
  assert.equal(policy.maxAlpha, 0.72);
  assert.equal(plan.labels.policy.capPixels, 10.08);
  assert.equal(plan.labels.ordinaryLimit, 1);
  assert.equal(plan.presentation.halo.alpha, 0.16);
  assert.throws(() => validatePreparedCatalogSky({ ...plan, labels: { ...plan.labels, ordinaryLimit: 13 } }), /incompatible/u);
});

test("the validator rejects a plan whose bands do not cover the stars or whose columns are short", () => {
  assert.throws(() => validatePreparedCatalogSky({ ...plan, bands: plan.bands.slice(0, 2) }), /cover/u);
  assert.throws(() => validatePreparedCatalogSky({ ...plan, stars: { ...plan.stars, alpha: plan.stars.alpha.slice(1) } }), /incompatible/u);
  assert.throws(() => validatePreparedCatalogSky({ ...plan, runtimeGeometryDerivation: true }), /incompatible/u);
  assert.throws(() => prepareCatalogSky({ catalog: syntheticCatalog(rows), provenance, projection, bandEdges: [3, 1] }), /ascending/u);
});
