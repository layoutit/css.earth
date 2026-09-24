import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseHTML } from "linkedom";
import { requireRecord } from "@cssearth/core";
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();

import {
  evaluatePhaseMagnitude,
  prepareScientificCharts,
  samplePhaseCurve,
  validateScientificChartsContext,
} from "./prepare-scientific-charts.mts";

const context = validateScientificChartsContext(JSON.parse(await readFile(new URL(
  "../../site/source/scientific-charts/planetary-context.json",
  import.meta.url,
), "utf8")));

test("binds phase sources to all eight planets", () => {
  assert.deepEqual(Object.keys(context.planets), [
    "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune",
  ]);
  for (const planet of Object.values(context.planets)) {
    const curve = samplePhaseCurve(planet.phase);
    assert.equal(curve.length, 181);
    assert.equal(curve[0].dimmingMagnitude, 0);
    assert.ok(Number.isFinite(evaluatePhaseMagnitude(
      planet.phase,
      planet.phase.maximumAngleDegrees,
    )));
  }
});

test("prepares phase charts without runtime derivation", async () => {
  const outputRoot = await mkdtemp(join(tmpdir(), "cssearth-scientific-charts-"));
  try {
    const outputs = await prepareScientificCharts({
      planetIds: ["mercury", "saturn"],
      outputRoot,
    });
    assert.equal(outputs.length, 2);
    for (const [index, objectId] of ["mercury", "saturn"].entries()) {
      const svg = await readFile(outputs[index], "utf8");
      assert.match(svg, /object-photometric-phase-chart/u);
      const metadata = parseHTML(svg).document.querySelector("metadata");
      assert.ok(metadata, `${objectId} chart metadata`);
      const provenance = requireRecord(JSON.parse(metadata.textContent), `${objectId} chart metadata`);
      assert.equal(provenance.objectId, objectId);
      assert.deepEqual(provenance.source, context.sources.photometricPhase);
    }
  } finally {
    await rm(outputRoot, { recursive: true, force: true });
  }
});
