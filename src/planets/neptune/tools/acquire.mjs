#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { preparePlanetInformation } from "../../../../tools/prepare-planet-information.mjs";

const sourceRoot = resolve(import.meta.dirname, "../source");
const refresh = process.argv.includes("--refresh");
const verifyOnly = process.argv.includes("--verify-only") || !refresh;

const DIRECT_SOURCES = Object.freeze([
  source("opal/hlsp_opal_hst_wfc3-uvis_neptune-2025b_f467m-f547m-f657n_v1_globalmap.tif", "https://archive.stsci.edu/missions/hlsp/opal/cycle32/neptune/hlsp_opal_hst_wfc3-uvis_neptune-2025b_f467m-f547m-f657n_v1_globalmap.tif", 789926, "8c17a2872b5d55577c63abe7ba1369997ff32bb83e0f9b9c350a46db96713cb8"),
  source("opal/hlsp_opal_hst_wfc3-uvis_neptune-2025b_fq619n_v1_globalmap.fits", "https://archive.stsci.edu/missions/hlsp/opal/cycle32/neptune/hlsp_opal_hst_wfc3-uvis_neptune-2025b_fq619n_v1_globalmap.fits", 1045440, "b1ad52870f9fdcf36cde019705209005d07f927ab99ea00305f36ebe36967a1b"),
  source("opal/hlsp_opal_hst_wfc3-uvis_neptune-2025b_f845m_v1_globalmap.fits", "https://archive.stsci.edu/missions/hlsp/opal/cycle32/neptune/hlsp_opal_hst_wfc3-uvis_neptune-2025b_f845m_v1_globalmap.fits", 1045440, "7373c6c3daf3ace7cf1576596ed0480659cb03c255893b71629d282fe7291b4c"),
  source("opal/hlsp_opal_hst_wfc3-uvis_neptune-2025b_all_v1_readme.txt", "https://archive.stsci.edu/missions/hlsp/opal/cycle32/neptune/hlsp_opal_hst_wfc3-uvis_neptune-2025b_all_v1_readme.txt", 1541, "cfc2649e0242672fe6c78deba174b7572babb6a93ad7b45ec8956fb6c7c08859"),
  source("color/ras-oxford-neptune-true-colors-2024.jpg", "https://ras.ac.uk/sites/default/files/2024-01/Combined_figures_crop.jpg", 338632, "2f7d106d547adde83f356a3bd5f97053cd314a199fd6fb2c7d8d9c470df55ec7"),
  source("jpl/discovery.html", "https://ssd.jpl.nasa.gov/sats/discovery.html", 116148, "4836d801269036704bcc685000d198d92a3eb36dc9622b298b3e7c94d8c0daa5"),
  source("jpl/elements.html", "https://ssd.jpl.nasa.gov/sats/elem/sep.html", 418952, "b4e9643bb27a4b6cd656f2b8fabb99f5f446cbf1a55f1ec5e995fdc4e320ecb8"),
  source("jpl/physical.html", "https://ssd.jpl.nasa.gov/sats/phys_par/sep.html", 84633, "d48a005e6869b199796877492c894abb4c0fd49fe4819d27dfeb280f483aa440"),
  source("pds/neptune-rings.html", "https://pds-rings.seti.org/neptune/neptune_tables.html", 14304, "bf12c609c781da68134e7bb3b4eabe9dfe3656382103e47447796bc1f3b537d8"),
  source("openspace/globe.asset", "https://raw.githubusercontent.com/OpenSpace/OpenSpace/56e29b54b8592084ff1fef47c2e08de0b22ce516/data/assets/scene/solarsystem/planets/neptune/globe.asset", 1191, "aa4048418cdeaa302dc3f5d1b93aa92cf2fdd7afa937cd236e0e685da1a71235"),
  source("openspace/kernels095.asset", "https://raw.githubusercontent.com/OpenSpace/OpenSpace/56e29b54b8592084ff1fef47c2e08de0b22ce516/data/assets/scene/solarsystem/planets/neptune/kernels095.asset", 1147, "8c92db90267882ed8f3b961d17409445a7a6be66fc9cc158da25d9a266205fd6"),
  source("openspace/major_moons.asset", "https://raw.githubusercontent.com/OpenSpace/OpenSpace/56e29b54b8592084ff1fef47c2e08de0b22ce516/data/assets/scene/solarsystem/planets/neptune/major_moons.asset", 2756, "e36980014a8bddfeb473437d83426fa882304dd53346ee1ec87f1a29d20768fb"),
]);

