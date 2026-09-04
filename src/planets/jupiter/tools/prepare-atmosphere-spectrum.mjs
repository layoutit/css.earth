import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { renderReflectanceChart } from "../../../platform/scientific-chart-svg.mjs";

import {
  ensureJupiterPreparationDirectories,
  JUPITER_PUBLIC_ROOT,
  JUPITER_SOURCE_ROOT,
} from "./preparation-paths.mjs";
import { validateJupiterSourceGroup } from "./source-manifest.mjs";

await validateJupiterSourceGroup("spectrum");
await ensureJupiterPreparationDirectories();

const responsePath = resolve(
  JUPITER_SOURCE_ROOT,
  "atmosphere/psg-jupiter-r240-rif.txt",
);
const outputPath = resolve(JUPITER_PUBLIC_ROOT, "jupiter-reflectance-spectrum.svg");
const response = await readFile(responsePath, "utf8");
if (!response.includes("# Radiance unit: I/F [apparent albedo]")) {
  throw new Error("Jupiter PSG response is not I/F apparent albedo.");
}
const points = response.split("\n")
  .filter((line) => /^\d/u.test(line))
  .map((line) => line.trim().split(/\s+/u).map(Number))
  .map(([wavelength, total]) => Object.freeze({ wavelength, total }));
if (points.length !== 253 || points.some(({ wavelength, total }) =>
  !Number.isFinite(wavelength) || !Number.isFinite(total))) {
  throw new Error("Jupiter PSG response no longer contains 253 numeric samples.");
}
const first = points[0].wavelength;
const last = points.at(-1).wavelength;
if (Math.abs(first - 0.35) > 1e-12 || last < 0.997 || last > 1) {
  throw new Error("Jupiter PSG wavelength range changed.");
}

const svg = renderReflectanceChart({
  id: "jupiter",
  title: "Jupiter modeled disk reflectance",
  description: "Full 253-point NASA PSG modeled reflectance spectrum from " +
    "350 to 1000 nanometers. The wavelength band marks ultraviolet, visible " +
    "light, and near-infrared regions.",
  metadata: {
    source: "NASA GSFC Planetary Spectrum Generator",
    sourceUrl: "https://psg.gsfc.nasa.gov/api.php",
    measurement: "I/F apparent albedo",
    resolution: "R 240",
    points: 253,
    rangeMicrometers: [0.35, 0.9979984388],
    model: "Jupiter atmosphere, Moses et al. 2005, NASA PSG",
    configured: "2026-08-30",
  },
  points,
  maximum: 0.24,
  maximumLabel: ".24",
  midpointLabel: ".12",
});
await writeFile(outputPath, svg);
console.log(JSON.stringify({
  output: outputPath,
  points: points.length,
  responseSha256: createHash("sha256").update(response).digest("hex"),
  outputSha256: createHash("sha256").update(svg).digest("hex"),
}, null, 2));
