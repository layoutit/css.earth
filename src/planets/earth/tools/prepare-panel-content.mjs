#!/usr/bin/env node

import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validatePlanetInformationSnapshot } from "../../../../tools/planet-information-sources.mjs";
import { validateEarthSourceGroup } from "./source-manifest.mjs";

await Promise.all([
  validateEarthSourceGroup("panel"),
  validateEarthSourceGroup("moon"),
]);
const [editorial, moon] = await Promise.all([
  readFile(resolve(import.meta.dirname, "../../../../data/planets/earth.json"), "utf8").then(JSON.parse),
  readFile(resolve(import.meta.dirname, "../source/moon/earth-moon.json"), "utf8").then(JSON.parse),
]);
validatePlanetInformationSnapshot(editorial);
if (moon.schema !== "cssearth-earth-moon-source@1") throw new Error("Earth-Moon facts are incompatible.");
const required = [
  ["Size and Distance", "12,756 kilometers"],
  ["Orbit and Rotation", "23.9 hours"],
  ["Orbit and Rotation", "365.25 days"],
  ["Surface", "71%"],
  ["Atmosphere", "78% nitrogen"],
];
for (const [heading, evidence] of required) {
  const section = editorial.sections.find((candidate) => candidate.heading === heading);
  if (!section?.paragraphs.some((paragraph) => paragraph.includes(evidence))) {
    throw new Error(`NASA Earth editorial evidence drifted for ${heading}: ${evidence}.`);
  }
}
const sectionText = (heading) => editorial.sections
  .find((section) => section.heading === heading)?.paragraphs.join(" ") ?? "";
const sizeAndDistance = sectionText("Size and Distance");
const orbitAndRotation = sectionText("Orbit and Rotation");
const surface = sectionText("Surface");
const atmosphere = sectionText("Atmosphere");
const moons = sectionText("Moons");
const rings = sectionText("Rings");
const diameterKm = capture(sizeAndDistance,
  /equatorial diameter[^()]*\(([\d,]+) kilometers\)/u,
  "equatorial diameter");
const distanceKm = capture(sizeAndDistance,
  /average distance[^()]*\(([\d]+) million kilometers\)/u,
  "average distance");
const dayHours = capture(orbitAndRotation,
  /rotation every ([\d.]+ hours)/u,
  "rotation period");
const yearDays = capture(orbitAndRotation,
  /takes ([\d.]+ days) to complete one trip/u,
  "orbital period");
const axialTilt = capture(orbitAndRotation,
  /tilted ([\d.]+ degrees)/u,
  "axial tilt").replace(" degrees", "°");
const oceanCoverage = capture(surface,
  /covers about ([\d]+%)/u,
  "ocean coverage");
const nitrogen = capture(atmosphere, /consists of ([\d]+% nitrogen)/u,
  "nitrogen fraction");
const oxygen = capture(atmosphere, /, ([\d]+% oxygen)/u,
  "oxygen fraction");
if (!/only one moon/u.test(moons) || !/Earth has no rings\./u.test(rings)) {
  throw new Error("NASA Earth moon or ring evidence drifted.");
}
const introduction = editorial.introduction.replace(
  "Earth – our home planet –",
  "Earth (our home planet)",
);
if (introduction === editorial.introduction) {
  throw new Error("NASA Earth introduction no longer contains the prepared aside.");
}
const panel = Object.freeze({
  schema: "cssearth-prepared-panel@1",
  planetId: "earth",
  introduction,
  facts: Object.freeze([
    { label: "Distance", value: `${distanceKm} million km` },
    { label: "Diameter", value: `${diameterKm} km` },
    { label: "Year", value: yearDays },
    { label: "Day", value: dayHours },
  ]),
  moreFacts: Object.freeze([
    { label: "Moon", value: "1" },
    { label: "Moon distance", value: `${moon.meanOrbitRadiusKm.toLocaleString("en-US")} km` },
    { label: "Axial tilt", value: axialTilt },
    { label: "Ocean coverage", value: oceanCoverage },
    { label: "Atmosphere", value: `${nitrogen.replace(" nitrogen", " N₂")}, ${oxygen.replace(" oxygen", " O₂")}` },
    { label: "Rings", value: "None" },
  ]),
  sources: Object.freeze({
    editorial: Object.freeze({
      sourceId: editorial.sourceId,
      sourceUrl: editorial.sourceUrl,
      modified: editorial.modified,
      retrievedAt: editorial.retrievedAt,
      credit: editorial.credit,
    }),
    moon: moon.sources,
  }),
});
await writeFile(
  resolve(import.meta.dirname, "../site/preparedPanel.mjs"),
  "// Generated from checked Earth sources. Do not edit by hand.\n" +
    `export const PREPARED_EARTH_PANEL = Object.freeze(${JSON.stringify(panel)});\n`,
);

function capture(text, pattern, label) {
  const match = pattern.exec(text);
  if (!match?.[1]) throw new Error(`NASA Earth ${label} evidence drifted.`);
  return match[1];
}
