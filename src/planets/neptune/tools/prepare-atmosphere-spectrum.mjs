#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";

import { renderReflectanceChart, renderTemperaturePressureChart } from "../../../platform/scientific-chart-svg.mjs";
import { validateNeptuneSourceGroup } from "./source-manifest.mjs";

await Promise.all([validateNeptuneSourceGroup("spectrum"), validateNeptuneSourceGroup("temperature-pressure-profile")]);
const [response, configuration] = await Promise.all([
  readFile(new URL("../source/atmosphere/psg-neptune-r240-rif.txt", import.meta.url), "utf8"),
  readFile(new URL("../source/atmosphere/psg-neptune-20260830.cfg", import.meta.url), "utf8"),
]);
if (!response.includes("# Radiance unit: I/F [apparent albedo]")) throw new Error("Neptune PSG response is not I/F apparent albedo.");
const points = response.split("\n").filter((line) => /^\d/u.test(line)).map((line) => line.trim().split(/\s+/u).map(Number)).map(([wavelength, total]) => ({ wavelength, total }));
if (points.length !== 253 || points.some(({ wavelength, total }) => !Number.isFinite(wavelength) || !Number.isFinite(total))) throw new Error("Neptune PSG response no longer contains 253 numeric samples.");
const spectrum = renderReflectanceChart({
  id: "neptune", title: "Neptune modeled disk reflectance",
  description: "NASA PSG I/F spectrum from 350 to 1000 nanometers, including strong methane absorption toward the near infrared.",
  metadata: { source: "NASA GSFC Planetary Spectrum Generator", sourceUrl: "https://psg.gsfc.nasa.gov/api.php", measurement: "I/F apparent albedo", resolution: "R 240", points: 253, rangeMicrometers: [0.35, 1], modeled: "2026-08-30" },
  points, maximum: 0.65, maximumLabel: ".65", midpointLabel: ".325",
});
const layers = [...configuration.matchAll(/<ATMOSPHERE-LAYER-(\d+)>([^\n]+)/gu)].map(([, index, row]) => { const [pressure, temperature] = row.split(",").map(Number); return { index: Number(index), pressure, temperature }; });
if (layers.length !== 50 || layers.some(({ index, pressure, temperature }, layerIndex) => index !== layerIndex + 1 || !Number.isFinite(pressure) || pressure <= 0 || !Number.isFinite(temperature))) throw new Error("Neptune PSG configuration no longer contains 50 ordered pressure-temperature layers.");
const profile = renderTemperaturePressureChart({
  id: "neptune", title: "Neptune temperature-pressure profile",
  description: "NASA PSG vertical atmosphere model from 100 bar to 0.1 microbar. Pressure decreases upward on a logarithmic scale.",
  metadata: { source: "NASA GSFC Planetary Spectrum Generator", sourceUrl: "https://psg.gsfc.nasa.gov/api.php", atmosphere: "NASA PSG Neptune model", layers: 50, pressureRangeBar: [1e-7, 100], temperatureRangeKelvin: [49.98, 220], modeled: "2026-08-30" },
  layers, pressureMinimum: layers.at(-1).pressure, pressureMaximum: layers[0].pressure, temperatureMinimum: 40, temperatureMaximum: 230,
  pressureTicks: [{ pressure: 1e-6, label: "10⁻⁶" }, { pressure: 1e-3, label: "10⁻³" }, { pressure: 1, label: "1" }],
});
await Promise.all([
  writeFile(new URL("../../../../public/scenes/neptune/neptune-atmosphere-spectrum.svg", import.meta.url), spectrum),
  writeFile(new URL("../../../../public/scenes/neptune/neptune-temperature-pressure-profile.svg", import.meta.url), profile),
]);

