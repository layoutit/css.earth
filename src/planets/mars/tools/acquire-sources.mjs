import { resolve } from "node:path";
import sharp from "sharp";

import { publishSourceBytes } from "../../../platform/source-acquisition.mjs";
import { MARS_SOURCE_ROOT } from "./preparation-paths.mjs";
import {
  marsSourceManifest,
  verifyMarsSourceManifest,
} from "./source-manifest.mjs";

const refresh = process.argv.includes("--refresh");
const entriesByPath = new Map(marsSourceManifest().inputs.map((entry) =>
  [entry.path, entry]));

if (!refresh) {
  console.log(JSON.stringify(await verifyMarsSourceManifest(), null, 2));
  process.exit(0);
}

const openSpaceCommit = "56e29b54b8592084ff1fef47c2e08de0b22ce516";
const openSpaceRoot =
  `https://raw.githubusercontent.com/OpenSpace/OpenSpace/${openSpaceCommit}/` +
  "data/assets/scene/solarsystem/planets/mars";
const directSources = Object.freeze([
  source("openspace/globe.asset", `${openSpaceRoot}/globe.asset`),
  source("openspace/atmosphere.asset", `${openSpaceRoot}/atmosphere.asset`),
  source("openspace/kernels.asset", `${openSpaceRoot}/kernels.asset`),
  source("openspace/phobos-globe.asset", `${openSpaceRoot}/moons/phobos/globe.asset`),
  source("openspace/deimos-globe.asset", `${openSpaceRoot}/moons/deimos/globe.asset`),
  source(
    "surface/mars-viking-mdim21-color-1km.jpg",
    "https://astrogeology.usgs.gov/ckan/dataset/7131d503-cdc9-45a5-8f83-5126c0fd397e/resource/5ea881c6-01b3-41fa-a7af-42d2131b54f1/download/mars_viking_mdim21_clrmosaic_1km.jpg",
  ),
  source(
    "moons/phobos.glb",
    "https://liu-se.cdn.openspaceproject.com/files/solarsystem/planets/mars/phobos/model/1/Phobos_1_1000.glb",
  ),
  source(
    "moons/deimos.glb",
    "https://liu-se.cdn.openspaceproject.com/files/solarsystem/planets/mars/deimos/model/1/Deimos_1_1000.glb",
  ),
  source(
    "moons/jpl-physical-parameters.html",
    "https://ssd.jpl.nasa.gov/sats/phys_par/sep.html",
  ),
  source(
    "moons/jpl-mean-elements.html",
    "https://ssd.jpl.nasa.gov/sats/elem/sep.html",
  ),
]);

for (const entry of directSources) {
  const bytes = await fetchBytes(entry.url, entry.path);
  await publishSource(entry.path, bytes);
}

await prepareTileMosaic({
  path: "lenses/mola-pseudocolor-z3.png",
  url: ({ x, y }) =>
    `http://amnh-us.wms.openspaceproject.com/Mars/Mola_PseudoColor/tile/3/${y}/${x}`,
  tileSize: 360,
  columns: 16,
  rows: 8,
  outputWidth: 4096,
  outputHeight: 2048,
});
await prepareTileMosaic({
  path: "lenses/themis-ir-day-z3.png",
  url: ({ x, y }) =>
    `http://amnh-us.wms.openspaceproject.com/Mars/Themis_IR_Day/tile/3/${y}/${x}`,
  tileSize: 256,
  columns: 14,
  rows: 7,
  outputWidth: 4096,
  outputHeight: 2048,
});
await acquirePsgAtmosphere();

console.log(JSON.stringify(await verifyMarsSourceManifest(), null, 2));

async function acquirePsgAtmosphere() {
  const seed = `<OBJECT-DATE>2026/08/29 12:00
<OBJECT-NAME>Mars
<GEOMETRY-REF>User`;
  const generator = `<GENERATOR-RANGE1>0.35
<GENERATOR-RANGE2>1.0
<GENERATOR-RANGEUNIT>um
<GENERATOR-RESOLUTION>240
<GENERATOR-RESOLUTIONUNIT>RP
<GENERATOR-RADUNITS>rif
<GENERATOR-GAS-MODEL>Y
<GENERATOR-CONT-MODEL>Y
<GENERATOR-CONT-STELLAR>Y
<GENERATOR-TRANS-SHOW>N
<GENERATOR-TRANS-APPLY>N
<GENERATOR-LOGRAD>N
<GENERATOR-TELESCOPE>SINGLE
<GENERATOR-BEAM>1
<GENERATOR-BEAM-UNIT>diameter
<GENERATOR-DIAMTELE>1
`;
  const headers = { "user-agent": "cssEarth Mars source preparation" };
  const expandedResponse = await fetch("https://psg.gsfc.nasa.gov/api.php", {
    method: "POST",
    headers,
    body: new URLSearchParams({ type: "cfg", wephm: "y", watm: "y", file: seed }),
  });
  if (!expandedResponse.ok) {
    throw new Error(`NASA PSG Mars configuration failed: ${expandedResponse.status}.`);
  }
  const configuration = `${(await expandedResponse.text()).trimEnd()}\n${generator}`;
  const spectrumResponse = await fetch("https://psg.gsfc.nasa.gov/api.php", {
    method: "POST",
    headers,
    body: new URLSearchParams({
      type: "rad",
      wephm: "n",
      watm: "n",
      file: configuration,
    }),
  });
  if (!spectrumResponse.ok) {
    throw new Error(`NASA PSG Mars spectrum failed: ${spectrumResponse.status}.`);
  }
  await Promise.all([
    publishSource("atmosphere/psg-mars-20260829.cfg", Buffer.from(configuration)),
    publishSource(
      "atmosphere/psg-mars-r240-rif.txt",
      Buffer.from(await spectrumResponse.text()),
    ),
  ]);
}

async function prepareTileMosaic(config) {
  const composites = [];
  for (let y = 0; y < config.rows; y += 1) {
    for (let x = 0; x < config.columns; x += 1) {
      composites.push({
        input: await fetchBytes(config.url({ x, y }), `${config.path} tile ${x},${y}`),
        left: x * config.tileSize,
        top: y * config.tileSize,
      });
    }
  }
  const buffer = await sharp({
    create: {
      width: config.columns * config.tileSize,
      height: config.rows * config.tileSize,
      channels: 3,
      background: "#000",
    },
  })
    .composite(composites)
    .resize(config.outputWidth, config.outputHeight, { kernel: "lanczos3" })
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  await publishSource(config.path, buffer);
}

async function fetchBytes(url, label) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { "user-agent": "cssEarth Mars source preparation" },
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      lastError = error;
      if (attempt < 4) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 500));
      }
    }
  }
  throw new Error(`Mars source failed for ${label}`, { cause: lastError });
}

async function publishSource(path, bytes) {
  const entry = entriesByPath.get(path);
  if (!entry) throw new Error(`Mars acquisition path is not declared: ${path}.`);
  await publishSourceBytes({
    destination: resolve(MARS_SOURCE_ROOT, path),
    bytes,
    entry,
    planetName: "Mars",
  });
}

function source(path, url) {
  return Object.freeze({ path, url });
}
