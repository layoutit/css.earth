#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

import {
  renderReflectanceChart,
  renderTemperaturePressureChart,
} from "../../../platform/scientific-chart-svg.mjs";
import { validateVenusSourceGroup } from "./source-manifest.mjs";

await Promise.all([
  validateVenusSourceGroup("spectrum"),
  validateVenusSourceGroup("temperature-pressure-profile"),
]);

const responsePath = new URL(
  "../source/atmosphere/psg-venus-r240-rif.txt",
  import.meta.url,
);
const configurationPath = new URL(
  "../source/atmosphere/psg-venus-20260830.cfg",
  import.meta.url,
);
const [response, configuration] = await Promise.all([
  readFile(responsePath, "utf8"),
  readFile(configurationPath, "utf8"),
]);
if (!response.includes("# Radiance unit: I/F [apparent albedo]")) {
  throw new Error("Venus PSG response is not I/F apparent albedo.");
}
const points = response.split("\n")
  .filter((line) => /^\d/u.test(line))
  .map((line) => line.trim().split(/\s+/u).map(Number))
  .map(([wavelength, total]) => ({ wavelength, total }));
if (points.length !== 253 || points.some(({ wavelength, total }) =>
  !Number.isFinite(wavelength) || !Number.isFinite(total))) {
  throw new Error("Venus PSG response no longer contains 253 numeric samples.");
}
const layers = [...configuration.matchAll(
  /<ATMOSPHERE-LAYER-(\d+)>([^\n]+)/gu,
)].map(([, index, row]) => {
  const [pressure, temperature] = row.split(",").map(Number);
  return { index: Number(index), pressure, temperature };
});
if (layers.length !== 100 || layers.some(({ index, pressure, temperature }, layerIndex) =>
  index !== layerIndex + 1 || !Number.isFinite(pressure) || pressure <= 0 ||
  !Number.isFinite(temperature))) {
  throw new Error("Venus PSG configuration no longer contains 100 ordered layers.");
}

const reflectance = renderReflectanceChart({
  id: "venus",
  title: "Venus modeled disk reflectance",
  description: "Full 253-point NASA PSG Venus spectrum from 350 to 1000 nanometers.",
  metadata: {
    source: "NASA GSFC Planetary Spectrum Generator",
    sourceUrl: "https://psg.gsfc.nasa.gov/api.php",
    measurement: "I/F apparent albedo",
    resolution: "R 240",
    points: 253,
    rangeMicrometers: [0.35, 1.0],
    modeled: "2026-08-30",
  },
  points,
  maximum: 0.15,
  maximumLabel: ".15",
  midpointLabel: ".075",
});
const pressureMinimum = layers.at(-1).pressure;
const pressureMaximum = layers[0].pressure;
const profile = renderTemperaturePressureChart({
  id: "venus",
  title: "Venus temperature-pressure profile",
  description: "NASA PSG Venus atmosphere model from 92.1 bar to 10 to the minus 15 bar.",
  metadata: {
    source: "NASA GSFC Planetary Spectrum Generator",
    sourceUrl: "https://psg.gsfc.nasa.gov/api.php",
    atmosphere: "VIRA-45, Vandaele et al. 2020, Bierson et al. 2019, Ehrenreich et al. 2012",
    layers: 100,
    pressureRangeBar: [pressureMinimum, pressureMaximum],
    temperatureRangeKelvin: [169.6, 735.3],
    modeled: "2026-08-30",
  },
  layers,
  pressureMinimum,
  pressureMaximum,
  temperatureMinimum: 150,
  temperatureMaximum: 750,
  pressureTicks: [
    { pressure: 1e-12, label: "10⁻¹²" },
    { pressure: 1e-8, label: "10⁻⁸" },
    { pressure: 1e-4, label: "10⁻⁴" },
    { pressure: 1, label: "1" },
  ],
});
const outputs = [
  [new URL("../../../../public/scenes/venus/venus-atmosphere-spectrum.svg", import.meta.url), reflectance],
  [new URL("../../../../public/scenes/venus/venus-temperature-pressure-profile.svg", import.meta.url), profile],
];
await Promise.all(outputs.map(([path, contents]) => writeFile(path, contents)));
console.log(JSON.stringify({
  points: points.length,
  layers: layers.length,
  responseSha256: createHash("sha256").update(response).digest("hex"),
  chartSha256: outputs.map(([, contents]) =>
    createHash("sha256").update(contents).digest("hex")),
}, null, 2));
