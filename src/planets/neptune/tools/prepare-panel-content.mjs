#!/usr/bin/env node

import { writeFile } from "node:fs/promises";

import editorial from "../source/editorial/neptune.json" with { type: "json" };
import { validateNeptuneSourceGroup } from "./source-manifest.mjs";

await validateNeptuneSourceGroup("panel");
const size = section("Size and Distance");
const orbit = section("Orbit and Rotation");
const moons = section("Moons");
const rings = section("Rings");
const atmosphere = section("Atmosphere");
assertIncludes(editorial.introduction, "eighth and most distant planet");
assertIncludes(moons, "16 known moons");
assertIncludes(rings, "five main rings");
assertIncludes(atmosphere, "2,000 kilometers per hour");

const panel = deepFreeze({
  schema: "cssearth-prepared-panel@1",
  planetId: "neptune",
  introduction: "The eighth and most distant planet from the Sun. Neptune is a cold blue ice giant with supersonic winds, faint rings, and 16 known moons.",
  facts: [
    { label: "Distance", value: `${capture(size, /\((4\.5 billion) kilometers\)/u)} km` },
    { label: "Diameter", value: `${capture(size, /\((49,528) kilometers\)/u)} km` },
    { label: "Year", value: `${capture(orbit, /about (165) Earth years/u)} Earth yrs` },
    { label: "Day", value: `${capture(orbit, /takes about (16) hours/u)} hours` },
  ],
  moreFacts: [
    { label: "Light time", value: `${capture(size, /takes sunlight (4) hours/u)} hr` },
    { label: "Tilt", value: `${capture(orbit, /tilted (28) degrees/u)}°` },
    { label: "Moons", value: capture(moons, /Neptune has (16) known moons/u) },
    { label: "Main rings", value: capture(rings, /at least (five) main rings/u) },
    { label: "Wind", value: `${capture(atmosphere, /\((2,000) kilometers per hour\)/u)} km/h` },
    { label: "Discovery", value: capture(section("Introduction"), /discovery in (1846)/u) },
  ],
  moonCountPolicy: { editorial: 16, rendered: 16, rule: "NASA Science and the committed JPL discovery table both identify 16 moons." },
  sources: { editorial: { sourceId: editorial.sourceId, sourceUrl: editorial.sourceUrl, modified: editorial.modified, retrievedAt: editorial.retrievedAt, credit: editorial.credit } },
});
await writeFile(new URL("../site/preparedPanel.mjs", import.meta.url), `// Generated from the object-owned NASA Science snapshot.\nexport const PREPARED_NEPTUNE_PANEL = Object.freeze(${JSON.stringify(panel)});\n`);

function section(heading) {
  const value = editorial.sections.find((entry) => entry.heading === heading);
  if (!value) throw new Error(`Neptune editorial snapshot is missing ${heading}.`);
  return value.paragraphs.join(" ");
}
function capture(value, pattern) { const match = value.match(pattern); if (!match) throw new Error(`Neptune editorial fact no longer matches ${pattern}.`); return match[1]; }
function assertIncludes(value, fragment) { if (!value.includes(fragment)) throw new Error(`Neptune editorial fact is missing ${fragment}.`); }
function deepFreeze(value) { for (const child of Object.values(value)) if (child && typeof child === "object") deepFreeze(child); return Object.freeze(value); }

