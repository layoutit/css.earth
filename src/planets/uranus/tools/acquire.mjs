#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { publishSourceBytes } from "../../../platform/source-acquisition.mjs";
import {
  assertUranusSourceBytes,
  uranusSourceManifest,
  verifyUranusSourceManifest,
} from "./source-manifest.mjs";

const refresh = process.argv.includes("--refresh");
const verifyOnly = process.argv.includes("--verify-only");
if (refresh && verifyOnly) {
  throw new TypeError("Uranus acquisition accepts either --refresh or --verify-only.");
}

if (verifyOnly) {
  console.log(JSON.stringify(await verifyUranusSourceManifest(), null, 2));
  process.exit(0);
}

const sourceRoot = resolve(import.meta.dirname, "../source");
const entries = uranusSourceManifest().inputs;
const titlePath = "presentation/title-mark.mjs";
const psgPaths = new Set([
  "atmosphere/psg-uranus-20260830.cfg",
  "atmosphere/psg-uranus-r240-rif.txt",
]);

for (const entry of entries) {
  if (entry.path === titlePath || psgPaths.has(entry.path)) continue;
  if (!refresh && await localMatches(entry)) continue;
  const response = await fetch(entry.origin, {
    headers: { "user-agent": "cssEarth Uranus source preparation" },
  });
  if (!response.ok) {
    throw new Error(`Uranus source request failed for ${entry.id}: ${response.status}.`);
  }
  await publish(entry, Buffer.from(await response.arrayBuffer()));
}

if (refresh || !(await Promise.all([...psgPaths].map(localPathMatches))).every(Boolean)) {
  await acquirePsg(entries);
}

console.log(JSON.stringify(await verifyUranusSourceManifest(), null, 2));

async function acquirePsg(manifestEntries) {
  const seed = `<OBJECT-DATE>2026/08/30 12:00
<OBJECT-NAME>Uranus
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
  const headers = { "user-agent": "cssEarth Uranus source preparation" };
  const configurationResponse = await fetch("https://psg.gsfc.nasa.gov/api.php", {
    method: "POST",
    headers,
    body: new URLSearchParams({ type: "cfg", wephm: "y", watm: "y", file: seed }),
  });
  if (!configurationResponse.ok) {
    throw new Error(`NASA PSG Uranus configuration request failed: ${configurationResponse.status}.`);
  }
  const configuration = Buffer.from(
    `${(await configurationResponse.text()).trimEnd()}\n${generator}`,
  );
  const configurationEntry = manifestEntries.find(({ path }) =>
    path === "atmosphere/psg-uranus-20260830.cfg");
  assertUranusSourceBytes(configurationEntry, configuration);

  const spectrumResponse = await fetch("https://psg.gsfc.nasa.gov/api.php", {
    method: "POST",
    headers,
    body: new URLSearchParams({
      type: "rad",
      wephm: "n",
      watm: "n",
      file: configuration.toString("utf8"),
    }),
  });
  if (!spectrumResponse.ok) {
    throw new Error(`NASA PSG Uranus spectrum request failed: ${spectrumResponse.status}.`);
  }
  const spectrum = Buffer.from((await spectrumResponse.text())
    .split("\n")
    .filter((line) =>
      !line.startsWith("# Synthesized on ") &&
      !line.startsWith("# Radiative transfer took "))
    .join("\n"));
  const spectrumEntry = manifestEntries.find(({ path }) =>
    path === "atmosphere/psg-uranus-r240-rif.txt");
  await Promise.all([
    publish(configurationEntry, configuration),
    publish(spectrumEntry, spectrum),
  ]);
}

async function localPathMatches(path) {
  const entry = entries.find((candidate) => candidate.path === path);
  return localMatches(entry);
}

async function localMatches(entry) {
  try {
    const bytes = await readFile(resolve(sourceRoot, entry.path));
    assertUranusSourceBytes(entry, bytes);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT" || /source (?:size|hash) drifted/u.test(error.message)) {
      return false;
    }
    throw error;
  }
}

function publish(entry, bytes) {
  return publishSourceBytes({
    destination: resolve(sourceRoot, entry.path),
    bytes,
    entry,
    planetName: "Uranus",
  });
}
