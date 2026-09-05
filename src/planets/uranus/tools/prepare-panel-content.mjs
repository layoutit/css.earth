#!/usr/bin/env node

import { writeFile } from "node:fs/promises";

import editorial from "../../../../data/planets/uranus.json" with { type: "json" };

const output = new URL("../site/preparedPanel.mjs", import.meta.url);
const size = sectionText("Size and Distance");
const orbit = sectionText("Orbit and Rotation");
const moons = sectionText("Moons");
const rings = sectionText("Rings");
const atmosphere = sectionText("Atmosphere");

assertIncludes(editorial.introduction, "very cold and windy world");
assertIncludes(rings, "Epsilon, Nu, and Mu");
assertIncludes(atmosphere, "900 kilometers per hour");

const panel = Object.freeze({
  schema: "cssearth-prepared-panel@1",
  planetId: "uranus",
  introduction: "Uranus is a cold, windy ice giant whose unusual orientation makes it appear to spin on its side.",
  facts: [
    { id: "distance-from-sun", label: "Distance from Sun", value: `${capture(size, /\((2\.9 billion) kilometers\)/u)} km` },
    { id: "diameter", label: "Diameter", value: `${capture(size, /\((51,118) kilometers\)/u)} km` },
    { id: "orbital-period", label: "Orbital period", value: `${capture(orbit, /about (84) Earth years/u)} Earth years` },
    { id: "rotation-period", label: "Rotation period", value: `${capture(orbit, /about (17) hours/u)} hours` },
    { id: "axial-tilt", label: "Axial tilt", value: `${capture(orbit, /tilt of (97\.77) degrees/u)}°` },
    { id: "moon-count", label: "Moons", value: capture(moons, /Uranus has (28) known moons/u) },
    { id: "ring-system", label: "Rings", value: "Present" },
  ],
  moreFacts: [
    { id: "minimum-temperature", label: "Minimum temperature", value: `${capture(atmosphere, /minimum temperature of (49) K/u)} K` },
    { id: "wind-speed", label: "Wind", value: `${capture(atmosphere, /\((900) kilometers per hour\)/u)} km/h` },
  ],
  moonCountPolicy: {
    editorial: 28,
    rendered: 29,
    renderedRetrievedAt: "2026-08-30",
    rule: "Keep NASA's dated editorial value and identify the newer rendered JPL count separately.",
  },
  sources: {
    editorial: {
      sourceId: editorial.sourceId,
      sourceUrl: editorial.sourceUrl,
      modified: editorial.modified,
      retrievedAt: editorial.retrievedAt,
      credit: editorial.credit,
    },
  },
});

await writeFile(
  output,
  `// Generated from declared local sources.\nexport const PREPARED_URANUS_PANEL = Object.freeze(${JSON.stringify(panel)});\n`,
);

function sectionText(heading) {
  const section = editorial.sections.find((entry) => entry.heading === heading);
  if (!section) throw new Error(`Uranus editorial snapshot is missing ${heading}.`);
  return section.paragraphs.join(" ");
}

function capture(text, pattern) {
  const match = text.match(pattern);
  if (!match) throw new Error(`Uranus editorial fact no longer matches ${pattern}.`);
  return match[1];
}

function assertIncludes(text, value) {
  if (!text.includes(value)) throw new Error(`Uranus editorial fact is missing ${value}.`);
}
