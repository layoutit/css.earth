import assert from "node:assert/strict";
import test from "node:test";

import editorial from "../../../../data/planets/mars.json" with { type: "json" };
import { PREPARED_MARS_PANEL } from "../site/preparedPanel.mjs";

test("publishes one source-bound Mars panel model", () => {
  assert.equal(PREPARED_MARS_PANEL.schema, "cssearth-prepared-panel@1");
  assert.equal(PREPARED_MARS_PANEL.planetId, "mars");
  assert.equal(PREPARED_MARS_PANEL.sources.editorial.sourceId, editorial.sourceId);
  assert.equal(PREPARED_MARS_PANEL.sources.editorial.modified, editorial.modified);
  assert.equal(PREPARED_MARS_PANEL.sources.renderedMoons.count, 2);
  assert.deepEqual(PREPARED_MARS_PANEL.facts, [
    { label: "Distance", value: "228 million km" },
    { label: "Diameter", value: "6,780 km" },
    { label: "Year", value: "687 Earth days" },
    { label: "Day", value: "24.6 hours" },
    { label: "Moons", value: "2" },
  ]);
});
