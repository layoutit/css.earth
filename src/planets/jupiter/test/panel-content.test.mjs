import assert from "node:assert/strict";
import test from "node:test";

import editorial from "../../../../data/planets/jupiter.json" with { type: "json" };
import { PREPARED_JUPITER_PANEL } from "../site/preparedPanel.mjs";

test("publishes one source-bound Jupiter panel model", () => {
  assert.equal(PREPARED_JUPITER_PANEL.schema, "cssearth-prepared-panel@1");
  assert.equal(PREPARED_JUPITER_PANEL.planetId, "jupiter");
  assert.equal(PREPARED_JUPITER_PANEL.sources.editorial.sourceId, editorial.sourceId);
  assert.equal(PREPARED_JUPITER_PANEL.sources.editorial.modified, editorial.modified);
  assert.equal(PREPARED_JUPITER_PANEL.sources.renderedMoons.count, 115);
  assert.equal(PREPARED_JUPITER_PANEL.sources.renderedMoons.detailedCount, 4);
  assert.equal(PREPARED_JUPITER_PANEL.sources.renderedMoons.minorCount, 111);
  assert.deepEqual(PREPARED_JUPITER_PANEL.sources.rings.parts,
    ["halo", "main", "gossamer"]);
  assert.equal(PREPARED_JUPITER_PANEL.introduction,
    "The fifth planet from the Sun, Jupiter is the solar system's largest planet: a gas giant wrapped in colorful clouds and enormous storms.");
  assert.deepEqual(PREPARED_JUPITER_PANEL.facts, [
    { id: "distance-from-sun", label: "Distance from Sun", value: "778 million km" },
    { id: "diameter", label: "Diameter", value: "139,822 km" },
    { id: "orbital-period", label: "Orbital period", value: "12 Earth years" },
    { id: "rotation-period", label: "Rotation period", value: "9.9 hours" },
    { id: "axial-tilt", label: "Axial tilt", value: "3°" },
    { id: "moon-count", label: "Moons", value: "115" },
    { id: "ring-system", label: "Rings", value: "Present" },
  ]);
  assert.deepEqual(PREPARED_JUPITER_PANEL.moreFacts, [
    { id: "wind-speed", label: "Wind", value: "539 km/h" },
    { id: "great-red-spot-depth", label: "Great Red Spot depth", value: "500 km" },
  ]);
});
