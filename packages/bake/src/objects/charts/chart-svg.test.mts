import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();

import {
  renderReflectanceChart,
  renderTemperaturePressureChart,
  renderPhotometricPhaseChart,
  renderLightCurveChart,
} from '@cssearth/bake/objects/charts';

test("renders deterministic representative Mars and Saturn reflectance data", () => {
  for (const [id, maximum] of [["mars", 0.16], ["saturn", 0.25]] as const) {
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
    assert.match(first, /viewBox="0 0 306 289"/u);
    assert.match(first, new RegExp(`<title id="${id}-title">`));
    assert.match(first, /Reflectance \(I\/F\)/u);
    for (const value of [0, maximum / 2, maximum, 350, 500, 750, 1000]) assert.ok(first.includes(`>${value}</text>`));
    assert.doesNotMatch(first, /stroke-dasharray/u);
    assert.match(first, /class="object-chart-line" d="M42\.000 116\.000 L197\.077 29\.000 L294\.000 159\.500"/u);
    assert.match(first, />Wavelength \(nm\)</u);
    assert.match(first, />Reflectance<.*>Shading · approx\.</u);
    assert.doesNotMatch(first, /linearGradient|clipPath|<mask|<filter/u);
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
  assert.match(first, /viewBox="0 0 306 275"/u);
  assert.match(first, /d="M42 116\.000H294"/u);
  assert.doesNotMatch(first, /stroke-dasharray/u);
  assert.match(first, /class="object-chart-line" d="M294\.000 203\.000 L168\.000 116\.000 L42\.000 29\.000"/u);
  for (const label of ['Pressure (bar)', 'axis-pressure', 'Temperature (K)', '100', '150', '200']) assert.ok(first.includes(`>${label}</text>`));
});

test("escapes every interpolated XML text value", () => {
  const input = {
    id: "fixture",
    title: "A < B & C",
    description: "Use > safely",
    metadata: { source: "A&B<source>" },
    points: [{ wavelength: 0.35, total: 0 }, { wavelength: 1, total: 1 }],
    maximum: 1,
    maximumLabel: "<1 & safe",
    midpointLabel: ">0",
  };
  const svg = renderReflectanceChart(input);
  assert.match(svg, /A &lt; B &amp; C/u);
  assert.match(svg, /Use &gt; safely/u);
  assert.match(svg, /A&amp;B&lt;source&gt;/u);
  assert.doesNotMatch(svg, /<title[^>]*>[^<]*A < B/u);
});

test("rejects malformed chart shapes and unsafe ids", () => {
  assert.throws(() => Reflect.apply(renderReflectanceChart, undefined, [{
    id: "../mars",
    title: "x",
    description: "x",
    metadata: {},
    points: [{ wavelength: 0.35, total: 1 }, { wavelength: 1, total: 1 }],
    maximum: 1,
    maximumLabel: "1",
    midpointLabel: ".5",
  }]), /identity is incompatible/);
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

test('phase dimming increases downward and flux increases upward with explicit units', () => {
  const identity = { id: 'fixture', title: 'Fixture', description: 'Prepared data', metadata: {} };
  const phase = renderPhotometricPhaseChart({ ...identity, points: [
    { phaseAngle: 0, dimmingMagnitude: 0 }, { phaseAngle: 45, dimmingMagnitude: 1 }, { phaseAngle: 90, dimmingMagnitude: 2 },
  ] });
  assert.match(phase, /M42\.000 29\.000 L168\.000 116\.000 L294\.000 203\.000/);
  for (const label of ['V-band dimming (mag)', 'Phase angle (°)', 'Fainter ↓', '0', '1', '2', '45', '90']) assert.ok(phase.includes(`>${label}</text>`));
  const flux = renderLightCurveChart({ ...identity, axisLabel: 'Time (hours)', points: [
    { hours: 0, flux: -1000 }, { hours: 1, flux: 0 }, { hours: 2, flux: 1000 },
  ], events: [{ hours: 1, label: 'Transit' }, { hours: 3, label: 'Outside' }] });
  assert.match(flux, /M42\.000 203\.000 L168\.000 116\.000 L294\.000 29\.000/);
  assert.match(flux, /d="M168\.000 29V203"/);
  assert.doesNotMatch(flux, /Outside/);
  for (const label of ['Relative flux (ppm)', 'Time (hours)', '-1000', '0', '1000', 'Transit']) assert.ok(flux.includes(`>${label}</text>`));
});
