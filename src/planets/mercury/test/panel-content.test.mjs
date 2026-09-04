import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import editorial from "../../../../data/planets/mercury.json" with { type: "json" };
import { PREPARED_MERCURY_PANEL } from "../site/preparedPanel.mjs";
import sourceEditorial from "../source/editorial/mercury-facts.json" with { type: "json" };
import { extractMercuryEditorialEvidence } from "../tools/editorial-evidence.mjs";

test("publishes one source-bound Mercury panel model", async () => {
  const evidence = extractMercuryEditorialEvidence(sourceEditorial);
  assert.deepEqual(evidence, {
    averageDistanceMillionKm: 58,
    radiusKm: 2_440,
    lightTimeMinutes: 3.2,
    orbitalPeriodEarthDays: 88,
    siderealRotationEarthDays: 59,
    solarDayEarthDays: 176,
    axialTiltDegrees: 2,
    dayMaximumCelsius: 430,
    nightMinimumCelsius: -180,
    moonCount: 0,
    ringCount: 0,
  });
  assert.equal(PREPARED_MERCURY_PANEL.schema, "cssearth-prepared-panel@1");
  assert.equal(PREPARED_MERCURY_PANEL.planetId, "mercury");
  assert.equal(PREPARED_MERCURY_PANEL.sources.editorial.sourceId,
    editorial.sourceId);
  assert.equal(PREPARED_MERCURY_PANEL.sources.editorial.modified,
    editorial.modified);
  assert.deepEqual(PREPARED_MERCURY_PANEL.facts.map(({ value }) => value), [
    "58 million km",
    "4,880 km",
    "88 Earth days",
    "176 Earth days",
  ]);
  assert.deepEqual(PREPARED_MERCURY_PANEL.moreFacts.map(({ value }) => value), [
    "3.2 min",
    "2°",
    "0",
    "0",
    "430°C",
    "−180°C",
  ]);

  const panel = await readFile(
    new URL("../site/MercuryPanel.astro", import.meta.url),
    "utf8",
  );
  assert.match(panel, /PREPARED_MERCURY_PANEL\.introduction/u);
  assert.match(panel, /PREPARED_MERCURY_PANEL\.facts/u);
  assert.match(panel, /PREPARED_MERCURY_PANEL\.moreFacts/u);
  assert.match(panel, /Area-weighted global mean MESSENGER MASCS reflectance/u);
  assert.match(panel, /DLR MASCS/u);
  assert.doesNotMatch(
    panel,
    /id: "temperature-pressure"|mercury-no-atmosphere-profile|label: "PSG"/u,
  );
  assert.match(
    panel,
    /label: "NASA", role: "facts", description: "Facts & interior", href: "https:\/\/science\.nasa\.gov\/mercury\/facts\/"/u,
  );
  assert.match(panel, /label: "ESO", role: "stars"/u);
  assert.doesNotMatch(panel, /58 million km|4,880 km|88 Earth days/u);

  await assert.rejects(
    access(new URL(
      "../../../../public/scenes/mercury/mercury-no-atmosphere-profile.svg",
      import.meta.url,
    )),
  );

  const reflectanceChart = await readFile(
    new URL("../../../../public/scenes/mercury/mercury-surface-albedo.svg",
      import.meta.url),
    "utf8",
  );
  assert.match(reflectanceChart, /class="planet-chart-line" d="M0\.00 [^"]*L320\.00 /u);
  assert.match(reflectanceChart, /<g fill="#fff" fill-opacity="\.05" shape-rendering="crispEdges">\s*<rect x="0" y="8" width="306" height="1"\/>/u);
  assert.match(reflectanceChart, /<linearGradient id="mercury-visible-spectrum"[\s\S]*?<stop offset="1" stop-color="#7d242d"\/>[\s\S]*?fill="url\(#mercury-visible-spectrum\)"/u);
  assert.doesNotMatch(reflectanceChart, /MASCS · global mean|#322046|#3d3b85|#315e91|#3d8c79|#87934d|#a97a45|#4a292d/u);
  assert.doesNotMatch(reflectanceChart, /stroke-dasharray/u);
  assert.doesNotMatch(reflectanceChart, />\.06<|>\.03<|>I\/F</u);

  const preparer = await readFile(
    new URL("../tools/prepare-charts.mjs", import.meta.url),
    "utf8",
  );
  assert.match(preparer, /renderReflectanceChart/u);
  assert.doesNotMatch(
    preparer,
    /planet-reflectance-chart|mercury-visible-spectrum|temperature-pressure|thermalContext|mercury-no-atmosphere-profile/u,
  );
});
