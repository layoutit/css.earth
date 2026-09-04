const NASA_API_ROOT = "https://science.nasa.gov/wp-json";

export const PLANET_INFORMATION_SOURCES = Object.freeze([
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

export const SUN_INFORMATION_SOURCE = PLANET_INFORMATION_SOURCES[0];

const SOURCES_BY_ID = new Map(PLANET_INFORMATION_SOURCES.map((entry) =>
  [entry.id, entry]));

export function planetInformationSource(id) {
  const entry = SOURCES_BY_ID.get(id);
  if (!entry) {
    throw new RangeError(
      `Unknown planet ${JSON.stringify(id)}. Expected one of: ${
        [...SOURCES_BY_ID.keys()].join(", ")}.`,
    );
  }
  return entry;
}

export function validatePlanetInformationSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    throw new TypeError("Planet information snapshot must be an object.");
  }
  const sourceEntry = planetInformationSource(snapshot.id);
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
      `Planet ${sourceEntry.id} editorial snapshot is incompatible.`,
    );
  }
  for (const section of snapshot.sections) {
    if (typeof section?.heading !== "string" || section.heading.length === 0 ||
        !Array.isArray(section.paragraphs) || section.paragraphs.length === 0 ||
        section.paragraphs.some((paragraph) =>
          typeof paragraph !== "string" || paragraph.length === 0)) {
      throw new TypeError(
        `Planet ${sourceEntry.id} editorial section is incompatible.`,
      );
    }
  }
  return sourceEntry;
}

function source(id, sourceId, name, expectedTitle, canonicalPath) {
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

function validDate(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}
