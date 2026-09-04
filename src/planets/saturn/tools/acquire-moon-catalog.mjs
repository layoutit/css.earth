import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { publishSourceBytes } from "../../../platform/source-acquisition.mjs";
import {
  saturnSourceManifest,
  validateSaturnSourcePath,
} from "./source-manifest.mjs";

const objectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(objectRoot, "source/moons/saturn-moons.json");
const PINNED_RETRIEVED_AT = "2026-08-29T03:29:50.993Z";
if (!process.argv.includes("--refresh")) {
  await validateSaturnSourcePath("moons/saturn-moons.json");
  console.log("Verified the pinned Saturn moon catalog snapshot.");
  process.exit(0);
}
const sources = Object.freeze({
  discovery: "https://ssd.jpl.nasa.gov/sats/discovery.html",
  elements: "https://ssd.jpl.nasa.gov/sats/elem/",
  s2009s2: "https://minorplanetcenter.net/mpec/K26/K26M19.html",
});
const EXPECTED_DISCOVERY_COUNT = 293;
const EXPECTED_ELEMENT_COUNT = 291;
const SATURN_GM_KM3_PER_S2 = 37_931_207.7;

const [discoveryHtml, elementsHtml, s2009s2Html] = await Promise.all([
  fetchText(sources.discovery),
  fetchText(sources.elements),
  fetchText(sources.s2009s2),
]);

const discoveryMoons = parseDiscoveryRows(discoveryHtml);
const elementMoons = parseElementRows(elementsHtml);
if (discoveryMoons.length !== EXPECTED_DISCOVERY_COUNT) {
  throw new Error(
    `JPL Saturn discovery count drifted: ${discoveryMoons.length}.`,
  );
}
if (elementMoons.length !== EXPECTED_ELEMENT_COUNT) {
  throw new Error(`JPL Saturn element count drifted: ${elementMoons.length}.`);
}

const discoveryByKey = new Map();
for (const record of discoveryMoons) {
  for (const identity of [record.name, record.provisionalDesignation]) {
    if (identity) discoveryByKey.set(identityKey(identity), record);
  }
}

const matchedDiscoveries = new Set();
const moons = elementMoons.map((elements) => {
  const discovery = discoveryByKey.get(identityKey(elements.satellite));
  if (!discovery) {
    throw new Error(`No JPL discovery row matches ${elements.satellite}.`);
  }
  matchedDiscoveries.add(discovery);
  return normalizeMoon({ discovery, elements });
});

const discoveryOnly = discoveryMoons.filter((record) =>
  !matchedDiscoveries.has(record));
const discoveryOnlyNames = discoveryOnly.map((record) =>
  record.name || record.provisionalDesignation);
if (discoveryOnlyNames.join("|") !== "S/2009 S1|S/2009 S2") {
  throw new Error(
    `Unexpected discovery-only Saturn moons: ${discoveryOnlyNames.join(", ")}.`,
  );
}
const s2009s2OrbitKm = parseS2009S2Orbit(s2009s2Html);
moons.push(
  discoveryOnlyMoon(discoveryOnly[0], {
    semiMajorAxisKm: 117_000,
    sourceRecord: "IAUC 9091",
    parameterQualification: "published-approximate-ring-moonlet-orbit",
  }),
  discoveryOnlyMoon(discoveryOnly[1], {
    semiMajorAxisKm: s2009s2OrbitKm,
    sourceRecord: "MPEC 2026-M19",
    parameterQualification: "published-approximate-ring-moonlet-orbit",
  }),
);
moons.sort((left, right) =>
  left.semiMajorAxisKm - right.semiMajorAxisKm ||
  left.name.localeCompare(right.name));

const ids = new Set(moons.map(({ id }) => id));
if (ids.size !== EXPECTED_DISCOVERY_COUNT) {
  throw new Error(`Saturn moon ids are not unique: ${ids.size}.`);
}

const snapshot = Object.freeze({
  schema: "csssaturn-moon-catalog@1",
  retrievedAt: PINNED_RETRIEVED_AT,
  sources: Object.freeze({
    discovery: sourceRecord(sources.discovery, discoveryHtml),
    elements: sourceRecord(sources.elements, elementsHtml),
    s2009s2: sourceRecord(sources.s2009s2, s2009s2Html),
  }),
  authority: Object.freeze({
    confirmedMoonCount: "JPL Solar System Dynamics discovery table",
    meanElements: "JPL Solar System Dynamics satellite mean elements",
    meanElementsEpoch: "2000-01-01.5 TDB",
    discoveryOnlyOrbitTreatment:
      "published approximate radius with Kepler-derived period and deterministic phase",
    saturnGmKm3PerS2: SATURN_GM_KM3_PER_S2,
  }),
  counts: Object.freeze({
    confirmed: discoveryMoons.length,
    withJplMeanElements: elementMoons.length,
    discoveryOnly: discoveryOnly.length,
  }),
  moons: Object.freeze(moons),
});

