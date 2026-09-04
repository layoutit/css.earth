#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { publishSourceBytes } from "../../../platform/source-acquisition.mjs";

const HYG_URL = "https://raw.githubusercontent.com/astronexus/HYG-Database/" +
  "c7f7f883fe678cc7680169a50ccd7dcc49b060ce/hyg/CURRENT/hygdata_v41.csv";
const HYG_BYTES = 33_932_548;
const HYG_SHA256 = "d9f69fd86bbf90a4e4d52b4c5c53eacfa6dfc0bfdef85bfd94f095e0bebe4ebd";
const sourceRoot = resolve(import.meta.dirname, "../source");
const manifest = JSON.parse(await readFile(resolve(sourceRoot, "manifest.json")));
const entries = new Map([
  ...manifest.inputs,
  ...manifest.documents,
].map((entry) => [entry.path, entry]));
const refresh = process.argv.includes("--refresh");
const verifyOnly = process.argv.includes("--verify-only");
if (refresh && verifyOnly) {
  throw new TypeError("Sun acquisition accepts either --refresh or --verify-only.");
}

if (refresh) {
  const remotelyAcquired = manifest.inputs.filter(({ origin }) =>
    origin.startsWith("https://sdo.gsfc.nasa.gov/") ||
    origin.startsWith("https://jsoc1.stanford.edu/"));
  await Promise.all([
    acquireAll(remotelyAcquired, 4),
    publish("editorial/sun.json", await readFile(resolve(
      import.meta.dirname,
      "../../../../data/planets/sun.json",
    ))),
    acquireSunStarSource(),
  ]);
}

async function acquireAll(inputs, concurrency) {
  let next = 0;
  await Promise.all(Array.from(
    { length: Math.min(concurrency, inputs.length) },
    async () => {
      while (next < inputs.length) {
        const { path } = inputs[next];
        next += 1;
        await acquire(path);
      }
    },
  ));
}

const { verifySunSourceManifest } = await import("./source-manifest.mjs");
console.log(JSON.stringify(await verifySunSourceManifest(), null, 2));

async function acquire(path) {
  const entry = entries.get(path);
  if (!entry) throw new Error(`Sun acquisition path is undeclared: ${path}.`);
  const response = await fetch(entry.origin, {
    headers: { "user-agent": "cssEarth Sun source preparation" },
  });
  if (!response.ok) {
    throw new Error(`Sun source request failed: ${entry.origin} (${response.status}).`);
  }
  return publish(path, Buffer.from(await response.arrayBuffer()));
}

function publish(path, bytes) {
  const entry = entries.get(path);
  if (!entry) throw new Error(`Sun acquisition path is undeclared: ${path}.`);
  return publishSourceBytes({
    destination: resolve(sourceRoot, path),
    bytes,
    entry,
    planetName: "Sun",
  });
}

async function acquireSunStarSource() {
  const response = await fetch(HYG_URL, {
    headers: { "user-agent": "cssEarth Sun source acquisition" },
  });
  if (!response.ok) throw new Error(`HYG catalog returned ${response.status}.`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength !== HYG_BYTES || sha256(bytes) !== HYG_SHA256) {
    throw new Error("Pinned HYG v4.1 catalog bytes drifted.");
  }
  const lines = bytes.toString("utf8").trimEnd().split("\n");
  const headings = csvRow(lines[0]);
  const column = Object.fromEntries(headings.map((heading, index) => [heading, index]));
  const centerRa = radians(40);
  const centerDec = radians(7);
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
  const stars = candidates.slice(0, 1100).map(({
    id,
    x,
    y,
    magnitude,
    colorIndex,
  }) => ({
    id,
    x: fixed(x, 9),
    y: fixed(y, 9),
    magnitude: fixed(magnitude, 3),
    colorIndex: Number.isFinite(colorIndex) ? fixed(colorIndex, 3) : null,
  }));
  const subset = {
    schema: "csssun-prepared-star-source@1",
    source: {
      id: "hyg-v4.1",
      title: "HYG Stellar Database v4.1",
      credit: "David Nash / Astronexus",
      license: "CC-BY-SA-4.0",
      repositoryUrl: "https://github.com/astronexus/HYG-Database",
      sourceUrl: HYG_URL,
      commit: "c7f7f883fe678cc7680169a50ccd7dcc49b060ce",
      sha256: HYG_SHA256,
      catalogRows: lines.length - 1,
      retrieved: "2026-08-28",
    },
    projection: {
      model: "prepared-gnomonic-representative-celestial-field",
      centerRaDegrees: 40,
      centerDecDegrees: 7,
      horizontalFovDegrees: 112,
      qualification: "catalog-derived representative sky; orientation is illustrative because the Sun scene has no absolute observer epoch or inertial camera orientation",
    },
    presentation: {
      width: 2560,
      height: 1440,
      visibleCatalogStars: candidates.length,
      selectedStars: stars.length,
      selection: "brightest-apparent-magnitude-in-projected-field",
      brightestMagnitude: stars[0].magnitude,
      faintestMagnitude: stars.at(-1).magnitude,
      sourcePixelRadii: [0, 1, 2],
      opacity: 0.5,
    },
    stars,
  };
  return publish(
    "stars/hyg-v41-field.json",
    Buffer.from(`${JSON.stringify(subset, null, 2)}\n`),
  );
}

function csvRow(line) {
  const values = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }
  values.push(value);
  return values;
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function radians(degrees) {
  return degrees * Math.PI / 180;
}

function fixed(value, digits) {
  return Number(value.toFixed(digits));
}
