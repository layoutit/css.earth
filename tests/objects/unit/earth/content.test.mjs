import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PREPARED_EARTH_LENSES } from "../../unit/earth/prepared-fixture.mjs";
import { PREPARED_EARTH_PANEL } from "../../unit/earth/prepared-fixture.mjs";

test("publishes evidence-backed Earth shell content", async () => {
  assert.match(PREPARED_EARTH_PANEL.introduction, /third planet from the Sun/u);
  const facts = new Map([...PREPARED_EARTH_PANEL.facts, ...PREPARED_EARTH_PANEL.moreFacts].map(fact => [fact.id, fact]));
  const review = JSON.parse(await readFile(new URL("../../../../src/planets/earth/source/editorial/factsheet-review.json", import.meta.url)));
  assert.equal(facts.get("distance-from-sun").value, review.references[0].values["distance-from-sun"]);
  assert.equal(facts.get("radius").value, "6,371 km");
  for (const id of ["radius", "mass", "density", "gravity", "rotation-period", "orbital-period"]) {
    assert.ok(review.references.some(reference => reference.url === facts.get(id).source.url));
    assert.equal(facts.get(id).source.checked, review.checked);
  }
  assert.deepEqual(PREPARED_EARTH_LENSES.controls.map(({ id }) => id), [
    "normal", "topography", "night-lights", "cross-section",
  ]);
  const snapshot = JSON.parse(await readFile(new URL("../../../../data/planets/earth.json", import.meta.url), "utf8"));
  assert.equal(snapshot.sourceId, 48583);
  assert.equal(snapshot.sections.length, 12);
  assert.equal(snapshot.credit, "NASA Science");
  assert.equal(facts.get("ocean-coverage").value, "71%");
  assert.equal(facts.get("atmosphere-composition").value, "78% N₂, 21% O₂");
  const license = await readFile(
    new URL("../../../../src/planets/earth/source/presentation/LICENSE.INTER-OFL", import.meta.url),
    "utf8",
  );
  assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/u);
  assert.match(license, /PERMISSION AND CONDITIONS/u);
  assert.match(license, /DISCLAIMER/u);
});

test("ships no prohibited Earth runtime rendering path", async () => {
  const [client, styles] = await Promise.all([
    readFile(new URL("../../../../src/renderers/css/runtime/object-runtime.ts", import.meta.url), "utf8"),
    readFile(new URL("../../../../src/renderers/css/styles/earth-surfaces.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(client, /canvas|WebGL|XMLHttpRequest|https?:\/\//iu);
  assert.doesNotMatch(client, /mounted\.scene\.style\.transform/u);
  assert.doesNotMatch(styles, /clip-path|mask(?:-image)?|filter:|linear-gradient|radial-gradient|mix-blend-mode/iu);
  assert.doesNotMatch(client, /innerHTML|insertAdjacentHTML/iu);
  assert.doesNotMatch(styles, /url\([^)]*\.svg/iu);
  assert.doesNotMatch(client, /earth-moon|preparedMoon|OrbitGuide/u);
});
