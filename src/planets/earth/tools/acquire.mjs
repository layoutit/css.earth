#!/usr/bin/env node

import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { publishSourceBytes } from "../../../platform/source-acquisition.mjs";
import {
  assertEarthSourceBytes,
  earthSourceManifest,
  validateEarthSourcePath,
  verifyEarthSourceManifest,
} from "./source-manifest.mjs";
import { EARTH_SOURCE_ROOT } from "./preparation-paths.mjs";

const refresh = process.argv.includes("--refresh");
const verifyOnly = process.argv.includes("--verify-only");
if (refresh && verifyOnly) {
  throw new TypeError("Earth acquisition accepts either --refresh or --verify-only.");
}

const urls = new Map(earthSourceManifest().inputs.map((entry) => [entry.path, entry.origin]));
urls.set("earth-navigation.jpg", "https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001016/GSFC_20171208_Archive_e001016~large.jpg");
urls.set("blue-marble-december.jpg", "https://eoimages.gsfc.nasa.gov/images/imagerecords/74000/74218/world.200412.3x21600x10800.jpg");
urls.set("blue-marble-topography.jpg", "https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73909/world.topo.bathy.200412.3x21600x10800.jpg");
urls.set("blue-marble-clouds.tif", "https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_8192.tif");
urls.set("black-marble-2016.jpg", "https://eoimages.gsfc.nasa.gov/images/imagerecords/144000/144898/BlackMarble_2016_3km.jpg");
urls.set("moon/jpl-satellite-physical.html", "https://ssd.jpl.nasa.gov/sats/phys_par/sep.html");
urls.set("moon/jpl-satellite-elements.html", "https://ssd.jpl.nasa.gov/sats/elem/sep.html");
urls.set("editorial/nasa-earth-record.json", "https://science.nasa.gov/wp-json/wp/v2/topic/48583");
urls.set("presentation/InterVariable.ttf", "https://raw.githubusercontent.com/rsms/inter/9221beed3/docs/font-files/InterVariable.ttf");
urls.set("stars/hygdata_v41.csv", "https://raw.githubusercontent.com/astronexus/HYG-Database/c7f7f883fe678cc7680169a50ccd7dcc49b060ce/hyg/CURRENT/hygdata_v41.csv");
urls.set("openspace/earth-globe.asset", "https://raw.githubusercontent.com/OpenSpace/OpenSpace/56e29b54b8592084ff1fef47c2e08de0b22ce516/data/assets/scene/solarsystem/planets/earth/globe.asset");
urls.set("openspace/earth-atmosphere.asset", "https://raw.githubusercontent.com/OpenSpace/OpenSpace/56e29b54b8592084ff1fef47c2e08de0b22ce516/data/assets/scene/solarsystem/planets/earth/atmosphere.asset");

if (verifyOnly) {
  console.log(JSON.stringify(await verifyEarthSourceManifest(), null, 2));
  process.exit(0);
}

const manifest = earthSourceManifest();
const psgPaths = new Set([
  "atmosphere/psg-earth-20260830.cfg",
  "atmosphere/psg-earth-r120-rif.txt",
]);
if (refresh || await anyMissing([...psgPaths])) {
  const prepared = await acquirePsg();
  for (const [path, bytes] of prepared) await publish(path, bytes);
}
for (const entry of manifest.inputs) {
  if (psgPaths.has(entry.path)) continue;
  const destination = resolve(EARTH_SOURCE_ROOT, entry.path);
  if (!refresh && await exists(destination)) {
    await validateEarthSourcePath(entry.path);
    continue;
  }
  const response = await fetch(urls.get(entry.path), {
    headers: { accept: entry.path.endsWith(".json") ? "application/json" : "*/*", "user-agent": "cssEarth Earth source acquisition" },
  });
  if (!response.ok) throw new Error(`Earth source request failed for ${entry.path}: ${response.status}.`);
  let bytes = Buffer.from(await response.arrayBuffer());
  if (entry.path === "editorial/nasa-earth-record.json") {
    const record = JSON.parse(bytes);
    if (record.id !== 48583 || record.title?.rendered !== "Facts About Earth" || record.link !== "https://science.nasa.gov/earth/facts/") {
      throw new Error("NASA Earth editorial record identity drifted.");
    }
    bytes = Buffer.from(`${JSON.stringify(record, null, 2)}\n`);
  }
  await publishSourceBytes({ destination, bytes, entry, planetName: "Earth" });
}

