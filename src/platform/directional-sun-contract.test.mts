import { requireRecord, requireFiniteNumber } from '../../tools/source-values.mts';
import { readFile } from 'node:fs/promises';
import { loadObjectTestDefinition } from '../../tools/object-test-data.mts';
import assert from "node:assert/strict";
import test from "node:test";

const PREPARED_EARTH_SKY_SUN = validateDirectionalSunPlan(requireRecord(await loadObjectTestDefinition('earth')).sun);
const PREPARED_JUPITER_SKY_SUN = validateDirectionalSunPlan(requireRecord(await loadObjectTestDefinition('jupiter')).sun);
const PREPARED_MARS_SKY_SUN = validateDirectionalSunPlan(requireRecord(await loadObjectTestDefinition('mars')).sun);
import PREPARED_MERCURY_SKY_SUN from "../../src/objects/mercury/prepared/sun.json" with {type: "json"};
const PREPARED_NEPTUNE_SKY_SUN = validateDirectionalSunPlan(requireRecord(await loadObjectTestDefinition('neptune')).sun);
const PREPARED_SATURN_SKY_SUN = validateDirectionalSunPlan(requireRecord(await loadObjectTestDefinition('saturn')).sun);
const PREPARED_URANUS_SKY_SUN = validateDirectionalSunPlan(requireRecord(await loadObjectTestDefinition('uranus')).sun);
import PREPARED_VENUS_SKY_SUN from "../../src/objects/venus/prepared/sun.json" with {type: "json"};
import {
  DIRECTIONAL_SUN_DISTANCE_STANDARD,
  DIRECTIONAL_SUN_PRESENTATION_STANDARD,
  validateDirectionalSunPlan,
  validateDirectionalSunPresentationStandard,
} from "./directional-sun-contract.mts";

const PLANETS = Object.freeze({
  mercury: PREPARED_MERCURY_SKY_SUN,
  venus: PREPARED_VENUS_SKY_SUN,
  earth: PREPARED_EARTH_SKY_SUN,
  mars: PREPARED_MARS_SKY_SUN,
  jupiter: PREPARED_JUPITER_SKY_SUN,
  saturn: PREPARED_SATURN_SKY_SUN,
  uranus: PREPARED_URANUS_SKY_SUN,
  neptune: PREPARED_NEPTUNE_SKY_SUN,
});

test("defines one reusable directional-Sun presentation standard", () => {
  assert.equal(
    validateDirectionalSunPresentationStandard(
      DIRECTIONAL_SUN_PRESENTATION_STANDARD,
    ),
    DIRECTIONAL_SUN_PRESENTATION_STANDARD,
  );
  assert.equal(DIRECTIONAL_SUN_PRESENTATION_STANDARD.projection.fixedAngularSize,
    true);
  assert.match(DIRECTIONAL_SUN_PRESENTATION_STANDARD.qualification,
    /no per-object native Sun position or ephemeris is claimed/u);
});

test("all eight planet packages publish the same independent Sun contract", () => {
  for (const [planetId, plan] of Object.entries(PLANETS)) {
    assert.equal(validateDirectionalSunPlan(plan), plan, planetId);
    assert.equal(plan.billboard, true, planetId);
    assert.equal(plan.bakedIntoStarfield, false, planetId);
    assert.equal(plan.runtimeRasterization, false, planetId);
    assert.equal(requireRecord(plan.asset).googlePixelsRedistributed, false, planetId);
    assert.match(plan.asset.url,
      new RegExp(`^/scenes/${planetId}/${planetId}-directional-sun\\.webp$`, "u"));
    assert.match(plan.asset.url2x,
      new RegExp(`^/scenes/${planetId}/${planetId}-directional-sun@2x\\.webp$`, "u"));
  }
});

test("prepares the physical solar disc from IAU radius and mean distance", async () => {
  const focalX = DIRECTIONAL_SUN_PRESENTATION_STANDARD.projection.focalX;
  let previousShare = Number.POSITIVE_INFINITY;
  for (const [planetId, plan] of Object.entries(PLANETS)) {
    const descriptor = requireRecord(JSON.parse(await readFile(`src/objects/${planetId}/object.json`, 'utf8')));
    const meanDistance = requireFiniteNumber(requireRecord(requireRecord(descriptor.properties).catalog).distanceAu);
    const observerDistance = meanDistance *
      DIRECTIONAL_SUN_DISTANCE_STANDARD.astronomicalUnitKilometers;
    const angularRadius = Math.atan(
      DIRECTIONAL_SUN_DISTANCE_STANDARD.nominalSolarRadiusKilometers /
        observerDistance,
    );
    const physicalDiskShare = focalX * Math.tan(angularRadius);
    const coreDiameterShare =
      plan.appearance.analyticRadialFit.coreRadiusPixels * 2 /
        plan.asset.density1.width;
    const expectedSpriteShare = physicalDiskShare / coreDiameterShare;
    assert.equal(plan.distanceScaling.meanHeliocentricDistanceAu,
      meanDistance, planetId);
    assert.ok(Math.abs(
      plan.distanceScaling.observerDistanceKilometers - observerDistance,
    ) < 1e-15, planetId);
    assert.ok(Math.abs(
      plan.distanceScaling.physicalDiskViewportWidthShare - physicalDiskShare,
    ) < 1e-15, planetId);
    assert.ok(Math.abs(
      plan.projection.apparentViewportWidthShare - expectedSpriteShare,
    ) < 1e-15, planetId);
    assert.ok(plan.projection.apparentViewportWidthShare < previousShare,
      planetId);
    previousShare = plan.projection.apparentViewportWidthShare;
  }
  assert.ok(Math.abs(
    PLANETS.mars.distanceScaling.physicalDiskViewportWidthShare * 1440 -
      7.630906389554822,
  ) < 1e-12);
  assert.ok(
    PLANETS.mars.projection.apparentViewportWidthShare <
      DIRECTIONAL_SUN_PRESENTATION_STANDARD.projection
        .apparentViewportWidthShare,
  );
});

test("rejects a baked or runtime-rasterized directional Sun", () => {
  assert.throws(() => validateDirectionalSunPlan({
    ...PREPARED_MARS_SKY_SUN,
    bakedIntoStarfield: true,
  }), /incompatible/u);
  assert.throws(() => validateDirectionalSunPlan({
    ...PREPARED_MARS_SKY_SUN,
    runtimeRasterization: true,
  }), /incompatible/u);
  assert.throws(() => validateDirectionalSunPlan({
    ...PREPARED_MARS_SKY_SUN,
    distanceScaling: {
      ...PREPARED_MARS_SKY_SUN.distanceScaling,
      meanHeliocentricDistanceAu: 2,
    },
  }), /incompatible/u);
});
