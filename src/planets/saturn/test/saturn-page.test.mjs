import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { PREPARED_SATURN_PANEL } from "../site/preparedPanel.mjs";
import { PREPARED_SATURN_TITLE } from "../site/preparedTitle.mjs";

test("publishes the prepared Saturn shell content", () => {
  assert.equal(PREPARED_SATURN_TITLE.label, "Saturn");
  assert.match(PREPARED_SATURN_PANEL.introduction, /sixth planet from the Sun/u);
  assert.deepEqual(PREPARED_SATURN_PANEL.facts, [
    { label: "Distance", value: "1.4 billion km" },
    { label: "Diameter", value: "120,500 km" },
    { label: "Year", value: "29.4 Earth yrs" },
    { label: "Day", value: "10.7 hours" },
  ]);
  assert.equal(PREPARED_SATURN_PANEL.moonCountPolicy.editorial, 274);
  assert.equal(PREPARED_SATURN_PANEL.moonCountPolicy.rendered, 293);
});

test("publishes source-bound Saturn atmosphere chart artifacts", async () => {
  const [spectrum, profile] = await Promise.all([
    readFile(new URL(
      "../../../../public/scenes/saturn/saturn-atmosphere-spectrum.svg",
      import.meta.url,
    ), "utf8"),
    readFile(new URL(
      "../../../../public/scenes/saturn/saturn-temperature-pressure-profile.svg",
      import.meta.url,
    ), "utf8"),
  ]);
  const spectrumMetadata = metadata(spectrum);
  const profileMetadata = metadata(profile);

  assert.deepEqual(spectrumMetadata, {
    source: "NASA GSFC Planetary Spectrum Generator",
    sourceUrl: "https://psg.gsfc.nasa.gov/api.php",
    measurement: "I/F apparent albedo",
    resolution: "R 240",
    points: 253,
    rangeMicrometers: [0.35, 1],
    modeled: "2026-08-29",
  });
  assert.equal(profileMetadata.source, "NASA GSFC Planetary Spectrum Generator");
  assert.equal(profileMetadata.layers, 60);
  assert.deepEqual(profileMetadata.pressureRangeBar, [2e-9, 10]);
  assert.doesNotMatch(spectrum, /<rect[^>]+fill="#000"/u);
  assert.doesNotMatch(profile, /<rect[^>]+fill="#000"/u);
});

test("keeps the prepared NASA Science Saturn snapshot local and identified", async () => {
  const snapshot = JSON.parse(await readFile(
    new URL("../../../../data/planets/saturn.json", import.meta.url),
    "utf8",
  ));

  assert.equal(snapshot.schemaVersion, 1);
  assert.equal(snapshot.id, "saturn");
  assert.equal(snapshot.planet, "Saturn");
  assert.equal(snapshot.title, "Saturn: Facts");
  assert.equal(snapshot.sourceId, 107933);
  assert.equal(snapshot.sourceUrl, "https://science.nasa.gov/saturn/facts/");
  assert.equal(snapshot.credit, "NASA Science");
  assert.match(snapshot.modified, /^\d{4}-\d{2}-\d{2}T/u);
  assert.match(snapshot.retrievedAt, /^\d{4}-\d{2}-\d{2}$/u);
  assert.equal(snapshot.sections.length, 12);
  const introduction = snapshot.sections.find(
    ({ heading }) => heading === "Introduction",
  );
  assert.ok(introduction.paragraphs[0].length > 150);
  assert.doesNotMatch(introduction.paragraphs[0], /<[^>]+>|&[a-z#0-9]+;/iu);
});

function metadata(svg) {
  const match = svg.match(/<metadata>([^<]+)<\/metadata>/u);
  assert.ok(match, "Prepared chart metadata is missing.");
  return JSON.parse(match[1]);
}
