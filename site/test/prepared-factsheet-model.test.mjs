import assert from "node:assert/strict";
import test from "node:test";

import { PREPARED_EARTH_PANEL } from "../../src/planets/earth/site/preparedPanel.mjs";
import { PREPARED_CERES_PANEL } from "../../src/planets/ceres/site/preparedPanel.mjs";
import { PREPARED_JUPITER_PANEL } from "../../src/planets/jupiter/site/preparedPanel.mjs";
import { PREPARED_MARS_PANEL } from "../../src/planets/mars/site/preparedPanel.mjs";
import { PREPARED_MERCURY_PANEL } from "../../src/planets/mercury/site/preparedPanel.mjs";
import { PREPARED_MOON_PANEL } from "../../src/planets/moon/site/preparedPanel.mjs";
import { PREPARED_NEPTUNE_PANEL } from "../../src/planets/neptune/site/preparedPanel.mjs";
import { PREPARED_PLUTO_PANEL } from "../../src/planets/pluto/site/preparedPanel.mjs";
import { PREPARED_SATURN_PANEL } from "../../src/planets/saturn/site/preparedPanel.mjs";
import { PREPARED_SUN_PANEL } from "../../src/planets/sun/site/preparedPanel.mjs";
import { PREPARED_URANUS_PANEL } from "../../src/planets/uranus/site/preparedPanel.mjs";
import { PREPARED_VENUS_PANEL } from "../../src/planets/venus/site/preparedPanel.mjs";

const PLANET_PANELS = Object.freeze([
  PREPARED_MERCURY_PANEL,
  PREPARED_VENUS_PANEL,
  PREPARED_EARTH_PANEL,
  PREPARED_MARS_PANEL,
  PREPARED_JUPITER_PANEL,
  PREPARED_SATURN_PANEL,
  PREPARED_URANUS_PANEL,
  PREPARED_NEPTUNE_PANEL,
]);
const CORE_PLANET_FACT_IDS = Object.freeze([
  "distance-from-sun",
  "diameter",
  "orbital-period",
  "rotation-period",
  "axial-tilt",
  "moon-count",
  "ring-system",
]);

test("keeps every planet factsheet comparable and concise", () => {
  for (const panel of PLANET_PANELS) {
    assert.deepEqual(
      panel.facts.map(({ id }) => id),
      CORE_PLANET_FACT_IDS,
      `${panel.planetId} core facts`,
    );
    assert.ok(panel.moreFacts.length <= 2, `${panel.planetId} signature facts`);
  }
});

test("uses unique semantic ids without hidden title-only content", () => {
  for (const panel of [...PLANET_PANELS, PREPARED_MOON_PANEL, PREPARED_PLUTO_PANEL, PREPARED_SUN_PANEL, PREPARED_CERES_PANEL]) {
    const facts = [...panel.facts, ...panel.moreFacts];
    const ids = facts.map(({ id }) => id);
    assert.equal(new Set(ids).size, ids.length);
    assert.ok(!ids.includes("classification"), "classification belongs to the registry-backed title tag");
    for (const fact of facts) {
      assert.match(fact.id, /^[a-z]+(?:-[a-z]+)*$/u);
      assert.equal("title" in fact, false);
    }
  }
});

test("keeps Pluto concise and removes lens-presentation rows", () => {
  const facts = [...PREPARED_PLUTO_PANEL.facts, ...PREPARED_PLUTO_PANEL.moreFacts];
  assert.equal(facts.length, 7);
  assert.equal(facts[0].id, "distance-from-sun");
  assert.doesNotMatch(
    facts.map(({ label }) => label).join(" "),
    /grid|elevation colors/iu,
  );
});

test("keeps object-internal identifiers out of the Moon factsheet", () => {
  assert.doesNotMatch(
    PREPARED_MOON_PANEL.facts.map(({ label }) => label).join(" "),
    /NAIF|identifier/iu,
  );
});
