import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import editorial from "../../../../data/planets/saturn.json" with { type: "json" };
import moonCatalog from "../source/moons/saturn-moons.json" with { type: "json" };
import { PREPARED_SATURN_PANEL } from "../site/preparedPanel.mjs";

test("publishes one source-bound Saturn panel model", async () => {
  assert.equal(PREPARED_SATURN_PANEL.schema, "cssearth-prepared-panel@1");
  assert.equal(PREPARED_SATURN_PANEL.planetId, "saturn");
  assert.equal(PREPARED_SATURN_PANEL.sources.editorial.sourceId, editorial.sourceId);
  assert.equal(PREPARED_SATURN_PANEL.sources.editorial.modified, editorial.modified);
  assert.equal(PREPARED_SATURN_PANEL.sources.renderedMoons.count, moonCatalog.counts.confirmed);
  assert.deepEqual(PREPARED_SATURN_PANEL.moonCountPolicy, {
    editorial: 274,
    editorialAsOf: "2025-03",
    rendered: 293,
    renderedRetrievedAt: moonCatalog.retrievedAt,
    rule: "Display the NASA editorial count with its date. Render the newer JPL catalog count without rewriting NASA's dated prose.",
  });
  const panel = await readFile(new URL("../site/SaturnPanel.astro", import.meta.url), "utf8");
  assert.match(panel, /PREPARED_SATURN_PANEL\.introduction/u);
  assert.match(panel, /PREPARED_SATURN_PANEL\.facts/u);
  assert.match(panel, /PREPARED_SATURN_PANEL\.moreFacts/u);
  assert.doesNotMatch(panel, /1\.4 billion|120,500|29\.4 Earth|10\.7 hours|274/u);
});
