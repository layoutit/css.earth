import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  renderTemperaturePressureChart,
} from "../../../platform/scientific-chart-svg.mjs";

import {
  ensureJupiterPreparationDirectories,
  JUPITER_PUBLIC_ROOT,
  JUPITER_SOURCE_ROOT,
} from "./preparation-paths.mjs";
import { validateJupiterSourceGroup } from "./source-manifest.mjs";

await validateJupiterSourceGroup("spectrum");
await ensureJupiterPreparationDirectories();

const configurationPath = resolve(
  JUPITER_SOURCE_ROOT,
  "atmosphere/psg-jupiter-20260830.cfg",
);
const outputPath = resolve(
  JUPITER_PUBLIC_ROOT,
  "jupiter-temperature-pressure-profile.svg",
);
const configuration = await readFile(configurationPath, "utf8");
if (!configuration.includes(
  "<ATMOSPHERE-DESCRIPTION>Jupiter atmosphere - Moses et al. 2005, JGR",
)) {
  throw new Error("Jupiter PSG atmosphere model changed.");
}
const layers = [...configuration.matchAll(
  /<ATMOSPHERE-LAYER-(\d+)>([^\n]+)/gu,
)].map(([, index, row]) => {
  const [pressure, temperature] = row.split(",").map(Number);
  return Object.freeze({
    index: Number(index),
    pressure,
    temperature,
  });
});
if (layers.length !== 50 || layers.some((layer, layerIndex) =>
  layer.index !== layerIndex + 1 ||
  !Number.isFinite(layer.pressure) || layer.pressure <= 0 ||
  !Number.isFinite(layer.temperature))) {
  throw new Error(
    "Jupiter PSG configuration no longer contains 50 ordered atmosphere layers.",
  );
}
const pressureMaximum = layers[0].pressure;
const pressureMinimum = layers.at(-1).pressure;
if (Math.abs(pressureMaximum - 10) > 1e-12 ||
    Math.abs(pressureMinimum - 1e-8) > 1e-14) {
  throw new Error("Jupiter PSG pressure range changed.");
}

const pressureTicks = Object.freeze([
  { pressure: 1e-8, label: "10⁻⁸" },
  { pressure: 1e-6, label: "10⁻⁶" },
  { pressure: 1e-4, label: "10⁻⁴" },
  { pressure: 1e-2, label: "10⁻²" },
  { pressure: 10, label: "10" },
]);
const svg = renderTemperaturePressureChart({
  id: "jupiter",
  title: "Jupiter temperature and pressure profile",
  description: "NASA PSG Jupiter vertical atmosphere model with 50 layers. " +
    "Pressure runs from 10 bar to 10 nanobar on a logarithmic scale.",
  metadata: {
    source: "NASA GSFC Planetary Spectrum Generator",
    sourceUrl: "https://psg.gsfc.nasa.gov/api.php",
    atmosphere: "Jupiter atmosphere, Moses et al. 2005, JGR",
    layers: 50,
    pressureRangeBar: [1e-8, 10],
    temperatureRangeKelvin: [108.6, 492.2],
    configured: "2026-08-30",
  },
  layers,
  pressureMinimum,
  pressureMaximum,
  temperatureMinimum: 100,
  temperatureMaximum: 500,
  pressureTicks,
});
await writeFile(outputPath, svg);
console.log(JSON.stringify({
  output: outputPath,
  layers: layers.length,
  configurationSha256: createHash("sha256").update(configuration).digest("hex"),
  outputSha256: createHash("sha256").update(svg).digest("hex"),
}, null, 2));
