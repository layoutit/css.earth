#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { renderReflectanceChart } from "../../../platform/scientific-chart-svg.mjs";
import { MERCURY_PUBLIC_ROOT, MERCURY_SOURCE_ROOT } from "./preparation-paths.mjs";
import { validateMercurySourceGroup } from "./source-manifest.mjs";

await validateMercurySourceGroup("spectrum");

const mascs = JSON.parse(await readFile(resolve(
  MERCURY_SOURCE_ROOT,
  "spectrum/mascs-global-area-weighted-mean.json",
), "utf8"));

if (mascs.schema !== "cssmercury-mascs-global-spectrum@1" ||
    mascs.wavelengthNanometers.length !== 326 ||
    mascs.reflectanceIOverF.length !== 326 ||
    mascs.wavelengthNanometers[0] !== 350 ||
    mascs.wavelengthNanometers.at(-1) !== 1000 ||
    !mascs.validCellCounts.every((count) => count === 60_704)) {
  throw new Error("Mercury scientific chart sources are incompatible.");
}

const spectrumMetadata = {
  source: "DLR MESSENGER MASCS global spectral cube",
  doi: mascs.source.doi,
  instrument: mascs.source.instrument,
  statistic: mascs.aggregation.globalStatistic,
  perCellStatistic: mascs.aggregation.perCellStatistic,
  usableCellsPerChannel: 60_704,
  wavelengthRangeNanometers: [350, 1000],
  pointsRetained: 326,
  license: mascs.source.license,
  archiveMd5: mascs.source.archiveMd5,
  archiveSha256: mascs.source.archiveSha256,
  countQualification: mascs.aggregation.archiveCountQualification,
};

const spectrum = renderReflectanceChart({
  id: "mercury",
  title: "Mercury global mean MESSENGER MASCS reflectance",
  description: "Area-weighted global mean of upstream per-cell median " +
    "photometrically corrected MESSENGER MASCS I over F from 350 to 1000 " +
    "nanometers, with 60,704 usable one-degree cells per channel.",
  metadata: spectrumMetadata,
  points: mascs.reflectanceIOverF.map((total, index) => ({
    wavelength: mascs.wavelengthNanometers[index] / 1000,
    total,
  })),
  maximum: 0.065,
});

await writeFile(
  resolve(MERCURY_PUBLIC_ROOT, "mercury-surface-albedo.svg"),
  spectrum,
);
console.log("Prepared Mercury reflectance chart.");
