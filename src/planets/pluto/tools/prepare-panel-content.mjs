import { writeFile } from "node:fs/promises";
import { validatePlutoSourceGroup } from "./source-manifest.mjs";
import { readPlutoFacts } from "./physical-source.mjs";

await validatePlutoSourceGroup("panel");
const source = await readPlutoFacts();
const panel = {
  schema: "csspluto-prepared-panel@1",
  planetId: "pluto",
  sourceUrl: source.sourceUrl,
  modified: source.modified,
  introduction: "Pluto is an icy dwarf planet in the Kuiper Belt. New Horizons revealed mountains, glaciers, and a heart-shaped plain during its 2015 flyby.",
  facts: [
    { id: "distance-from-sun", label: "Distance from Sun", value: `${source.meanHeliocentricDistanceAu} AU (mean)` },
    { id: "radius", label: "Radius", value: `${source.meanRadiusKm.toLocaleString("en-US")} km` },
    { id: "orbital-period", label: "Orbital period", value: `${source.orbitalPeriodYears} years` },
    { id: "rotation-period", label: "Rotation period", value: `${Math.abs(source.rotationDays)} days, retrograde` },
    { id: "axial-tilt", label: "Axial tilt", value: `${source.displayAxisTiltDegrees}°` },
    { id: "moon-count", label: "Moons", value: String(source.moonCount) },
    { id: "ring-system", label: "Rings", value: source.ringCount === 0 ? "None" : "Present" },
  ],
  moreFacts: [],
};
await writeFile(new URL("../site/preparedPanel.mjs", import.meta.url), "// Generated from Pluto-owned NASA and JPL source snapshots.\nexport const PREPARED_PLUTO_PANEL = Object.freeze(" + JSON.stringify(panel) + ");\n");
