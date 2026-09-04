import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  renderReflectanceChart,
  renderTemperaturePressureChart,
} from "./scientific-chart-svg.mjs";

test("renders deterministic representative Mars and Saturn reflectance data", () => {
  for (const [id, maximum] of [["mars", 0.16], ["saturn", 0.25]]) {
    const input = {
      id,
      title: `${id} reflectance`,
      description: "Prepared spectrum",
      metadata: { source: "NASA PSG", id },
      points: [
        { wavelength: 0.35, total: maximum / 2 },
        { wavelength: 0.75, total: maximum },
        { wavelength: 1, total: maximum / 4 },
      ],
      maximum,
      maximumLabel: "axis-maximum",
      midpointLabel: "axis-midpoint",
    };
    const first = renderReflectanceChart(input);
    assert.equal(renderReflectanceChart(input), first);
    assert.match(first, /viewBox="0 0 306 141"/u);
    assert.match(first, /font-family="ui-sans-serif,[^"]+" font-size="13\.572"/u);
    assert.match(first, new RegExp(`<title id="${id}-reflectance-title">`));
    assert.match(first, /<g fill="#fff" fill-opacity="\.05" shape-rendering="crispEdges">[\s\S]*?<rect x="0" y="8" width="306" height="1"\/>[\s\S]*?<rect x="0" y="55" width="306" height="1"\/>/u);
    assert.doesNotMatch(first, /stroke-dasharray/u);
    assert.match(first, /class="planet-chart-line" d="M0\.00 57\.00 L196\.92 8\.00 L320\.00 81\.50"/u);
    assert.match(first, />wavelength \(nm\)<[\s\S]*?>750<[\s\S]*?>1000</u);
    assert.doesNotMatch(first, />350<|>500<|wavelength · nm/u);
    assert.doesNotMatch(first, /axis-maximum|axis-midpoint|>I\/F</u);
  }
});

test("renders deterministic representative atmosphere profiles", () => {
  const input = {
    id: "fixture",
    title: "Profile",
    description: "Prepared profile",
    metadata: { source: "NASA PSG" },
    layers: [
      { pressure: 1, temperature: 200 },
      { pressure: 0.1, temperature: 150 },
      { pressure: 0.01, temperature: 100 },
    ],
    pressureMinimum: 0.01,
    pressureMaximum: 1,
    temperatureMinimum: 100,
    temperatureMaximum: 200,
    pressureTicks: [{ pressure: 0.1, label: "axis-pressure" }],
  };
  const first = renderTemperaturePressureChart(input);
  assert.equal(renderTemperaturePressureChart(input), first);
  assert.match(first, /viewBox="0 0 306 141"/u);
  assert.match(first, /font-family="ui-sans-serif,[^"]+" font-size="13\.572"/u);
  assert.match(first, /<g fill="#fff" fill-opacity="\.05" shape-rendering="crispEdges"><rect x="0" y="62" width="306" height="1"\/><\/g>/u);
  assert.doesNotMatch(first, /stroke-dasharray/u);
  assert.match(first, /class="planet-chart-line" d="M320\.00 122\.00 L160\.00 65\.00 L0\.00 8\.00"/u);
  assert.match(first, />temperature \(K\)<[\s\S]*?>150<[\s\S]*?>200</u);
  assert.doesNotMatch(first, />100<|temperature · K/u);
  assert.doesNotMatch(first, /axis-pressure|>Bar</u);
});

test("escapes every interpolated XML text value", () => {
  const svg = renderReflectanceChart({
    id: "fixture",
    title: "A < B & C",
    description: "Use > safely",
    metadata: { source: "A&B<source>" },
    points: [{ wavelength: 0.35, total: 0 }, { wavelength: 1, total: 1 }],
    maximum: 1,
    maximumLabel: "<1 & safe",
    midpointLabel: ">0",
  });
  assert.match(svg, /A &lt; B &amp; C/u);
  assert.match(svg, /Use &gt; safely/u);
  assert.match(svg, /A&amp;B&lt;source&gt;/u);
  assert.doesNotMatch(svg, /<title[^>]*>[^<]*A < B/u);
});

test("rejects malformed chart shapes and unsafe ids", () => {
  assert.throws(() => renderReflectanceChart({
    id: "../mars",
    title: "x",
    description: "x",
    metadata: {},
    points: [{ wavelength: 0.35, total: 1 }, { wavelength: 1, total: 1 }],
    maximum: 1,
    maximumLabel: "1",
    midpointLabel: ".5",
  }), /identity is incompatible/);
  assert.throws(() => renderTemperaturePressureChart({
    id: "fixture",
    title: "x",
    description: "x",
    metadata: {},
    layers: [{ pressure: 0, temperature: 100 }],
    pressureMinimum: 0,
    pressureMaximum: 1,
    temperatureMinimum: 0,
    temperatureMaximum: 1,
    pressureTicks: [],
  }), /data is incompatible/);
});

test("contains no object id or source record", async () => {
  const source = await readFile(new URL("./scientific-chart-svg.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /mars|saturn|107740|107933/iu);
});
