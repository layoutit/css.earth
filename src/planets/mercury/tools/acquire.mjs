#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import sharp from "sharp";

import { publishSourceBytes } from "../../../platform/source-acquisition.mjs";
import {
  mercurySourceManifest,
  verifyMercurySourceManifest,
} from "./source-manifest.mjs";

const refresh = process.argv.includes("--refresh");
const refreshStarfieldPhoto = process.argv.includes("--refresh-starfield-photo");
const verifyOnly = process.argv.includes("--verify-only");
if ([refresh, refreshStarfieldPhoto, verifyOnly].filter(Boolean).length > 1) {
  throw new TypeError(
    "Mercury acquisition accepts one refresh or verification mode at a time.",
  );
}
if (refresh) await refreshSources();
if (refreshStarfieldPhoto) await refreshPhotographicStarfield();
console.log(JSON.stringify(await verifyMercurySourceManifest(), null, 2));

async function refreshPhotographicStarfield() {
  const manifest = mercurySourceManifest();
  const entries = new Map(manifest.inputs.map((entry) => [entry.id, entry]));
  const entry = requiredEntry(entries, "eso-milky-way-panorama");
  const bytes = Buffer.from(await checkedFetch(entry.origin));
  await publishSourceBytes({
    destination: resolve(import.meta.dirname, "../source", entry.path),
    bytes,
    entry,
    planetName: "Mercury",
  });
  console.log("Mercury ESO photographic starfield source refreshed.");
}

async function refreshSources() {
  const manifest = mercurySourceManifest();
  const entries = new Map(manifest.inputs.map((entry) => [entry.id, entry]));
  const sourceRoot = resolve(import.meta.dirname, "../source");
  const pinnedDirect = [
    "openspace-mercury-globe",
    "openspace-mercury-bdr-asset",
    "openspace-mercury-bdr-wms",
    "openspace-mercury-enhanced-asset",
    "openspace-mercury-enhanced-wms",
    "openspace-mercury-topography-asset",
    "openspace-mercury-topography-wms",
    "nasa-mercury-pia15162-navigation",
  ];
  for (const id of pinnedDirect) {
    const entry = requiredEntry(entries, id);
    const bytes = Buffer.from(await checkedFetch(entry.origin));
    await publishSourceBytes({
      destination: resolve(sourceRoot, entry.path),
      bytes,
      entry,
      planetName: "Mercury",
    });
  }

  const temporaryRoot = await mkdtemp(resolve(tmpdir(), "cssearth-mercury-"));
  try {
    await Promise.all([
      refreshMap({
        entry: requiredEntry(entries, "usgs-messenger-bdr-global-z3"),
        route: "Messenger_BDR",
        tileSize: 360,
        columns: 16,
        rows: 8,
        dataWidth: 5760,
        dataHeight: 2880,
        temporaryRoot,
        sourceRoot,
      }),
      refreshMap({
        entry: requiredEntry(entries, "usgs-messenger-enhanced-global-z3"),
        route: "Mercury_MESSENGER_MDIS_Basemap_EnhancedColor_Mosaic_Global_665m",
        tileUrlTemplate:
          "https://trek.nasa.gov/tiles/Mercury/EQ/" +
          "Mercury_MESSENGER_MDIS_Basemap_EnhancedColor_Mosaic_Global_665m/" +
          "1.0.0/default/default028mm/3/${y}/${x}.jpg",
        tileSize: 256,
        columns: 16,
        rows: 8,
        dataWidth: 4096,
        dataHeight: 2048,
        forceRgb: true,
        temporaryRoot,
        sourceRoot,
      }),
      refreshMap({
        entry: requiredEntry(entries, "usgs-messenger-topography-z3"),
        route: "Messenger_Shade",
        tileSize: 360,
        columns: 11,
        rows: 6,
        dataWidth: 3832,
        dataHeight: 1916,
        temporaryRoot,
        sourceRoot,
      }),
    ]);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }

  await verifyPsg(entries, sourceRoot);
  await verifyEditorial(entries, sourceRoot);
  await verifyPinnedFont(entries);
  await verifyHyg(entries, sourceRoot);
  console.log("Mercury upstream acquisition routes reproduce the committed snapshots.");
}

