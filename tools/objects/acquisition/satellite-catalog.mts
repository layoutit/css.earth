import { sha256 } from '../../../src/platform/sha256.mts';
import {requireRecord,requireString,requireFiniteNumber} from '../../sources/source-values.mts';
import {shape,text,number,optional,array,dictionary} from '../terrestrial-layers/source-records.mts';
const parseOrbit=shape({identity:text,document:optional(text),radiusPattern:optional(text),semiMajorAxisKm:optional(number),sourceRecord:text,parameterQualification:text});
const parseRecipe=shape({schema:text,outputSchema:text,retrievedAt:text,expectedDiscoveryCount:number,expectedElementCount:number,gravitationalParameterKm3PerS2:number,sources:dictionary(text),discoverySection:shape({start:text,end:text}),elementPrimary:text,ringFrame:text,discoveryOnly:array(parseOrbit),authority:(value:unknown)=>value});
/** Normalize declared JPL-format discovery/element tables and optional published approximate orbits. */
export function prepareSatelliteCatalog({config:configValue,documents}:{config:unknown;documents:Record<string,string>}) {
const config=validateSatelliteCatalogRecipe(configValue);
type Discovery=ReturnType<typeof parseDiscoveryRows>[number];
type Elements=ReturnType<typeof parseElementRows>[number];
const sources=config.sources,discoveryHtml=documents.discovery,elementsHtml=documents.elements;
const PINNED_RETRIEVED_AT=config.retrievedAt,EXPECTED_DISCOVERY_COUNT=config.expectedDiscoveryCount,EXPECTED_ELEMENT_COUNT=config.expectedElementCount,GRAVITATIONAL_PARAMETER_KM3_PER_S2=config.gravitationalParameterKm3PerS2;
const discoveryMoons = parseDiscoveryRows(discoveryHtml);
const elementMoons = parseElementRows(elementsHtml);
if (discoveryMoons.length !== EXPECTED_DISCOVERY_COUNT) {
  throw new Error(
    `JPL satellite discovery count drifted: ${discoveryMoons.length}.`,
  );
}
if (elementMoons.length !== EXPECTED_ELEMENT_COUNT) {
  throw new Error(`JPL satellite element count drifted: ${elementMoons.length}.`);
}

const discoveryByKey = new Map<string,Discovery>();
for (const record of discoveryMoons) {
  for (const identity of [record.name, record.provisionalDesignation]) {
    if (identity) discoveryByKey.set(identityKey(identity), record);
  }
}

const matchedDiscoveries = new Set<Discovery>();
const moons:(ReturnType<typeof normalizeMoon>|ReturnType<typeof discoveryOnlyMoon>)[] = elementMoons.map((elements) => {
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
if (discoveryOnlyNames.join("|") !== config.discoveryOnly.map(item=>item.identity).join("|")) {
  throw new Error(
    `Unexpected discovery-only satellite moons: ${discoveryOnlyNames.join(", ")}.`,
  );
}
for (let index=0;index<discoveryOnly.length;index++) {const orbit=config.discoveryOnly[index];const semiMajorAxisKm=orbit.document?parseApproximateOrbit(documents[orbit.document],requireString(orbit.radiusPattern)):requireFiniteNumber(orbit.semiMajorAxisKm);moons.push(discoveryOnlyMoon(discoveryOnly[index],{...orbit,semiMajorAxisKm}));}
moons.sort((left, right) =>
  left.semiMajorAxisKm - right.semiMajorAxisKm ||
  left.name.localeCompare(right.name));

const ids = new Set(moons.map(({ id }) => id));
if (ids.size !== EXPECTED_DISCOVERY_COUNT) {
  throw new Error(`satellite moon ids are not unique: ${ids.size}.`);
}

const snapshot = Object.freeze({
  schema: config.outputSchema,
  retrievedAt: PINNED_RETRIEVED_AT,
  sources: Object.freeze(Object.fromEntries(Object.entries(sources).map(([id,url])=>[id,sourceRecord(url,documents[id])]))),
  authority: config.authority,
  counts: Object.freeze({
    confirmed: discoveryMoons.length,
    withJplMeanElements: elementMoons.length,
    discoveryOnly: discoveryOnly.length,
  }),
  moons: Object.freeze(moons),
});

return snapshot;

function parseDiscoveryRows(html:string) {
  const start = html.indexOf(config.discoverySection.start);
  const end = html.indexOf(config.discoverySection.end, start);
  if (start < 0 || end < 0) {
    throw new Error("JPL discovery satellite table section is missing.");
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

function parseElementRows(html:string) {
  const table = html.match(
    /<table id="sat_elem"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/u,
  )?.[1];
  if (!table) throw new Error("JPL mean-elements table is missing.");
  return tableRows(table)
    .filter((cells) => cells.length === 20 && cells[1] === config.elementPrimary)
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

function tableRows(html:string) {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gu)].map((row) =>
    [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gu)]
      .map((cell) => plainText(cell[1])));
}

function plainText(html:string) {
  return html
    .replace(/<br\s*\/?\s*>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/gu, " ")
    .replace(/&amp;/gu, "&")
    .replace(/&#x2F;/gu, "/")
    .replace(/\s+/gu, " ")
    .trim();
}

function numericCell(value:string, field:string) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`Invalid JPL ${field}: ${value}.`);
  }
  return number;
}

function normalizeMoon({ discovery, elements }:{discovery:Discovery;elements:Elements}) {
  const name = requireString(discovery.name || discovery.provisionalDesignation);
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

function discoveryOnlyMoon(discovery:Discovery, orbit:ReturnType<typeof parseOrbit>&{semiMajorAxisKm:number}) {
  const name = requireString(discovery.name || discovery.provisionalDesignation);
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
    frame: config.ringFrame,
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

function parseApproximateOrbit(html:string,pattern:string) {
  const match = html.match(new RegExp(pattern,"iu"));
  if (!match) throw new Error("Approximate orbital radius is missing.");
  return Number.parseInt(match[1], 10);
}

function keplerPeriodDays(semiMajorAxisKm:number) {
  const seconds = 2 * Math.PI * Math.sqrt(
    semiMajorAxisKm ** 3 / GRAVITATIONAL_PARAMETER_KM3_PER_S2,
  );
  return round(seconds / 86_400, 9);
}

function deterministicPhase(value:string) {
  let hash = 2_166_136_261;
  for (const character of value) {
    hash ^= requireFiniteNumber(character.codePointAt(0));
    hash = Math.imul(hash, 16_777_619) >>> 0;
  }
  return round(hash / 2 ** 32 * 360, 6);
}

function identityKey(value:string) {
  return value.toLowerCase().replace(/[^a-z0-9]/gu, "");
}

function moonId(value:string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-|-$/gu, "");
}

function sourceRecord(url:string, body:string) {
  return Object.freeze({
    url,
    sha256: sha256(body),
  });
}

function round(value:number, precision:number) {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

}

export function validateSatelliteCatalogRecipe(value:unknown) {
const input=requireRecord(value),config={...input,...parseRecipe(input)};
if(config?.schema!=='cssearth-satellite-catalog-acquisition@1'||typeof config.outputSchema!=='string'||typeof config.retrievedAt!=='string'||!Number.isInteger(config.expectedDiscoveryCount)||config.expectedDiscoveryCount<1||!Number.isInteger(config.expectedElementCount)||config.expectedElementCount<0||!Number.isFinite(config.gravitationalParameterKm3PerS2)||config.gravitationalParameterKm3PerS2<=0||!Array.isArray(config.discoveryOnly))throw new TypeError('Invalid satellite catalog recipe.');
for(const url of Object.values(config.sources))if(typeof url!=='string'||!/^https?:\/\//.test(url))throw new TypeError('Invalid catalog authority URL.');
for(const field of ['start','end'] as const)if(typeof config.discoverySection[field]!=='string'||!config.discoverySection[field])throw new TypeError('Invalid discovery section.');
for(const item of config.discoveryOnly){if(typeof item.identity!=='string'||!item.identity||item.document&&(!config.sources[item.document]||typeof item.radiusPattern!=='string')||!item.document&&(item.semiMajorAxisKm===undefined||!Number.isFinite(item.semiMajorAxisKm)||item.semiMajorAxisKm<=0))throw new TypeError('Invalid approximate satellite orbit.');}
return config;
}
