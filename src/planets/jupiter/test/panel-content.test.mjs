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
    { label: "Distance", value: "778 million km" },
    { label: "Diameter", value: "139,822 km" },
    { label: "Year", value: "12 Earth years" },
    { label: "Day", value: "9.9 hours" },
    {
      label: "Moons",
      value: "115",
      title: "JPL catalog snapshot retrieved 2026-08-30T21:12:38Z. Four Galilean moons use source imagery; 111 smaller moons use prepared catalog markers; all 57 IAU-named moons are labeled.",
    },
  ]);
  assert.deepEqual(PREPARED_JUPITER_PANEL.moreFacts, [
    {
      label: "Rings",
      value: "3 parts",
      title: "A halo, main ring, and gossamer ring; the gossamer ring has Amalthea and Thebe components.",
    },
    { label: "Light time", value: "43 min" },
    { label: "Tilt", value: "3\u00b0" },
    {
      label: "Cloud layers",
      value: "71 km",
      title: "Combined depth of Jupiter's three likely cloud layers",
    },
    {
      label: "Wind",
      value: "539 km/h",
      title: "Upper-atmosphere equatorial wind speed",
    },
    {
      label: "Great Red Spot",
      value: "500 km",
      title: "Depth constrained by Juno gravity data",
    },
    { label: "Magnetic field", value: "16\u201354\u00d7 Earth" },
  ]);
});