await run("prepare-source-intermediates.mjs");
await run("prepare-editorial.mjs");
console.log(JSON.stringify(await verifyEarthSourceManifest(), null, 2));

async function acquirePsg() {
  const seed = `<OBJECT-DATE>2026/08/30 12:00\n<OBJECT-NAME>Earth\n<GEOMETRY-REF>User`;
  const generator = `<GENERATOR-RANGE1>0.35\n<GENERATOR-RANGE2>1.0\n<GENERATOR-RANGEUNIT>um\n<GENERATOR-RESOLUTION>120\n<GENERATOR-RESOLUTIONUNIT>RP\n<GENERATOR-RADUNITS>rif\n<GENERATOR-GAS-MODEL>Y\n<GENERATOR-CONT-MODEL>Y\n<GENERATOR-CONT-STELLAR>Y\n<GENERATOR-TRANS-SHOW>N\n<GENERATOR-TRANS-APPLY>N\n<GENERATOR-LOGRAD>N\n<GENERATOR-TELESCOPE>SINGLE\n<GENERATOR-BEAM>1\n<GENERATOR-BEAM-UNIT>diameter\n<GENERATOR-DIAMTELE>1\n`;
  const headers = { "user-agent": "cssEarth Earth source acquisition" };
  const expanded = await fetch("https://psg.gsfc.nasa.gov/api.php", {
    method: "POST",
    headers,
    body: new URLSearchParams({ type: "cfg", wephm: "y", watm: "y", file: seed }),
  });
  if (!expanded.ok) throw new Error(`Earth PSG configuration request failed: ${expanded.status}.`);
  const expandedText = await expanded.text();
  if (!expandedText.startsWith("# WARNING | ATMOSPHERE |") || !expandedText.includes("<ATMOSPHERE-LAYERS>70")) {
    throw new Error("Earth PSG expanded configuration shape drifted.");
  }
  const configuration = `${expandedText.replace(/^# WARNING[^\n]*\n/u, "").trimEnd()}\n${generator}`;
  const radiance = await fetch("https://psg.gsfc.nasa.gov/api.php", {
    method: "POST",
    headers,
    body: new URLSearchParams({ type: "rad", wephm: "n", watm: "n", file: configuration }),
  });
  if (!radiance.ok) throw new Error(`Earth PSG spectrum request failed: ${radiance.status}.`);
  const spectrum = normalizeSpectrum(await radiance.text());
  if (!spectrum.includes("# Radiance unit: I/F [apparent albedo]") || spectrum.split("\n").filter((line) => /^\d/u.test(line)).length !== 127) {
    throw new Error("Earth PSG spectrum response is incomplete.");
  }
  return new Map([
    ["atmosphere/psg-earth-20260830.cfg", Buffer.from(configuration)],
    ["atmosphere/psg-earth-r120-rif.txt", Buffer.from(spectrum)],
  ]);
}

function normalizeSpectrum(value) {
  return value
    .replace(/^# Synthesized on .*$/mu, "# Synthesized for pinned Earth configuration 2026-08-30")
    .replace(/^# Radiative transfer took .*$/mu, "# Radiative transfer timing omitted from deterministic snapshot");
}

async function publish(path, bytes) {
  const entry = manifest.inputs.find((candidate) => candidate.path === path);
  await publishSourceBytes({ destination: resolve(EARTH_SOURCE_ROOT, path), bytes, entry, planetName: "Earth" });
}

async function anyMissing(paths) {
  for (const path of paths) if (!await exists(resolve(EARTH_SOURCE_ROOT, path))) return true;
  return false;
}

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

function run(file) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [resolve(import.meta.dirname, file)], { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? resolvePromise() : reject(new Error(`Earth acquisition helper failed with ${signal ?? `exit ${code}`}.`)));
  });
}
