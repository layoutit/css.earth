import {required} from '../../../../tools/test-values.mts';
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import editorial from "../../../../data/planets/saturn.json" with { type: "json" };
import moonCatalog from '../../../../src/objects/saturn/source/moons/saturn-moons.json' with {type:'json'};
import {readPreparedFixture} from '../../fixtures.mts';
const PREPARED_SATURN_PANEL=await readPreparedFixture('saturn','content');

test("publishes one source-bound Saturn panel model", async () => {
  assert.equal(PREPARED_SATURN_PANEL.schema, 'cssearth-prepared-content@1');
  assert.equal(PREPARED_SATURN_PANEL.objectId, 'saturn');
  assert.equal(PREPARED_SATURN_PANEL.provenance.editorial.sourceId, editorial.sourceId);
  assert.equal(PREPARED_SATURN_PANEL.provenance.editorial.modified, editorial.modified);
  assert.equal(required(PREPARED_SATURN_PANEL.facts.find((fact: { id: string; })=>fact.id==='moon-count')).value,`${moonCatalog.counts.confirmed} · Aug 2026`);
  assert.equal(moonCatalog.counts.confirmed,293);
  assert.ok(Number.isFinite(Date.parse(moonCatalog.retrievedAt)));
  const panel = await readFile(new URL('../../../../site/components/PreparedObjectPanel.astro',import.meta.url),'utf8');
  assert.match(panel, /text\.introduction\.text/u);
  assert.match(panel, /content\.facts/u);
  assert.match(panel, /content\.moreFacts/u);
  assert.doesNotMatch(panel, /1\.4 billion|120,500|29\.4 Earth|10\.7 hours|274/u);
});
