import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import editorial from "../../../../data/planets/neptune.json" with { type: "json" };
import { PREPARED_NEPTUNE_PANEL } from "../site/preparedPanel.mjs";

test("publishes one source-bound Neptune panel model", async () => {
  assert.equal(PREPARED_NEPTUNE_PANEL.schema, "cssearth-prepared-panel@1");
  assert.equal(PREPARED_NEPTUNE_PANEL.planetId, "neptune");
  assert.equal(PREPARED_NEPTUNE_PANEL.sources.editorial.sourceId,
    editorial.sourceId);
  assert.equal(PREPARED_NEPTUNE_PANEL.sources.editorial.modified,
    editorial.modified);
  assert.deepEqual(PREPARED_NEPTUNE_PANEL.moonCountPolicy, {
    editorial: 16,
    rendered: 16,
    rule: "NASA Science and the committed JPL discovery table both identify 16 moons.",
  });
  const panel = await readFile(
    new URL("../site/NeptunePanel.astro", import.meta.url),
    "utf8",
  );
  assert.match(panel, /PREPARED_NEPTUNE_PANEL\.introduction/u);
  assert.match(panel, /PREPARED_NEPTUNE_PANEL\.facts/u);
  assert.match(panel, /PREPARED_NEPTUNE_PANEL\.moreFacts/u);
  assert.doesNotMatch(panel, /4\.5 billion|49,528|165 Earth|2,000 km/u);
});

test("publishes source-bound Neptune atmosphere chart artifacts", async () => {
  const [spectrum, profile] = await Promise.all([
    readFile(new URL(
      "../../../../public/scenes/neptune/neptune-atmosphere-spectrum.svg",
      import.meta.url,
    ), "utf8"),
    readFile(new URL(
      "../../../../public/scenes/neptune/neptune-temperature-pressure-profile.svg",
      import.meta.url,
    ), "utf8"),
  ]);
  assert.deepEqual(metadata(spectrum), {
    source: "NASA GSFC Planetary Spectrum Generator",
    sourceUrl: "https://psg.gsfc.nasa.gov/api.php",
    measurement: "I/F apparent albedo",
    resolution: "R 240",
    points: 253,
    rangeMicrometers: [0.35, 1],
    modeled: "2026-08-30",
  });
  const profileMetadata = metadata(profile);
  assert.equal(profileMetadata.source,
    "NASA GSFC Planetary Spectrum Generator");
  assert.equal(profileMetadata.layers, 50);
  assert.deepEqual(profileMetadata.pressureRangeBar, [1e-7, 100]);
});

test("keeps the prepared NASA Science Neptune snapshot local and identified",
  () => {
    assert.equal(editorial.schemaVersion, 1);
    assert.equal(editorial.id, "neptune");
    assert.equal(editorial.planet, "Neptune");
    assert.equal(editorial.title, "Neptune: Facts");
    assert.equal(editorial.sourceId, 107874);
    assert.equal(editorial.sourceUrl,
      "https://science.nasa.gov/neptune/neptune-facts/");
    assert.equal(editorial.credit, "NASA Science");
    assert.equal(editorial.sections.length, 11);
    assert.match(editorial.modified, /^\d{4}-\d{2}-\d{2}T/u);
    assert.match(editorial.retrievedAt, /^\d{4}-\d{2}-\d{2}$/u);
  });

function metadata(svg) {
  const match = svg.match(/<metadata>([^<]+)<\/metadata>/u);
  assert.ok(match, "Prepared chart metadata is missing.");
  return JSON.parse(match[1]);
}
