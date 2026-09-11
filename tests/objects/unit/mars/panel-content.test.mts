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
  assert.deepEqual(PREPARED_MARS_PANEL.facts.map(({id,label,value})=>({id,label,value})), [
    { id: "distance-from-sun", label: "Solar semimajor axis", value: "1.524 AU" },
    { id: "radius", label: "Mean radius", value: "3,389.5 km" },
    { id: "orbital-period", label: "Orbital period", value: "686.98 days" },
    { id: "rotation-period", label: "Rotation period", value: "24.62 hours" },
    { id: "axial-tilt", label: "Axial tilt", value: "25°" },
    { id: "moon-count", label: "Moons", value: "2" },
    { id: "ring-system", label: "Rings", value: "None" },
  ]);
  for(const fact of PREPARED_MARS_PANEL.facts.slice(0,4)){assert.ok(fact.source);assert.match(fact.source.url,/^https:\/\/ssd\.jpl\.nasa\.gov\//);assert.equal(fact.source.path,"source/editorial/factsheet-review.json");}
});
