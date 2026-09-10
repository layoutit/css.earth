import assert from "node:assert/strict";
import test from "node:test";

import editorial from "../../../../data/planets/mars.json" with { type: "json" };
import { PREPARED_MARS_PANEL } from "../../unit/mars/prepared-fixture.mts";

test("publishes one source-bound Mars panel model", () => {
  assert.equal(PREPARED_MARS_PANEL.schema, "cssearth-prepared-panel@1");
  assert.equal(PREPARED_MARS_PANEL.planetId, "mars");
  assert.equal(PREPARED_MARS_PANEL.sources.editorial.sourceId, editorial.sourceId);
  assert.equal(PREPARED_MARS_PANEL.sources.editorial.modified, editorial.modified);
  assert.equal(PREPARED_MARS_PANEL.sources.renderedMoons.count, 2);
  assert.deepEqual(PREPARED_MARS_PANEL.facts, [
    { id: "distance-from-sun", label: "Distance from Sun", value: "228 million km" },
    { id: "diameter", label: "Diameter", value: "6,780 km" },
    { id: "orbital-period", label: "Orbital period", value: "687 Earth days" },
    { id: "rotation-period", label: "Rotation period", value: "24.6 hours" },
    { id: "axial-tilt", label: "Axial tilt", value: "25°" },
    { id: "moon-count", label: "Moons", value: "2" },
    { id: "ring-system", label: "Rings", value: "None" },
  ]);
});
