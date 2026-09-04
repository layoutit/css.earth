#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const physicalPath = resolve(import.meta.dirname, "../source/moon/jpl-satellite-physical.html");
const elementsPath = resolve(import.meta.dirname, "../source/moon/jpl-satellite-elements.html");
const outputPath = resolve(import.meta.dirname, "../source/moon/earth-moon.json");
const [physical, elements] = await Promise.all([
  readFile(physicalPath, "utf8"),
  readFile(elementsPath, "utf8"),
]);

const physicalPattern = /Satellites of Earth[\s\S]*?Planet GM:<\/b>\s*398600\.436[\s\S]*?<td class="text-left">Moon<\/td>\s*<td class="text-center">\s*4902\.800[^<]*[\s\S]*?<td class="text-center">\s*1737\.4[^<]*[\s\S]*?<td class="text-center">\s*3\.344/iu;
const elementsPattern = /Satellites of Earth[\s\S]*?<td>Moon<\/td>\s*<td>301<\/td>\s*<td class="text-center">384400\.<\/td>\s*<td class="text-center">0\.0554<\/td>\s*<td class="text-center">318\.15<\/td>\s*<td class="text-center">135\.27<\/td>\s*<td class="text-center">5\.16<\/td>\s*<td class="text-center">125\.08<\/td>\s*<td class="text-center">27\.322/iu;
if (!physicalPattern.test(physical) || !elementsPattern.test(elements)) {
  throw new Error("JPL Earth-Moon source tables drifted from the checked schema.");
}

const moon = Object.freeze({
  schema: "cssearth-earth-moon-source@1",
  epoch: "2000-01-01.5 TDB",
  earthGmKm3PerS2: 398600.436,
  id: "moon",
  naifId: 301,
  meanOrbitRadiusKm: 384400,
  eccentricity: 0.0554,
  inclinationDegrees: 5.16,
  longitudeAscendingNodeDegrees: 125.08,
  orbitalPeriodDays: 27.322,
  gmKm3PerS2: 4902.8,
  meanRadiusKm: 1737.4,
  meanDensityGPerCm3: 3.344,
  sources: {
    physical: {
      url: "https://ssd.jpl.nasa.gov/sats/phys_par/sep.html",
      sha256: createHash("sha256").update(physical).digest("hex"),
    },
    elements: {
      url: "https://ssd.jpl.nasa.gov/sats/elem/sep.html",
      sha256: createHash("sha256").update(elements).digest("hex"),
    },
  },
});
await writeFile(outputPath, `${JSON.stringify(moon, null, 2)}\n`);
console.log(`Prepared checked Earth-Moon facts -> ${outputPath}`);
