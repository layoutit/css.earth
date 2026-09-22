import { isRecord, requireRecord, requireArray, requireString } from './source-values.mts';
export interface ObjectInformationSource {id: string; sourceId: number; name: string; expectedTitle: string; sourceUrl: string; recordApiUrl: string; blocksApiUrl: string;}
export interface ObjectInformationSnapshot {schemaVersion: number; id: string; planet: string; title: string; sourceId: number; sourceUrl: string; recordApiUrl: string; blocksApiUrl: string; modified: string; retrievedAt: string; credit: string; introduction: string; sections: {heading: string; paragraphs: string[]}[];}
const NASA_API_ROOT = "https://science.nasa.gov/wp-json";

export const OBJECT_INFORMATION_SOURCES = Object.freeze([
  source("sun", 108082, "Sun", "Sun: Facts", "/sun/facts/"),
  source("mercury", 107747, "Mercury", "Mercury: Facts", "/mercury/facts/"),
  source("venus", 108123, "Venus", "Venus: Facts", "/venus/venus-facts/"),
  source("earth", 48583, "Earth", "Facts About Earth", "/earth/facts/"),
  source("moon", 108085, "Moon", "Moon Facts", "/moon/facts/"),
  source("mars", 107740, "Mars", "Mars: Facts", "/mars/facts/"),
  source("jupiter", 107551, "Jupiter", "Jupiter: Facts", "/jupiter/jupiter-facts/"),
  source("saturn", 107933, "Saturn", "Saturn: Facts", "/saturn/facts/"),
  source("uranus", 108091, "Uranus", "Uranus: Facts", "/uranus/facts/"),
  source("neptune", 107874, "Neptune", "Neptune: Facts", "/neptune/neptune-facts/"),
]);

export const SUN_INFORMATION_SOURCE = OBJECT_INFORMATION_SOURCES[0];

const SOURCES_BY_ID = new Map(OBJECT_INFORMATION_SOURCES.map((entry) =>
  [entry.id, entry]));

export function objectInformationSource(id: string) {
  const entry = SOURCES_BY_ID.get(id);
  if (!entry) {
    throw new RangeError(
      `Unknown object ${JSON.stringify(id)}. Expected one of: ${
        [...SOURCES_BY_ID.keys()].join(", ")}.`,
    );
  }
  return entry;
}

export function validateObjectInformationSnapshot(input: unknown): ObjectInformationSource {
  const snapshot = requireRecord(input, "Object information snapshot");
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new TypeError("Object information snapshot must be an object.");
  }
  const sourceEntry = objectInformationSource(requireString(snapshot.id, "Object information identity"));
  if (snapshot.schemaVersion !== 1 || snapshot.planet !== sourceEntry.name ||
      snapshot.title !== sourceEntry.expectedTitle ||
      snapshot.sourceId !== sourceEntry.sourceId ||
      snapshot.sourceUrl !== sourceEntry.sourceUrl ||
      snapshot.recordApiUrl !== sourceEntry.recordApiUrl ||
      snapshot.blocksApiUrl !== sourceEntry.blocksApiUrl ||
      !validDate(snapshot.modified) || !validDate(snapshot.retrievedAt) ||
      snapshot.credit !== "NASA Science" ||
      typeof snapshot.introduction !== "string" ||
      snapshot.introduction.length === 0 || !Array.isArray(snapshot.sections) ||
      snapshot.sections.length < 8) {
    throw new TypeError(
      `Object ${sourceEntry.id} editorial snapshot is incompatible.`,
    );
  }
  for (const value of requireArray(snapshot.sections)) {
    const section = requireRecord(value, "Planet editorial section");
    if (typeof section?.heading !== "string" || section.heading.length === 0 ||
        !Array.isArray(section.paragraphs) || section.paragraphs.length === 0 ||
        (section.paragraphs as unknown[]).some((paragraph) =>
          typeof paragraph !== "string" || paragraph.length === 0)) {
      throw new TypeError(
        `Object ${sourceEntry.id} editorial section is incompatible.`,
      );
    }
  }
  return sourceEntry;
}

function source(id: string, sourceId: number, name: string, expectedTitle: string, canonicalPath: string): ObjectInformationSource {
  return Object.freeze({
    id,
    sourceId,
    name,
    expectedTitle,
    sourceUrl: new URL(canonicalPath, "https://science.nasa.gov").href,
    recordApiUrl: `${NASA_API_ROOT}/wp/v2/topic/${sourceId}`,
    blocksApiUrl:
      `${NASA_API_ROOT}/vip-block-data-api/v1/posts/${sourceId}/blocks`,
  });
}

function validDate(value: unknown) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

export function requireObjectInformationSnapshot(input: unknown): ObjectInformationSnapshot {
  validateObjectInformationSnapshot(input);
  // Identity, timestamps and each section/paragraph are validated above.
  return input as ObjectInformationSnapshot;
}

// This NASA snapshot rule belongs to this provider, not the generic object package.
export function validateObjectEditorial(entry: {id: string; name: string}, input: unknown) {
  let editorial: ObjectInformationSnapshot;
  const source = objectInformationSource(entry.id);
  try {
    editorial = requireObjectInformationSnapshot(input);
  } catch (cause) {
    throw new TypeError(`Object ${entry.id} editorial snapshot is incompatible.`);
  }
  if (entry.name !== source.name || editorial.planet !== entry.name) {
    throw new TypeError(`Object ${entry.id} editorial snapshot is incompatible.`);
  }
  return true;
}
