import { createHash } from "node:crypto";
import { resolve } from "node:path";

import { publishSourceBytes } from "../../../platform/source-acquisition.mjs";
import {
  jupiterSourceManifest,
  validateJupiterSourcePath,
} from "./source-manifest.mjs";
import { JUPITER_SOURCE_ROOT } from "./preparation-paths.mjs";

const outputPath = resolve(JUPITER_SOURCE_ROOT, "moons/jupiter-moons.json");
const PINNED_RETRIEVED_AT = "2026-08-30T21:12:38Z";
if (!process.argv.includes("--refresh")) {
  await validateJupiterSourcePath("moons/jupiter-moons.json");
  console.log("Verified the pinned Jupiter moon catalog snapshot.");
  process.exit(0);
}

const sources = Object.freeze({
  discovery: "https://ssd.jpl.nasa.gov/sats/discovery.html",
  elements: "https://ssd.jpl.nasa.gov/sats/elem/",
});
const EXPECTED_MOON_COUNT = 115;
const ELEMENT_NAME_ALIASES = Object.freeze(new Map([
  ["Magaclite", "Megaclite"],
  ["Philophrosyn", "Philophrosyne"],
]));

const [discoveryHtml, elementsHtml] = await Promise.all([
  fetchText(sources.discovery),
  fetchText(sources.elements),
]);
const discoveries = parseDiscoveryRows(discoveryHtml);
const elements = parseElementRows(elementsHtml);
if (discoveries.length !== EXPECTED_MOON_COUNT) {
  throw new Error(`JPL Jupiter discovery count drifted: ${discoveries.length}.`);
}
if (elements.length !== EXPECTED_MOON_COUNT) {
  throw new Error(`JPL Jupiter element count drifted: ${elements.length}.`);
}

const discoveryByKey = new Map();
for (const record of discoveries) {
  for (const identity of [record.name, record.provisionalDesignation]) {
    if (identity) discoveryByKey.set(identityKey(identity), record);
  }
}
const matchedDiscoveries = new Set();
const moons = elements.map((orbit) => {
  const catalogName = ELEMENT_NAME_ALIASES.get(orbit.satellite) ?? orbit.satellite;
  const discovery = discoveryByKey.get(identityKey(catalogName));
  if (!discovery) {
    throw new Error(`No JPL discovery row matches ${orbit.satellite}.`);
  }
  matchedDiscoveries.add(discovery);
  return normalizeMoon({ discovery, orbit, catalogName });
}).sort((left, right) =>
  left.semiMajorAxisKm - right.semiMajorAxisKm ||
  left.name.localeCompare(right.name));

if (matchedDiscoveries.size !== EXPECTED_MOON_COUNT) {
  const unmatched = discoveries.filter((record) => !matchedDiscoveries.has(record));
  throw new Error(
    `Unmatched JPL Jupiter discoveries: ${unmatched.map((record) =>
      record.name ?? record.provisionalDesignation).join(", ")}.`,
  );
}
if (new Set(moons.map(({ id }) => id)).size !== EXPECTED_MOON_COUNT) {
  throw new Error("Jupiter moon ids are not unique.");
}

const snapshot = Object.freeze({
  schema: "cssjupiter-moon-catalog@1",
  retrievedAt: PINNED_RETRIEVED_AT,
  sources: Object.freeze({
    discovery: sourceRecord(sources.discovery, discoveryHtml),
    elements: sourceRecord(sources.elements, elementsHtml),
  }),
  authority: Object.freeze({
    confirmedMoonCount: "JPL Solar System Dynamics discovery table",
    meanElements: "JPL Solar System Dynamics satellite mean elements",
    meanElementsEpoch: "source-record epoch per moon",
    identityNormalization:
      "Two truncated element-table names are joined to discovery records by declared aliases.",
  }),
  counts: Object.freeze({
    confirmed: discoveries.length,
    withJplMeanElements: elements.length,
  }),
  moons: Object.freeze(moons),
});

const outputEntry = jupiterSourceManifest().inputs.find(({ path }) =>
  path === "moons/jupiter-moons.json");
