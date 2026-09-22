import { requireRecord, requireFiniteNumber } from '../../tools/sources/source-values.mts';
import { readFile } from 'node:fs/promises';
import { loadObjectTestDefinition } from '../../tools/contract/object-test-data.mts';
import assert from "node:assert/strict";
import test from "node:test";
import PREPARED_MERCURY_SUN from "../../src/objects/mercury/prepared/sun.json" with {type: "json"};
import PREPARED_VENUS_SUN from "../../src/objects/venus/prepared/sun.json" with {type: "json"};
import {
  DIRECTIONAL_SUN_PRESENTATION_STANDARD,
  PREPARED_DIRECTIONAL_SUN_SCHEMA,
  validateDirectionalSunPlan,
  validateDirectionalSunPresentationStandard,
} from "./directional-sun-contract.mts";
import { prepareSolarSystemSunPresentation } from "../../tools/objects/solar-system-scene.mts";

const runtimeSun = async (id: string) => validateDirectionalSunPlan(requireRecord(await loadObjectTestDefinition(id)).sun);
const PLANETS = Object.freeze({
  mercury: validateDirectionalSunPlan(PREPARED_MERCURY_SUN),
  venus: validateDirectionalSunPlan(PREPARED_VENUS_SUN),
  earth: await runtimeSun('earth'),
  mars: await runtimeSun('mars'),
  jupiter: await runtimeSun('jupiter'),
  saturn: await runtimeSun('saturn'),
  uranus: await runtimeSun('uranus'),
  neptune: await runtimeSun('neptune'),
});
// The shared universe draws the Sun; a package keeps only the direction its lighting reads.
const RETIRED_SUN_FIELDS = ["asset", "billboard", "bakedIntoStarfield", "runtimeRasterization", "distanceScaling", "projection", "appearance"];

test("defines one reusable directional-Sun presentation standard", () => {
  assert.equal(validateDirectionalSunPresentationStandard(DIRECTIONAL_SUN_PRESENTATION_STANDARD),
    DIRECTIONAL_SUN_PRESENTATION_STANDARD);
  assert.match(DIRECTIONAL_SUN_PRESENTATION_STANDARD.qualification,
    /no per-object native Sun position or ephemeris is claimed/u);
  assert.throws(() => validateDirectionalSunPresentationStandard({
    ...DIRECTIONAL_SUN_PRESENTATION_STANDARD, localDirection: [1, 1, 0],
  }), /invalid/u);
});

test("all eight planet packages publish a Sun direction and no Sun raster", () => {
  for (const [planetId, plan] of Object.entries(PLANETS)) {
    assert.equal(plan.schema, PREPARED_DIRECTIONAL_SUN_SCHEMA, planetId);
    for (const field of RETIRED_SUN_FIELDS) assert.equal(field in plan, false, `${planetId}: ${field}`);
  }
});

test("a solar-system Sun direction is its observer's solar geometry", () => {
  for (const [bodyId, displayName] of [["mercury", "Mercury"], ["venus", "Venus"]] as const) {
    const presentation = prepareSolarSystemSunPresentation({ bodyId, displayName });
    assert.deepEqual(PLANETS[bodyId].localDirection, presentation.localDirection, bodyId);
    assert.deepEqual(PLANETS[bodyId].referenceViewDirection, presentation.referenceViewDirection, bodyId);
    assert.equal(PLANETS[bodyId].provenance.sourcePath, "src/platform/solar-geometry.mts", bodyId);
  }
});

test("rejects an incompatible directional Sun", () => {
  const plan = PLANETS.mars;
  assert.equal(validateDirectionalSunPlan(plan), plan);
  for (const drift of [
    { schema: "cssearth-prepared-directional-sun@3" },
    { localDirection: [0, 0, 2] },
    { referenceViewDirection: [0, Number.NaN, 1] },
    { provenance: { source: "test" } },
  ]) {
    assert.throws(() => validateDirectionalSunPlan({ ...plan, ...drift }), /incompatible/u);
  }
});
