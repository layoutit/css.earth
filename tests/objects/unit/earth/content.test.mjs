import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PREPARED_EARTH_LENSES } from "../../unit/earth/prepared-fixture.mjs";
import { PREPARED_EARTH_PANEL } from "../../unit/earth/prepared-fixture.mjs";

test("publishes evidence-backed Earth shell content", async () => {
  assert.match(PREPARED_EARTH_PANEL.introduction, /third planet from the Sun/u);
  const authored = JSON.parse(await readFile(new URL(
    "../../../../src/planets/earth/source/content/object.json", import.meta.url), "utf8"));
  assert.deepEqual(PREPARED_EARTH_PANEL.facts, authored.panel.facts);
  assert.deepEqual(PREPARED_EARTH_LENSES.controls.map(({ id }) => id), [
    "normal", "topography", "night-lights", "cross-section",
  ]);
  const snapshot = JSON.parse(await readFile(new URL("../../../../data/planets/earth.json", import.meta.url), "utf8"));
  assert.equal(snapshot.sourceId, 48583);
  assert.equal(snapshot.sections.length, 12);
  assert.equal(snapshot.credit, "NASA Science");
  // Scientific values now cite the pinned factsheet review, separately from
  // the older NASA editorial introduction.
  for (const fact of PREPARED_EARTH_PANEL.facts.slice(0, 4)) {
    assert.equal(fact.source.path, "source/editorial/factsheet-review.json");
    assert.equal(new URL(fact.source.url).hostname, "ssd.jpl.nasa.gov");
    assert.match(fact.source.checked, /^\d{4}-\d{2}-\d{2}$/u);
  }
  assert.deepEqual(PREPARED_EARTH_PANEL.moreFacts, authored.panel.moreFacts);
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