if (verifyOnly) {
  const { verifyNeptuneSourceManifest } = await import("./source-manifest.mjs");
  const result = await verifyNeptuneSourceManifest();
  console.log(`Verified the pinned Neptune source closure (${result.inputCount} inputs).`);
} else {
  for (const entry of DIRECT_SOURCES) await acquire(entry);
  await preparePlanetInformation(["neptune"], {
    outputDirectory: resolve(sourceRoot, "editorial"),
  });
  await acquirePsg();
  await acquireHygSubset();
  console.log("Acquired the pinned Neptune source closure. Update the manifest only after review.");
}

function source(path, url, bytes, hash) {
  return Object.freeze({ path, url, bytes, hash });
}

async function acquire(entry) {
  const response = await fetch(entry.url, {
    headers: { "user-agent": "cssEarth Neptune source acquisition" },
  });
  if (!response.ok) throw new Error(`${entry.url} returned ${response.status}.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assertBytes(bytes, entry);
  const output = resolve(sourceRoot, entry.path);
  await mkdir(resolve(output, ".."), { recursive: true });
  await writeFile(output, bytes);
}

async function acquirePsg() {
  const seed = `<OBJECT-DATE>2026/08/30 12:00\n<OBJECT-NAME>Neptune\n<GEOMETRY-REF>User`;
  const generator = `<GENERATOR-RANGE1>0.35\n<GENERATOR-RANGE2>1.0\n<GENERATOR-RANGEUNIT>um\n<GENERATOR-RESOLUTION>240\n<GENERATOR-RESOLUTIONUNIT>RP\n<GENERATOR-RADUNITS>rif\n<GENERATOR-GAS-MODEL>Y\n<GENERATOR-CONT-MODEL>Y\n<GENERATOR-CONT-STELLAR>Y\n<GENERATOR-TRANS-SHOW>N\n<GENERATOR-TRANS-APPLY>N\n<GENERATOR-LOGRAD>N\n<GENERATOR-TELESCOPE>SINGLE\n<GENERATOR-BEAM>1\n<GENERATOR-BEAM-UNIT>diameter\n<GENERATOR-DIAMTELE>1\n`;
  const headers = { "user-agent": "cssEarth Neptune source acquisition" };
  const expandedResponse = await fetch("https://psg.gsfc.nasa.gov/api.php", {
    method: "POST", headers,
    body: new URLSearchParams({ type: "cfg", wephm: "y", watm: "y", file: seed }),
  });
  if (!expandedResponse.ok) throw new Error(`NASA PSG configuration returned ${expandedResponse.status}.`);
  const configuration = `${(await expandedResponse.text()).trimEnd()}\n${generator}`;
  const spectrumResponse = await fetch("https://psg.gsfc.nasa.gov/api.php", {
    method: "POST", headers,
    body: new URLSearchParams({ type: "rad", wephm: "n", watm: "n", file: configuration }),
  });
  if (!spectrumResponse.ok) throw new Error(`NASA PSG spectrum returned ${spectrumResponse.status}.`);
  const response = (await spectrumResponse.text()).replace(
    /^# Synthesized on .*$/mu,
    "# Synthesized during the pinned 2026-08-30 source acquisition",
  );
  if (response.split("\n").filter((line) => /^\d/u.test(line)).length !== 253) {
    throw new Error("NASA PSG Neptune response does not contain 253 samples.");
  }
  const atmosphereRoot = resolve(sourceRoot, "atmosphere");
  await mkdir(atmosphereRoot, { recursive: true });
  await Promise.all([
    writeFile(resolve(atmosphereRoot, "psg-neptune-20260830.cfg"), configuration),
    writeFile(resolve(atmosphereRoot, "psg-neptune-r240-rif.txt"), response),
  ]);
}

async function acquireHygSubset() {
  const url = "https://raw.githubusercontent.com/astronexus/HYG-Database/c7f7f883fe678cc7680169a50ccd7dcc49b060ce/hyg/CURRENT/hygdata_v41.csv";
  const response = await fetch(url, {
    headers: { "user-agent": "cssEarth Neptune source acquisition" },
  });
  if (!response.ok) throw new Error(`HYG catalog returned ${response.status}.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  assertBytes(bytes, { path: "HYG v4.1", bytes: 33932548, hash: "d9f69fd86bbf90a4e4d52b4c5c53eacfa6dfc0bfdef85bfd94f095e0bebe4ebd" });
  const lines = bytes.toString("utf8").trimEnd().split("\n");
  const headings = csvRow(lines[0]);
  const column = Object.fromEntries(headings.map((heading, index) => [heading, index]));
  const centerRa = radians(340);
  const centerDec = radians(-10);
  const tangentX = Math.tan(radians(56));
  const tangentY = tangentX / (16 / 9);
  const candidates = [];
  for (let index = 1; index < lines.length; index += 1) {
    const row = csvRow(lines[index]);
    const ra = radians(Number(row[column.ra]) * 15);
    const dec = radians(Number(row[column.dec]));
    const magnitude = Number(row[column.mag]);
    const colorIndex = Number(row[column.ci]);
    const id = Number(row[column.id]);
    if (![ra, dec, magnitude, id].every(Number.isFinite)) continue;
    const deltaRa = ra - centerRa;
    const cosc = Math.sin(centerDec) * Math.sin(dec) +
      Math.cos(centerDec) * Math.cos(dec) * Math.cos(deltaRa);
    if (cosc <= 0) continue;
    const projectedX = Math.cos(dec) * Math.sin(deltaRa) / cosc;
    const projectedY = (Math.cos(centerDec) * Math.sin(dec) -
      Math.sin(centerDec) * Math.cos(dec) * Math.cos(deltaRa)) / cosc;
    const x = 0.5 + projectedX / (2 * tangentX);
    const y = 0.5 - projectedY / (2 * tangentY);
    if (x < 0 || x > 1 || y < 0 || y > 1) continue;
    candidates.push({ id, x, y, magnitude, colorIndex });
  }
  candidates.sort((left, right) => left.magnitude - right.magnitude || left.id - right.id);
  const stars = candidates.slice(0, 1100).map(({ id, x, y, magnitude, colorIndex }) => ({
    id,
    x: fixed(x, 9),
    y: fixed(y, 9),
    magnitude: fixed(magnitude, 3),
    colorIndex: Number.isFinite(colorIndex) ? fixed(colorIndex, 3) : null,
  }));
  const subset = {
    schema: "cssneptune-prepared-star-source@1",
    source: { id: "hyg-v4.1", title: "HYG Stellar Database v4.1", credit: "David Nash / Astronexus", license: "CC-BY-SA-4.0", repositoryUrl: "https://github.com/astronexus/HYG-Database", sourceUrl: url, commit: "c7f7f883fe678cc7680169a50ccd7dcc49b060ce", sha256: sha256(bytes), catalogRows: lines.length - 1, retrieved: "2026-08-30" },
    projection: { model: "prepared-gnomonic-representative-celestial-field", centerRaDegrees: 340, centerDecDegrees: -10, horizontalFovDegrees: 112, qualification: "catalog-derived representative sky; orientation is illustrative because the Neptune scene has no absolute observer epoch or inertial camera orientation" },
    presentation: { width: 2560, height: 1440, visibleCatalogStars: candidates.length, selectedStars: stars.length, selection: "brightest-apparent-magnitude-in-projected-field", brightestMagnitude: stars[0].magnitude, faintestMagnitude: stars.at(-1).magnitude, sourcePixelRadii: [0, 1, 2], opacity: 0.56 },
    stars,
  };
  await mkdir(resolve(sourceRoot, "stars"), { recursive: true });
  await writeFile(resolve(sourceRoot, "stars/hyg-v41-field.json"), `${JSON.stringify(subset, null, 2)}\n`);
}

function csvRow(line) {
  const values = []; let value = ""; let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) { values.push(value); value = ""; }
    else value += character;
  }
  values.push(value); return values;
}

function radians(degrees) { return degrees * Math.PI / 180; }
function fixed(value, digits) { return Number(value.toFixed(digits)); }
function sha256(bytes) { return createHash("sha256").update(bytes).digest("hex"); }
function assertBytes(bytes, entry) {
  if (bytes.byteLength !== entry.bytes || sha256(bytes) !== entry.hash) {
    throw new Error(`${entry.path} did not match the pinned source bytes.`);
  }
}
