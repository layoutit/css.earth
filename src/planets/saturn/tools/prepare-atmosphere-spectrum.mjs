import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  renderReflectanceChart,
  renderTemperaturePressureChart,
} from "../../../platform/scientific-chart-svg.mjs";
import { validateSaturnSourceGroup } from "./source-manifest.mjs";

await validateSaturnSourceGroup("spectrum");

const responsePath = fileURLToPath(new URL(
  "../source/atmosphere/psg-saturn-r240-rif.txt",
  import.meta.url,
));
const configurationPath = fileURLToPath(new URL(
  "../source/atmosphere/psg-saturn-20260829.cfg",
  import.meta.url,
));
const outputPath = fileURLToPath(new URL(
  "../../../../public/scenes/saturn/saturn-atmosphere-spectrum.svg",
  import.meta.url,
));
const profileOutputPath = fileURLToPath(new URL(
  "../../../../public/scenes/saturn/saturn-temperature-pressure-profile.svg",
  import.meta.url,
));
const [response, configuration] = await Promise.all([
  readFile(responsePath, "utf8"),
  readFile(configurationPath, "utf8"),
]);
if (!response.includes("# Radiance unit: I/F [apparent albedo]")) {
  throw new Error("Saturn PSG response is not I/F apparent albedo.");
}
const points = response.split("\n")
  .filter((line) => /^\d/.test(line))
  .map((line) => line.trim().split(/\s+/).map(Number))
  .map(([wavelength, total]) => ({ wavelength, total }));
if (points.length !== 253 || points.some(({ wavelength, total }) =>
  !Number.isFinite(wavelength) || !Number.isFinite(total))) {
  throw new Error("Saturn PSG response no longer contains 253 numeric samples.");
}
const first = points[0].wavelength;
const last = points.at(-1).wavelength;
if (Math.abs(first - 0.35) > 1e-12 || last < 0.997 || last > 1.0) {
  throw new Error("Saturn PSG wavelength range changed.");
}

const svg = renderReflectanceChart({
  id: "saturn",
  title: "Saturn modeled disk reflectance",
  description: "Full 253-point NASA PSG spectrum from 350 to 1000 " +
    "nanometers. The band marks ultraviolet, visible light and near-infrared " +
    "wavelengths.",
  metadata: {
    source: "NASA GSFC Planetary Spectrum Generator",
    sourceUrl: "https://psg.gsfc.nasa.gov/api.php",
    measurement: "I/F apparent albedo",
    resolution: "R 240",
    points: 253,
    rangeMicrometers: [0.35, 1.0],
    modeled: "2026-08-29",
  },
  points,
  maximum: 0.25,
  maximumLabel: ".25",
  midpointLabel: ".125",
});
const layers = [...configuration.matchAll(
  /<ATMOSPHERE-LAYER-(\d+)>([^\n]+)/gu,
)].map(([, index, row]) => {
  const [pressure, temperature] = row.split(",").map(Number);
  return { index: Number(index), pressure, temperature };
});
if (layers.length !== 60 || layers.some(({ index, pressure, temperature }, layerIndex) =>
  index !== layerIndex + 1 ||
  !Number.isFinite(pressure) || pressure <= 0 ||
  !Number.isFinite(temperature))) {
  throw new Error("Saturn PSG configuration no longer contains 60 ordered pressure-temperature layers.");
}
const pressureMaximum = layers[0].pressure;
const pressureMinimum = layers.at(-1).pressure;
if (Math.abs(pressureMaximum - 10) > 1e-12 ||
  Math.abs(pressureMinimum - 2e-9) > 1e-18) {
  throw new Error("Saturn PSG pressure range changed.");
}
const pressureTicks = Object.freeze([
  { pressure: 1e-8, label: "10⁻⁸" },
  { pressure: 1e-5, label: "10⁻⁵" },
  { pressure: 1e-2, label: "10⁻²" },
]);
const profileSvg = renderTemperaturePressureChart({
  id: "saturn",
  title: "Saturn temperature-pressure profile",
  description: "NASA PSG vertical atmosphere model from 10 bar to 2 " +
    "nanobar. Pressure decreases upward on a logarithmic scale.",
  metadata: {
    source: "NASA GSFC Planetary Spectrum Generator",
    sourceUrl: "https://psg.gsfc.nasa.gov/api.php",
    atmosphere: "Moses et al. 2005, JGR",
    layers: 60,
    pressureRangeBar: [2e-9, 10],
    temperatureRangeKelvin: [86.84, 383.9],
    modeled: "2026-08-29",
  },
  layers,
  pressureMinimum,
  pressureMaximum,
  temperatureMinimum: 80,
  temperatureMaximum: 400,
  pressureTicks,
});
await Promise.all([
  writeFile(outputPath, svg),
  writeFile(profileOutputPath, profileSvg),
]);
console.log(JSON.stringify({
  outputs: [outputPath, profileOutputPath],
  points: points.length,
  layers: layers.length,
  responseSha256: createHash("sha256").update(response).digest("hex"),
  outputSha256: createHash("sha256").update(svg).digest("hex"),
  profileOutputSha256: createHash("sha256").update(profileSvg).digest("hex"),
}, null, 2));