async function refreshMap({
  entry,
  route,
  tileUrlTemplate =
    `http://amnh-us.wms.openspaceproject.com/Mercury/${route}/tile/3/\${y}/\${x}`,
  tileSize,
  columns,
  rows,
  dataWidth,
  dataHeight,
  forceRgb = false,
  temporaryRoot,
  sourceRoot,
}) {
  const tiles = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < columns; x += 1) tiles.push({ x, y });
  }
  const directory = resolve(temporaryRoot, route);
  await mkdir(directory, { recursive: true });
  const tileFiles = new Map();
  for (let offset = 0; offset < tiles.length; offset += 10) {
    await Promise.all(tiles.slice(offset, offset + 10).map(async ({ x, y }) => {
      const tileUrl = tileUrlTemplate
        .replaceAll("${y}", String(y))
        .replaceAll("${x}", String(x));
      const bytes = Buffer.from(await checkedFetch(tileUrl));
      const tilePath = resolve(directory, `${x}-${y}.tile`);
      await writeFile(tilePath, bytes);
      tileFiles.set(`${x}:${y}`, tilePath);
    }));
  }
  const stitched = await sharp({
    create: {
      width: columns * tileSize,
      height: rows * tileSize,
      channels: 3,
      background: { r: 0, g: 0, b: 0 },
    },
  }).composite(tiles.map(({ x, y }) => ({
    input: tileFiles.get(`${x}:${y}`),
    left: x * tileSize,
    top: y * tileSize,
  }))).png().toBuffer();
  let output = sharp(stitched)
    .extract({ left: 0, top: 0, width: dataWidth, height: dataHeight });
  if (dataWidth !== 4096 || dataHeight !== 2048) {
    output = output.resize(4096, 2048, { kernel: "lanczos3", fit: "fill" });
  }
  if (forceRgb) output = output.removeAlpha();
  const bytes = await output.png({
    compressionLevel: 9,
    adaptiveFiltering: true,
  }).toBuffer();
  await publishSourceBytes({
    destination: resolve(sourceRoot, entry.path),
    bytes,
    entry,
    planetName: "Mercury",
  });
}

async function verifyPsg(entries, sourceRoot) {
  const configEntry = requiredEntry(entries, "nasa-psg-mercury-config");
  const responseEntry = requiredEntry(entries, "nasa-psg-mercury-r240-rif");
  const pinnedConfig = await readFile(resolve(sourceRoot, configEntry.path), "utf8");
  const seed = `<OBJECT-DATE>2026/08/30 12:00\n<OBJECT-NAME>Mercury\n<GEOMETRY-REF>User`;
  const expandedResponse = await fetch("https://psg.gsfc.nasa.gov/api.php", {
    method: "POST",
    headers: { "user-agent": "cssEarth Mercury source verification" },
    body: new URLSearchParams({ type: "cfg", wephm: "y", watm: "y", file: seed }),
  });
  if (!expandedResponse.ok) {
    throw new Error(`NASA PSG Mercury configuration failed: ${expandedResponse.status}.`);
  }
  const expanded = (await expandedResponse.text()).trimEnd();
  const pinnedExpanded = pinnedConfig.split("<GENERATOR-RANGE1>")[0].trimEnd();
  if (expanded !== pinnedExpanded) {
    throw new Error("NASA PSG Mercury expanded configuration drifted.");
  }
  const spectrumResponse = await fetch("https://psg.gsfc.nasa.gov/api.php", {
    method: "POST",
    headers: { "user-agent": "cssEarth Mercury source verification" },
    body: new URLSearchParams({
      type: "rad",
      wephm: "n",
      watm: "n",
      file: pinnedConfig,
    }),
  });
  if (!spectrumResponse.ok) {
    throw new Error(`NASA PSG Mercury spectrum failed: ${spectrumResponse.status}.`);
  }
  const refreshedRows = spectrumRows(await spectrumResponse.text());
  const pinnedRows = spectrumRows(await readFile(
    resolve(sourceRoot, responseEntry.path),
    "utf8",
  ));
  if (refreshedRows !== pinnedRows) {
    throw new Error("NASA PSG Mercury spectrum values drifted.");
  }
}

async function verifyEditorial(entries, sourceRoot) {
  const entry = requiredEntry(entries, "nasa-mercury-facts-107747");
  const local = JSON.parse(await readFile(resolve(sourceRoot, entry.path), "utf8"));
  const response = await fetch(local.recordApiUrl, {
    headers: { "user-agent": "cssEarth Mercury source verification" },
  });
  if (!response.ok) throw new Error(`NASA Mercury facts check failed: ${response.status}.`);
  const record = await response.json();
  if (record.id !== local.sourceId || record.modified !== local.modified) {
    throw new Error("NASA Mercury facts record identity or modification date drifted.");
  }
}

async function verifyPinnedFont(entries) {
  const entry = requiredEntry(entries, "inter-mercury-title-vector");
  const titleSource = await import(new URL("../source/presentation/title-mark.mjs", import.meta.url));
  const bytes = Buffer.from(await checkedFetch(entry.origin));
  const hash = sha256(bytes);
  if (hash !== titleSource.MERCURY_TITLE_SOURCE.sourceSha256) {
    throw new Error("Pinned Inter font bytes drifted.");
  }
}

async function verifyHyg(entries, sourceRoot) {
  const entry = requiredEntry(entries, "hyg-v41-mercury-field");
  const subset = JSON.parse(await readFile(resolve(sourceRoot, entry.path), "utf8"));
  const bytes = Buffer.from(await checkedFetch(subset.source.sourceUrl));
  if (sha256(bytes) !== subset.source.sha256) {
    throw new Error("Pinned HYG v4.1 catalog bytes drifted.");
  }
}

async function checkedFetch(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Mercury acquisition failed ${response.status}: ${url}`);
  return response.arrayBuffer();
}

function spectrumRows(value) {
  const rows = value.split("\n").filter((line) => /^\d/u.test(line));
  if (rows.length !== 253) {
    throw new Error(`NASA PSG returned ${rows.length} Mercury samples instead of 253.`);
  }
  return rows.join("\n");
}

function requiredEntry(entries, id) {
  const entry = entries.get(id);
  if (!entry) throw new Error(`Mercury source manifest is missing ${id}.`);
  return entry;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
