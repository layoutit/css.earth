import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parseHTML } from "linkedom";
import { requireRecord } from "../../tools/sources/source-values.mts";
import { validateScientificChartsContext } from "../../tools/prepare/prepare-scientific-charts.mts";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();

const PLANET_IDS = Object.freeze([
  "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune",
]);

test("binds phase charts to explicit primary-source provenance", async () => {
  const context = validateScientificChartsContext(JSON.parse(await readFile(
    new URL("../source/scientific-charts/planetary-context.json", import.meta.url),
    "utf8",
  )));
  assert.equal(context.schema, "cssearth-planetary-scientific-context@1");
  assert.deepEqual(Object.keys(context.planets), PLANET_IDS);
  assert.equal(context.sources.photometricPhase.arxiv, "1808.01973");
  for (const objectId of PLANET_IDS) {
    const planet = context.planets[objectId];
    assert.ok(planet.phase.maximumAngleDegrees > 0, `${objectId} phase range`);
    const svg = await readFile(new URL(
      `../../public/scenes/${objectId}/${objectId}-photometric-phase-curve.svg`,
      import.meta.url,
    ), "utf8");
    const metadata = parseHTML(svg).document.querySelector("metadata");
    assert.ok(metadata, `${objectId} chart metadata`);
    const provenance = requireRecord(JSON.parse(metadata.textContent), `${objectId} chart metadata`);
    assert.equal(provenance.objectId, objectId);
    const source = requireRecord(provenance.source, `${objectId} chart source`);
    for (const key of ["arxiv", "url", "title"]) {
      assert.equal(source[key], context.sources.photometricPhase[key], `${objectId} chart ${key}`);
    }
  }
});
