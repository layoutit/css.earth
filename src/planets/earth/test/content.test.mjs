import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PREPARED_EARTH_LENSES } from "../runtime/preparedLenses.mjs";
import { PREPARED_EARTH_PANEL } from "../site/preparedPanel.mjs";

test("publishes evidence-backed Earth shell content", async () => {
  assert.match(PREPARED_EARTH_PANEL.introduction, /third planet from the Sun/u);
  assert.deepEqual(PREPARED_EARTH_PANEL.facts, [
    { label: "Distance", value: "150 million km" },
    { label: "Diameter", value: "12,756 km" },
    { label: "Year", value: "365.25 days" },
    { label: "Day", value: "23.9 hours" },
  ]);
  assert.deepEqual(PREPARED_EARTH_LENSES.controls.map(({ id }) => id), [
    "normal", "topography", "night-lights", "cross-section",
  ]);
  const snapshot = JSON.parse(await readFile(new URL("../../../../data/planets/earth.json", import.meta.url), "utf8"));
  assert.equal(snapshot.sourceId, 48583);
  assert.equal(snapshot.sections.length, 12);
  assert.equal(snapshot.credit, "NASA Science");
  const allParagraphs = snapshot.sections.flatMap(({ paragraphs }) => paragraphs)
    .join(" ");
  for (const fact of PREPARED_EARTH_PANEL.facts) {
    const evidence = fact.value
      .replace(" million km", " million kilometers")
      .replace(" km", " kilometers");
    assert.ok(allParagraphs.includes(evidence),
      `NASA editorial does not contain prepared fact: ${evidence}`);
  }
  const moon = JSON.parse(await readFile(
    new URL("../source/moon/earth-moon.json", import.meta.url),
    "utf8",
  ));
  assert.equal(PREPARED_EARTH_PANEL.moreFacts.find(
    ({ label }) => label === "Moon distance").value,
  `${moon.meanOrbitRadiusKm.toLocaleString("en-US")} km`);
  const license = await readFile(
    new URL("../source/presentation/LICENSE.INTER-OFL", import.meta.url),
    "utf8",
  );
  assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/u);
  assert.match(license, /PERMISSION AND CONDITIONS/u);
  assert.match(license, /DISCLAIMER/u);
});

test("ships no prohibited Earth runtime rendering path", async () => {
  const [client, styles] = await Promise.all([
    readFile(new URL("../runtime/client.mjs", import.meta.url), "utf8"),
    readFile(new URL("../runtime/styles.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(client, /canvas|WebGL|XMLHttpRequest|https?:\/\//iu);
  assert.doesNotMatch(client, /mounted\.scene\.style\.transform/u);
  assert.doesNotMatch(styles, /clip-path|mask(?:-image)?|filter:|linear-gradient|radial-gradient|mix-blend-mode/iu);
  assert.doesNotMatch(client, /innerHTML|insertAdjacentHTML/iu);
  assert.doesNotMatch(styles, /url\([^)]*\.svg/iu);
  assert.doesNotMatch(client, /earth-moon|preparedMoon|OrbitGuide/u);
});
