import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const PLANET_IDS = Object.freeze([
  "mercury", "venus", "earth", "mars", "jupiter", "saturn", "uranus", "neptune",
]);

test("binds phase charts to explicit primary-source provenance", async () => {
  const context = JSON.parse(await readFile(
    new URL("../source/scientific-charts/planetary-context.json", import.meta.url),
    "utf8",
  ));
  assert.equal(context.schema, "cssearth-planetary-scientific-context@1");
  assert.deepEqual(Object.keys(context.planets), PLANET_IDS);
  assert.equal(context.sources.photometricPhase.arxiv, "1808.01973");
  assert.equal(
    context.sources.photometricPhase.sourcePdfSha256,
    "805e53ab8f921c55e1c5e3dd64bbd567f806cdba56148625afcddfc650b6f9a7",
  );
  for (const planetId of PLANET_IDS) {
    const planet = context.planets[planetId];
    assert.ok(planet.phase.maximumAngleDegrees > 0, `${planetId} phase range`);
    await access(new URL(
      `../../public/scenes/${planetId}/${planetId}-photometric-phase-curve.svg`,
      import.meta.url,
    ));
  }
});
