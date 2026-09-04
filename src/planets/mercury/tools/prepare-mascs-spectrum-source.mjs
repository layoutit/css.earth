#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createGunzip } from "node:zlib";

const inputArgument = process.argv.find((argument) =>
  argument.startsWith("--input="));
if (!inputArgument) {
  throw new TypeError("Mercury MASCS source preparation requires --input=<archive>.");
}
const inputPath = resolve(inputArgument.slice("--input=".length));
const outputPath = resolve(
  import.meta.dirname,
  "../source/spectrum/mascs-global-area-weighted-mean.json",
);
const EXPECTED_BYTES = 197_099_868;
const EXPECTED_MD5 = "ef886101f3f08eba8fe9aa9a5aa48268";
const EXPECTED_SHA256 =
  "a36df962f0026c541b157256e08ea74e11e3b33aa3000437cb9da3f676047685";
const GRID_FEATURE_COUNT = 64_800;
const NONEMPTY_FEATURE_COUNT = 60_709;
const CHANNEL_COUNT = 396;
const FIRST_WAVELENGTH_NM = 260;
const WAVELENGTH_STEP_NM = 2;
const OUTPUT_FIRST_CHANNEL = 45;
const OUTPUT_LAST_CHANNEL = 370;

const archive = await readFile(inputPath);
if (archive.byteLength !== EXPECTED_BYTES ||
    createHash("md5").update(archive).digest("hex") !== EXPECTED_MD5 ||
    createHash("sha256").update(archive).digest("hex") !== EXPECTED_SHA256) {
  throw new Error("Mercury MASCS Zenodo archive identity drifted.");
}

const weightedSums = new Float64Array(CHANNEL_COUNT);
const weights = new Float64Array(CHANNEL_COUNT);
const validCounts = new Uint32Array(CHANNEL_COUNT);
let featureCount = 0;
let spectralFeatureCount = 0;
let buffer = "";
let started = false;
const gunzip = createReadStream(inputPath).pipe(createGunzip());
for await (const chunk of gunzip) {
  buffer += chunk.toString("utf8");
  if (!started) {
    const start = buffer.indexOf('{"properties":');
    if (start < 0) continue;
    buffer = buffer.slice(start);
    started = true;
  }
  let boundary;
  while ((boundary = buffer.indexOf('}, {"properties":', 1)) >= 0) {
    consumeFeature(buffer.slice(0, boundary + 1));
    buffer = buffer.slice(boundary + 3);
  }
}
const finalBoundary = buffer.lastIndexOf("}]");
if (finalBoundary < 0) throw new Error("Mercury MASCS final feature is missing.");
consumeFeature(buffer.slice(0, finalBoundary + 1));

const visibleCounts = validCounts.slice(
  OUTPUT_FIRST_CHANNEL,
  OUTPUT_LAST_CHANNEL + 1,
);
if (featureCount !== GRID_FEATURE_COUNT ||
    spectralFeatureCount !== NONEMPTY_FEATURE_COUNT ||
    visibleCounts.some((count) => count !== 60_704)) {
  throw new Error(
    `Mercury MASCS source retained ${featureCount} grid cells, ` +
    `${spectralFeatureCount} spectra, and ${Math.min(...validCounts)} to ` +
    `${Math.max(...validCounts)} valid values per channel ` +
    `(350nm=${validCounts[45]}, 750nm=${validCounts[245]}, ` +
    `1000nm=${validCounts[370]}).`,
  );
}

const prepared = Object.freeze({
  schema: "cssmercury-mascs-global-spectrum@1",
  title: "Global area-weighted mean MESSENGER MASCS VIS reflectance",
  source: Object.freeze({
    doi: "10.5281/zenodo.7433033",
    recordUrl: "https://zenodo.org/records/7433033",
    archiveUrl:
      "https://zenodo.org/api/records/7433033/files/" +
      "grid_2D_-180_+180_-90_+90_1deg_st_median_photom_iof_sp_2nm.geojson.gz/content",
    archiveBytes: EXPECTED_BYTES,
    archiveMd5: EXPECTED_MD5,
    archiveSha256: EXPECTED_SHA256,
    creator: "M. D'Amore, DLR",
    license: "CC-BY-4.0",
    publicationDate: "2022-12-13",
    instrument: "MESSENGER Mercury Atmospheric and Surface Composition Spectrometer VIS",
  }),
  aggregation: Object.freeze({
    inputGridCellCount: featureCount,
    inputSpectralCellCount: spectralFeatureCount,
    recordMetadataReportedSpectralCellCount: 55_399,
    archiveCountQualification:
      "The verified archive contains 60,709 non-empty arrays and 60,704 usable cells from 350 to 1000 nm; the Zenodo description reports 55,399. Both counts are retained rather than silently reconciled.",
    spatialGrid: "one-degree longitude-latitude cells with incomplete cells omitted upstream",
    perCellStatistic: "upstream median photometrically corrected I/F",
    globalStatistic: "mean weighted by cosine of grid-cell center latitude",
    invalidValueRule: "exclude only non-finite values and absolute values at or above 1e10",
    runtimeAggregation: false,
  }),
  wavelengthNanometers: Object.freeze(Array.from(
    { length: OUTPUT_LAST_CHANNEL - OUTPUT_FIRST_CHANNEL + 1 },
    (_, index) => FIRST_WAVELENGTH_NM +
      (index + OUTPUT_FIRST_CHANNEL) * WAVELENGTH_STEP_NM,
  )),
  reflectanceIOverF: Object.freeze(Array.from(
    weightedSums.slice(OUTPUT_FIRST_CHANNEL, OUTPUT_LAST_CHANNEL + 1),
    (sum, index) => Number((
      sum / weights[index + OUTPUT_FIRST_CHANNEL]
    ).toFixed(9)),
  )),
  validCellCounts: Object.freeze(Array.from(visibleCounts)),
});

await mkdir(resolve(outputPath, ".."), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(prepared, null, 2)}\n`);
console.log(JSON.stringify({
  outputPath,
  featureCount,
  spectralFeatureCount,
  sourceChannelCount: CHANNEL_COUNT,
  retainedChannelCount: prepared.wavelengthNanometers.length,
  wavelengthRangeNanometers: [
    prepared.wavelengthNanometers[0],
    prepared.wavelengthNanometers.at(-1),
  ],
}, null, 2));

function consumeFeature(text) {
  const feature = JSON.parse(text);
  const values = feature?.properties?.array;
  const coordinates = feature?.geometry?.coordinates?.[0];
  if (!Array.isArray(values) ||
      !Array.isArray(coordinates) || coordinates.length < 3) {
    throw new Error(
      `Mercury MASCS feature ${featureCount} is incompatible ` +
      `(channels=${values?.length}, coordinates=${coordinates?.length}).`,
    );
  }
  if (values.length === 0) {
    featureCount += 1;
    return;
  }
  if (values.length !== CHANNEL_COUNT) {
    throw new Error(
      `Mercury MASCS feature ${featureCount} has ${values.length} channels.`,
    );
  }
  const latitude = (coordinates[0][1] + coordinates[2][1]) / 2;
  const areaWeight = Math.cos(latitude * Math.PI / 180);
  for (let index = 0; index < CHANNEL_COUNT; index += 1) {
    const value = values[index];
    if (!Number.isFinite(value) || Math.abs(value) >= 1e10) continue;
    weightedSums[index] += value * areaWeight;
    weights[index] += areaWeight;
    validCounts[index] += 1;
  }
  spectralFeatureCount += 1;
  featureCount += 1;
}