const outputEntry = saturnSourceManifest().inputs.find(({ path }) =>
  path === "moons/saturn-moons.json");
if (!outputEntry) throw new Error("Saturn moon catalog is not declared.");
await publishSourceBytes({
  destination: outputPath,
  bytes: Buffer.from(`${JSON.stringify(snapshot, null, 2)}\n`),
  entry: outputEntry,
  planetName: "Saturn",
});
await validateSaturnSourcePath("moons/saturn-moons.json");
console.log(`wrote ${outputPath} (${moons.length} Saturn moons)`);

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "css.earth prepared-data importer" },
  });
  if (!response.ok) {
    throw new Error(`Could not fetch ${url}: ${response.status}.`);
  }
  return response.text();
}

function parseDiscoveryRows(html) {
  const start = html.indexOf("Satellites of  Saturn:");
  const end = html.indexOf("Satellites of  Uranus:", start);
  if (start < 0 || end < 0) {
    throw new Error("JPL discovery Saturn table section is missing.");
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
    .filter((cells) => cells.length === 20 && cells[1] === "Saturn")
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
  if (!Number.isFinite(number)) {
    throw new Error(`Invalid JPL ${field}: ${value}.`);
  }
  return number;
}

function normalizeMoon({ discovery, elements }) {
  const name = discovery.name || discovery.provisionalDesignation;
  return Object.freeze({
    id: moonId(name),
    name,
    provisionalDesignation: discovery.provisionalDesignation,
    romanNumeral: discovery.romanNumeral,
    discoveryYear: discovery.discoveryYear,
    discoverers: discovery.discoverers,
    discoveryReference: discovery.reference,
    sourceRecord: `JPL element ${elements.recordId}`,
    parameterQualification: "JPL-mean-elements",
    code: elements.code,
    ephemeris: elements.ephemeris,
    frame: elements.frame,
    epoch: elements.epoch,
    semiMajorAxisKm: elements.semiMajorAxisKm,
    eccentricity: elements.eccentricity,
    argumentOfPeriapsisDeg: elements.argumentOfPeriapsisDeg,
    meanAnomalyDeg: elements.meanAnomalyDeg,
    inclinationDeg: elements.inclinationDeg,
    ascendingNodeDeg: elements.ascendingNodeDeg,
    periodDays: elements.periodDays,
    elementReference: elements.reference,
  });
}

function discoveryOnlyMoon(discovery, orbit) {
  const name = discovery.name || discovery.provisionalDesignation;
  const phase = deterministicPhase(name);
  return Object.freeze({
    id: moonId(name),
    name,
    provisionalDesignation: discovery.provisionalDesignation,
    romanNumeral: discovery.romanNumeral,
    discoveryYear: discovery.discoveryYear,
    discoverers: discovery.discoverers,
    discoveryReference: discovery.reference,
    sourceRecord: orbit.sourceRecord,
    parameterQualification: orbit.parameterQualification,
    code: null,
    ephemeris: null,
    frame: "Saturn ring plane",
    epoch: null,
    semiMajorAxisKm: orbit.semiMajorAxisKm,
    eccentricity: 0,
    argumentOfPeriapsisDeg: 0,
    meanAnomalyDeg: phase,
    inclinationDeg: 0,
    ascendingNodeDeg: 0,
    periodDays: keplerPeriodDays(orbit.semiMajorAxisKm),
    elementReference: null,
  });
}

function parseS2009S2Orbit(html) {
  const match = html.match(/distance of approximately\s+(\d+)\s+km/iu);
  if (!match) throw new Error("MPEC 2026-M19 orbital radius is missing.");
  return Number.parseInt(match[1], 10);
}

function keplerPeriodDays(semiMajorAxisKm) {
  const seconds = 2 * Math.PI * Math.sqrt(
    semiMajorAxisKm ** 3 / SATURN_GM_KM3_PER_S2,
  );
  return round(seconds / 86_400, 9);
}

function deterministicPhase(value) {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= character.codePointAt(0);
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }
  return round(hash / 2 ** 32 * 360, 6);
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

function round(value, precision) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}
