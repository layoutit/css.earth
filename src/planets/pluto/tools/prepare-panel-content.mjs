import { writeFile } from "node:fs/promises";
import { validatePlutoSourceGroup } from "./source-manifest.mjs";
import { readPlutoFacts } from "./physical-source.mjs";

await validatePlutoSourceGroup("panel");
const source = await readPlutoFacts();
const panel = {
  schema: "csspluto-prepared-panel@1",
  sourceUrl: source.sourceUrl,
  modified: source.modified,
  introduction: "Pluto is an icy dwarf planet in the Kuiper Belt. New Horizons revealed mountains, glaciers, and a heart-shaped plain during its 2015 flyby.",
  facts: [
    { label: "Radius", value: `${source.meanRadiusKm.toLocaleString("en-US")} km` },
    { label: "Sun distance", value: `${source.meanHeliocentricDistanceAu} AU (mean)` },
    { label: "Orbit", value: `${source.orbitalPeriodYears} years` },
    { label: "Density", value: `${source.meanDensityGPerCm3} g/cm³` },
  ],
  moreFacts: [
    { label: "Classification", value: "Dwarf planet" },
    { label: "Rotation", value: `${Math.abs(source.rotationDays)} days, retrograde` },
    { label: "Black map areas", value: "Unmapped, not shadow" },
    { label: "Elevation colors", value: "Blue −8 km · tan 0 · red +8 km", title: "USGS heights relative to a 1,188.3 km reference sphere. Colors are an authored display scale, not surface color." },
  ],
};
await writeFile(new URL("../site/preparedPanel.mjs", import.meta.url), "// Generated from Pluto-owned NASA and JPL source snapshots.\nexport const PREPARED_PLUTO_PANEL = Object.freeze(" + JSON.stringify(panel) + ");\n");
