import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  renderTemperaturePressureChart,
} from "../../../platform/scientific-chart-svg.mjs";

import {
  ensureMarsPreparationDirectories,
  MARS_PUBLIC_ROOT,
  MARS_SOURCE_ROOT,
} from "./preparation-paths.mjs";
import { validateMarsSourceGroup } from "./source-manifest.mjs";

await validateMarsSourceGroup("spectrum");
await ensureMarsPreparationDirectories();

const configurationPath = resolve(
  MARS_SOURCE_ROOT,
  "atmosphere/psg-mars-20260829.cfg",
);
const outputPath = resolve(
  MARS_PUBLIC_ROOT,
  "mars-temperature-pressure-profile.svg",
);
const configuration = await readFile(configurationPath, "utf8");
if (!configuration.includes("<ATMOSPHERE-DESCRIPTION>Mars MCD5.3")) {
  throw new Error("Mars PSG atmosphere model changed.");
}
const layers = [...configuration.matchAll(
  /<ATMOSPHERE-LAYER-(\d+)>([^\n]+)/gu,
)].map(([, index, row]) => {
  const [pressure, temperature, altitude] = row.split(",").map(Number);
  return Object.freeze({
    index: Number(index),
    pressure,
    temperature,
    altitude,
  });
});
if (layers.length !== 49 || layers.some((layer, layerIndex) =>
  layer.index !== layerIndex + 1 ||
  !Number.isFinite(layer.pressure) || layer.pressure <= 0 ||
  !Number.isFinite(layer.temperature) ||
  !Number.isFinite(layer.altitude))) {
  throw new Error(
    "Mars PSG configuration no longer contains 49 ordered atmosphere layers.",
  );
}
const pressureMaximum = layers[0].pressure;
const pressureMinimum = layers.at(-1).pressure;
if (Math.abs(pressureMaximum - 0.0073085) > 1e-12 ||
    Math.abs(pressureMinimum - 2.0223e-13) > 1e-18) {
  throw new Error("Mars PSG pressure range changed.");
}

const pressureTicks = Object.freeze([
  { pressure: 1e-12, label: "10⁻¹²" },
  { pressure: 1e-9, label: "10⁻⁹" },
  { pressure: 1e-6, label: "10⁻⁶" },
  { pressure: 1e-3, label: "10⁻³" },
]);
const svg = renderTemperaturePressureChart({
  id: "mars",
  title: "Mars temperature and pressure profile",
  description: "NASA PSG Mars MCD5.3 vertical atmosphere model with 49 " +
    "layers. Pressure runs from about 7.3 millibar at the surface to 0.2 " +
    "picobar at 244 kilometers and decreases upward on a logarithmic scale.",
  metadata: {
    source: "NASA GSFC Planetary Spectrum Generator",
    sourceUrl: "https://psg.gsfc.nasa.gov/api.php",
    atmosphere: "Mars MCD5.3, Millour et al. 2015",
    layers: 49,
    pressureRangeBar: [2.0223e-13, 0.0073085],
    temperatureRangeKelvin: [89.155, 248.13],
    altitudeRangeKilometers: [0, 244.03],
    configured: "2026-08-29",
  },
  layers,
  pressureMinimum,
  pressureMaximum,
  temperatureMinimum: 80,
  temperatureMaximum: 260,
  pressureTicks,
});
await writeFile(outputPath, svg);
console.log(JSON.stringify({
  output: outputPath,
  layers: layers.length,
  configurationSha256: createHash("sha256").update(configuration).digest("hex"),
  outputSha256: createHash("sha256").update(svg).digest("hex"),
}, null, 2));
