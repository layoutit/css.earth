import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const information = JSON.parse(await readFile(
  new URL("../../../../data/planets/mars.json", import.meta.url),
  "utf8",
));

test("keeps the prepared NASA Mars record local and identified", () => {
  assert.equal(information.schemaVersion, 1);
  assert.equal(information.id, "mars");
  assert.equal(information.planet, "Mars");
  assert.equal(information.title, "Mars: Facts");
  assert.equal(information.sourceId, 107740);
  assert.equal(information.sourceUrl, "https://science.nasa.gov/mars/facts/");
  assert.equal(information.credit, "NASA Science");
  assert.match(information.modified, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(information.retrievedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(
    information.recordApiUrl,
    "https://science.nasa.gov/wp-json/wp/v2/topic/107740",
  );
  assert.equal(
    information.blocksApiUrl,
    "https://science.nasa.gov/wp-json/vip-block-data-api/v1/posts/107740/blocks",
  );
});

test("retains the complete selected Mars editorial sections", () => {
  assert.match(information.introduction, /fourth planet from the Sun/);
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
  assert.match(section("Size and Distance"), /228 million kilometers/);
  assert.match(section("Orbit and Rotation"), /24\.6 hours/);
  assert.match(section("Orbit and Rotation"), /687 Earth days/);
  assert.match(section("Moons"), /Phobos and Deimos/);
});

function section(heading) {
  return information.sections
    .find((candidate) => candidate.heading === heading)
    .paragraphs.join(" ");
}
