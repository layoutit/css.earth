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
  introduction: "Uranus is a cold, windy ice giant with 13 faint rings. Its extreme 97.77-degree tilt makes the planet appear to spin on its side.",
  facts: [
    { label: "Distance", value: `${capture(size, /\((2\.9 billion) kilometers\)/u)} km` },
    { label: "Diameter", value: `${capture(size, /\((51,118) kilometers\)/u)} km` },
    { label: "Year", value: `${capture(orbit, /about (84) Earth years/u)} Earth yrs` },
    { label: "Day", value: `${capture(orbit, /about (17) hours/u)} hours` },
  ],
  moreFacts: [
    { label: "Light time", value: "2 h 40 min" },
    { label: "Tilt", value: `${capture(orbit, /tilt of (97\.77) degrees/u)}°` },
    {
      label: "Moons",
      value: capture(moons, /Uranus has (28) known moons/u),
      title: "NASA Science editorial snapshot: 28 known moons. The rendered JPL snapshot contains 29 satellites, including S/2025 U1.",
    },
    { label: "Rings", value: "13", title: "Named ring sequence in NASA Science and the PDS Rings Node table" },
    { label: "Minimum", value: `${capture(atmosphere, /minimum temperature of (49) K/u)} K` },
    { label: "Wind", value: `${capture(atmosphere, /\((900) kilometers per hour\)/u)} km/h` },
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
