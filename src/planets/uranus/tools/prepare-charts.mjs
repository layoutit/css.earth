#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  renderReflectanceChart,
  renderTemperaturePressureChart,
} from "../../../platform/scientific-chart-svg.mjs";
import { validateUranusSourceGroup } from "./source-manifest.mjs";
import {
  ensureUranusPreparationDirectories,
  URANUS_PUBLIC_ROOT,
} from "./preparation-paths.mjs";

await validateUranusSourceGroup("charts");
await ensureUranusPreparationDirectories();
const publicRoot = URANUS_PUBLIC_ROOT;
const [response, configuration] = await Promise.all([
  readFile(resolve(import.meta.dirname, "../source/atmosphere/psg-uranus-r240-rif.txt"), "utf8"),
  readFile(resolve(import.meta.dirname, "../source/atmosphere/psg-uranus-20260830.cfg"), "utf8"),
]);
if (!response.includes("# Radiance unit: I/F [apparent albedo]")) {
  throw new Error("Uranus PSG response is not I/F apparent albedo.");
}
const points = response.split("\n")
  .filter((line) => /^\d/u.test(line))
  .map((line) => line.trim().split(/\s+/u).map(Number))
  .map(([wavelength, total]) => ({ wavelength, total }));
if (points.length !== 253 || points.some(({ wavelength, total }) =>
  !Number.isFinite(wavelength) || !Number.isFinite(total))) {
  throw new Error("Uranus PSG response no longer contains 253 samples.");
}
const observedMaximum = Math.max(...points.map(({ total }) => total));
const chartMaximum = Math.ceil(observedMaximum * 20) / 20;
const spectrum = renderReflectanceChart({
  id: "uranus",
  title: "Uranus modeled disk reflectance",
  description: "NASA PSG 253-point Uranus model from 350 to 1000 nanometers.",
  metadata: {
    source: "NASA GSFC Planetary Spectrum Generator",
    sourceUrl: "https://psg.gsfc.nasa.gov/api.php",
    measurement: "I/F apparent albedo",
    resolution: "R 240",
    points: 253,
    modeled: "2026-08-30",
  },
  points,
  maximum: chartMaximum,
  maximumLabel: chartMaximum.toFixed(2),
  midpointLabel: (chartMaximum / 2).toFixed(2),
});
const layers = [...configuration.matchAll(
  /<ATMOSPHERE-LAYER-(\d+)>([^\n]+)/gu,
)].map(([, index, row]) => {
  const [pressure, temperature] = row.split(",").map(Number);
  return { index: Number(index), pressure, temperature };
});
if (layers.length < 40 || layers.some(({ pressure, temperature }) =>
  !Number.isFinite(pressure) || pressure <= 0 || !Number.isFinite(temperature))) {
  throw new Error("Uranus PSG atmosphere layers are incompatible.");
}
const pressureMinimum = Math.min(...layers.map(({ pressure }) => pressure));
const pressureMaximum = Math.max(...layers.map(({ pressure }) => pressure));
const observedTemperatureMinimum = Math.min(...layers.map(({ temperature }) => temperature));
const observedTemperatureMaximum = Math.max(...layers.map(({ temperature }) => temperature));
const temperatureMinimum = Math.floor(observedTemperatureMinimum / 20) * 20;
const temperatureMaximum = Math.ceil(observedTemperatureMaximum / 20) * 20;
const profile = renderTemperaturePressureChart({
  id: "uranus",
  title: "Uranus temperature-pressure profile",
  description: "NASA PSG Uranus atmosphere model with pressure decreasing upward.",
  metadata: {
    source: "NASA GSFC Planetary Spectrum Generator",
    sourceUrl: "https://psg.gsfc.nasa.gov/api.php",
    layers: layers.length,
    modeled: "2026-08-30",
  },
  layers,
  pressureMinimum,
  pressureMaximum,
  temperatureMinimum,
  temperatureMaximum,
  pressureTicks: [1e-8, 1e-5, 1e-2]
    .filter((pressure) => pressure >= pressureMinimum && pressure <= pressureMaximum)
    .map((pressure) => ({ pressure, label: `10${superscript(Math.log10(pressure))}` })),
});
await Promise.all([
  writeFile(resolve(publicRoot, "uranus-atmosphere-spectrum.svg"), spectrum),
  writeFile(resolve(publicRoot, "uranus-temperature-pressure-profile.svg"), profile),
]);

function superscript(value) {
  return String(value).replaceAll("-", "⁻").replaceAll("0", "⁰")
    .replaceAll("1", "¹").replaceAll("2", "²").replaceAll("3", "³")
    .replaceAll("4", "⁴").replaceAll("5", "⁵").replaceAll("6", "⁶")
    .replaceAll("7", "⁷").replaceAll("8", "⁸").replaceAll("9", "⁹");
}
