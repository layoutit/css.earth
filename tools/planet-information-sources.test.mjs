import assert from "node:assert/strict";
import test from "node:test";

import {
  PLANET_INFORMATION_SOURCES,
  planetInformationSource,
  validatePlanetInformationSnapshot,
} from "./planet-information-sources.mjs";

test("owns the exact NASA Science records for every renderable object", () => {
  assert.deepEqual(
    PLANET_INFORMATION_SOURCES.map(({ id, sourceId }) => [id, sourceId]),
    [
      ["sun", 108082],
      ["mercury", 107747],
      ["venus", 108123],
      ["earth", 48583],
      ["moon", 108085],
      ["mars", 107740],
      ["jupiter", 107551],
      ["saturn", 107933],
      ["uranus", 108091],
      ["neptune", 107874],
    ],
  );
  assert.equal(planetInformationSource("earth").expectedTitle, "Facts About Earth");
});

test("rejects snapshots that drift from exact source identity", () => {
  const valid = snapshot("earth");
  assert.equal(validatePlanetInformationSnapshot(valid).id, "earth");
  assert.throws(
    () => validatePlanetInformationSnapshot({ ...valid, title: "Earth: Facts" }),
    /snapshot is incompatible/,
  );
  assert.throws(
    () => validatePlanetInformationSnapshot({ ...valid, sourceUrl: "https://example.test/" }),
    /snapshot is incompatible/,
  );
  assert.throws(
    () => validatePlanetInformationSnapshot({ ...valid, sections: [] }),
    /snapshot is incompatible/,
  );
});

function snapshot(id) {
  const source = planetInformationSource(id);
  return {
    schemaVersion: 1,
    id,
    planet: source.name,
    title: source.expectedTitle,
    introduction: "Prepared introduction.",
    sections: Array.from({ length: 8 }, (_, index) => ({
      heading: `Section ${index + 1}`,
      paragraphs: ["Prepared paragraph."],
    })),
    sourceUrl: source.sourceUrl,
    sourceId: source.sourceId,
    modified: "2026-08-29T12:00:00",
    retrievedAt: "2026-08-30",
    credit: "NASA Science",
    recordApiUrl: source.recordApiUrl,
    blocksApiUrl: source.blocksApiUrl,
  };
}