if (!outputEntry) throw new Error("Jupiter moon catalog is not declared.");
await publishSourceBytes({
  destination: outputPath,
  bytes: Buffer.from(`${JSON.stringify(snapshot, null, 2)}\n`),
  entry: outputEntry,
  planetName: "Jupiter",
});
await validateJupiterSourcePath("moons/jupiter-moons.json");
console.log(`wrote ${outputPath} (${moons.length} Jupiter moons)`);

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "css.earth prepared-data importer" },
  });
  if (!response.ok) throw new Error(`Could not fetch ${url}: ${response.status}.`);
  return response.text();
}

function parseDiscoveryRows(html) {
  const start = html.indexOf("Satellites of  Jupiter:");
  const end = html.indexOf("Satellites of  Saturn:", start);
  if (start < 0 || end < 0) {
    throw new Error("JPL discovery Jupiter table section is missing.");
  }
  return tableRows(html.slice(start, end))
    .filter((cells) => cells.length === 6)
    .map((cells) => Object.freeze({
      romanNumeral: cells[0] || null,
      name: cells[1] || null,
      provisionalDesignation: cells[2] || null,
      discoveryYear: Number.parseInt(cells[3], 10),
      discoverers: cells[4],
      reference: cells[5],
    }));
}

function parseElementRows(html) {
  const table = html.match(
    /<table id="sat_elem"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/u,
  )?.[1];
  if (!table) throw new Error("JPL mean-elements table is missing.");
  return tableRows(table)
    .filter((cells) => cells.length === 20 && cells[1] === "Jupiter")
    .map((cells) => Object.freeze({
      recordId: Number.parseInt(cells[0], 10),
      satellite: cells[2],
      code: cells[3],
      ephemeris: cells[4],
      frame: cells[5],
      epoch: cells[6],
      semiMajorAxisKm: numericCell(cells[7], "semi-major axis"),
      eccentricity: numericCell(cells[8], "eccentricity"),
      argumentOfPeriapsisDeg: numericCell(cells[9], "periapsis"),
      meanAnomalyDeg: numericCell(cells[10], "mean anomaly"),
      inclinationDeg: numericCell(cells[11], "inclination"),
      ascendingNodeDeg: numericCell(cells[12], "ascending node"),
      periodDays: numericCell(cells[13], "period"),
      reference: cells[19],
    }));
}

function normalizeMoon({ discovery, orbit, catalogName }) {
  const name = discovery.name || discovery.provisionalDesignation;
  return Object.freeze({
    id: moonId(name),
    name,
    provisionalDesignation: discovery.provisionalDesignation,
    romanNumeral: discovery.romanNumeral,
    discoveryYear: discovery.discoveryYear,
    discoverers: discovery.discoverers,
    discoveryReference: discovery.reference,
    sourceRecord: `JPL element ${orbit.recordId}`,
    parameterQualification: orbit.satellite === catalogName
      ? "JPL-mean-elements"
      : "JPL-mean-elements-declared-name-alias",
    sourceElementName: orbit.satellite,
    code: orbit.code,
    ephemeris: orbit.ephemeris,
    frame: orbit.frame,
    epoch: orbit.epoch,
    semiMajorAxisKm: orbit.semiMajorAxisKm,
    eccentricity: orbit.eccentricity,
    argumentOfPeriapsisDeg: orbit.argumentOfPeriapsisDeg,
    meanAnomalyDeg: orbit.meanAnomalyDeg,
    inclinationDeg: orbit.inclinationDeg,
    ascendingNodeDeg: orbit.ascendingNodeDeg,
    periodDays: orbit.periodDays,
    elementReference: orbit.reference,
  });
}

function tableRows(html) {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gu)].map((row) =>
    [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gu)]
      .map((cell) => plainText(cell[1])));
}

function plainText(html) {
  return html
    .replace(/<br\s*\/?\s*>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&#x2F;/gu, "/")
    .replace(/\s+/gu, " ")
    .trim();
}

function numericCell(value, field) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`Invalid JPL ${field}: ${value}.`);
  return number;
}

function identityKey(value) {
  return value.toLowerCase().replace(/[^a-z0-9]/gu, "");
}

function moonId(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
}

function sourceRecord(url, body) {
  return Object.freeze({
    url,
    sha256: createHash("sha256").update(body).digest("hex"),
  });
}
