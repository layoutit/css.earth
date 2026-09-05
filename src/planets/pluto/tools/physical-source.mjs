import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Preparation only. Parse the checked provider pages; never fetch facts at runtime.
export async function readPlutoFacts() {
  const [jpl, nasa] = await Promise.all([
    readFile(new URL("../source/orbit/jpl-physical.html", import.meta.url), "utf8"),
    readFile(new URL("../source/editorial/nasa-pluto.json", import.meta.url), "utf8").then(JSON.parse),
  ]);
  return parsePlutoFacts(jpl, nasa);
}

export function parsePlutoFacts(jpl, nasa) {
  assert.equal(nasa.id, 107487);
  assert.equal(nasa.title.rendered, "Pluto: Facts");
  assert.equal(nasa.link, "https://science.nasa.gov/dwarf-planets/pluto/facts/");
  const row = jpl.match(/<tr>\s*<td><b>Pluto<\/b><\/td>([\s\S]*?)<\/tr>/u)?.[1];
  assert.ok(row, "JPL Pluto physical row is missing");
  const values = [...row.matchAll(/<td[^>]*>\s*([-\d.]+)/gu)].map((m) => Number(m[1]));
  assert.deepEqual(values.slice(0, 6), [1188.3, 1188.3, 13024.6, 1.853, -6.3872, 247.92065]);
  const text = nasa.content.rendered.replace(/<[^>]*>/gu, " ").replace(/\s+/gu, " ");
  assert.match(text, /or 39 AU/u);
  assert.match(text, /tilted 57 degrees/u);
  assert.match(text, /retrograde rotation/u);
  assert.match(text, /five known moons/u);
  return Object.freeze({
    meanRadiusKm: values[1], meanDensityGPerCm3: values[3],
    rotationDays: values[4], orbitalPeriodYears: values[5],
    meanHeliocentricDistanceAu: 39, displayAxisTiltDegrees: 57,
    sourceUrl: nasa.link, modified: nasa.modified,
  });
}
