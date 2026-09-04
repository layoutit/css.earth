import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const information = JSON.parse(await readFile(
  new URL("../../../../data/planets/jupiter.json", import.meta.url),
  "utf8",
));

test("keeps the prepared NASA Jupiter record local and identified", () => {
  assert.equal(information.schemaVersion, 1);
  assert.equal(information.id, "jupiter");
  assert.equal(information.planet, "Jupiter");
  assert.equal(information.title, "Jupiter: Facts");
  assert.equal(information.sourceId, 107551);
  assert.equal(information.sourceUrl,
    "https://science.nasa.gov/jupiter/jupiter-facts/");
  assert.equal(information.credit, "NASA Science");
  assert.match(information.modified, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(information.retrievedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(
    information.recordApiUrl,
    "https://science.nasa.gov/wp-json/wp/v2/topic/107551",
  );
  assert.equal(
    information.blocksApiUrl,
    "https://science.nasa.gov/wp-json/vip-block-data-api/v1/posts/107551/blocks",
  );
});

test("retains the complete selected Jupiter editorial sections", () => {
  assert.match(information.introduction, /largest planet in our solar system/);
  assert.deepEqual(information.sections.map(({ heading }) => heading), [
    "Introduction",
    "Namesake",
    "Potential for Life",
    "Size and Distance",
    "Orbit and Rotation",
    "Moons",
    "Rings",
    "Formation",
    "Structure",
    "Surface",
    "Atmosphere",
    "Magnetosphere",
  ]);
  for (const section of information.sections) {
    assert.ok(section.paragraphs.length > 0, `${section.heading} must contain text`);
  }
  assert.match(section("Size and Distance"), /778 million kilometers/);
  assert.match(section("Orbit and Rotation"), /9\.9 hours/);
  assert.match(section("Orbit and Rotation"), /4,333 Earth days/);
  assert.match(section("Moons"), /Io, Europa, Ganymede, and Callisto/);
});

function section(heading) {
  return information.sections
    .find((candidate) => candidate.heading === heading)
    .paragraphs.join(" ");
}
