#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  renderReflectanceChart,
  renderTemperaturePressureChart,
} from "../../../platform/scientific-chart-svg.mjs";
import { validateEarthSourceGroup } from "./source-manifest.mjs";
import { ensureEarthPreparationDirectories, EARTH_PUBLIC_ROOT } from "./preparation-paths.mjs";

await validateEarthSourceGroup("spectrum");
await ensureEarthPreparationDirectories();
const [response, configuration] = await Promise.all([
  readFile(resolve(import.meta.dirname, "../source/atmosphere/psg-earth-r120-rif.txt"), "utf8"),
  readFile(resolve(import.meta.dirname, "../source/atmosphere/psg-earth-20260830.cfg"), "utf8"),
]);
if (!response.includes("# Radiance unit: I/F [apparent albedo]")) throw new Error("Earth PSG response is not I/F.");
const points = response.split("\n")
  .filter((line) => /^\d/u.test(line))
  .map((line) => line.trim().split(/\s+/u).map(Number))
  .map(([wavelength, total]) => ({ wavelength, total }));
if (points.length !== 127 || points.some(({ wavelength, total }) => !Number.isFinite(wavelength) || !Number.isFinite(total))) {
  throw new Error(`Earth PSG response contains ${points.length} samples instead of 127.`);
}
const layers = [...configuration.matchAll(/<ATMOSPHERE-LAYER-(\d+)>([^\n]+)/gu)].map(([, index, row]) => {
  const [pressure, temperature] = row.split(",").map(Number);
  return { index: Number(index), pressure, temperature };
});
if (layers.length !== 70 || layers.some(({ index, pressure, temperature }, layerIndex) => index !== layerIndex + 1 || !Number.isFinite(pressure) || pressure <= 0 || !Number.isFinite(temperature))) {
  throw new Error("Earth PSG atmosphere layers drifted.");
}
const pressureMaximum = layers[0].pressure;
const pressureMinimum = layers.at(-1).pressure;
const spectrum = renderReflectanceChart({
  id: "earth",
  title: "Earth modeled disk reflectance",
  description: "Complete 127-point NASA PSG Earth spectrum from 350 to 1000 nanometers at resolving power 120.",
  metadata: {
    source: "NASA GSFC Planetary Spectrum Generator",
    sourceUrl: "https://psg.gsfc.nasa.gov/api.php",
    measurement: "I/F apparent albedo",
    resolution: "R 120",
    points: points.length,
    rangeMicrometers: [0.35, 1],
    modeled: "2026-08-30",
  },
  points,
  maximum: 0.5,
  maximumLabel: ".50",
  midpointLabel: ".25",
});
const temperatures = layers.map(({ temperature }) => temperature);
const profile = renderTemperaturePressureChart({
  id: "earth",
  title: "Earth temperature-pressure profile",
  description: "NASA PSG standard Earth atmosphere profile. Pressure decreases upward on a logarithmic scale.",
  metadata: {
    source: "NASA GSFC Planetary Spectrum Generator",
    sourceUrl: "https://psg.gsfc.nasa.gov/api.php",
    atmosphere: "PSG standard Earth atmosphere",
    layers: layers.length,
    pressureRangeBar: [pressureMinimum, pressureMaximum],
    temperatureRangeKelvin: [Math.min(...temperatures), Math.max(...temperatures)],
    modeled: "2026-08-30",
  },
  layers,
  pressureMinimum,
  pressureMaximum,
  temperatureMinimum: 180,
  temperatureMaximum: 310,
  pressureTicks: Object.freeze([
    { pressure: 1e-4, label: "10⁻⁴" },
    { pressure: 1e-2, label: "10⁻²" },
    { pressure: 1e-1, label: "10⁻¹" },
  ]),
});
await Promise.all([
  writeFile(resolve(EARTH_PUBLIC_ROOT, "earth-atmosphere-spectrum.svg"), spectrum),
  writeFile(resolve(EARTH_PUBLIC_ROOT, "earth-temperature-pressure-profile.svg"), profile),
]);
