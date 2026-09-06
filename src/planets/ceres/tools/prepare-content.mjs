import { readFile, writeFile } from "node:fs/promises";
import * as fontkit from "fontkit";
import { createPlanetTitleSource } from "../../../../tools/prepare-planet-title-sources.mjs";
import { PLANET_TITLE_RECIPE } from "../../../platform/planet-title-recipe.mjs";
import { createPreparedTitle, serializePreparedTitleModule, sha256 } from "../../../platform/prepared-title.mjs";
import { loadAstronomyPackage } from "../../../platform/astronomy-package.mjs";
import { validateCeresSourceGroup } from "./source-manifest.mjs";

await validateCeresSourceGroup("title");
const fontPath = new URL("../source/presentation/InterVariable.ttf", import.meta.url);
const fontBytes = await readFile(fontPath);
const font = fontkit.create(fontBytes).getVariation({ wght: PLANET_TITLE_RECIPE.weight, opsz: PLANET_TITLE_RECIPE.opticalSize });
const title = createPreparedTitle(createPlanetTitleSource("Ceres", font), {
  inputSha256: sha256(fontBytes), generator: "src/planets/ceres/tools/prepare-content.mjs",
});
await writeFile(new URL("../site/preparedTitle.mjs", import.meta.url), serializePreparedTitleModule("PREPARED_CERES_TITLE", title));
const { BODIES, dwarfPlanetElements, keplerPeriodDays } = await loadAstronomyPackage();
const facts = [
  { id: "radius", label: "Mean radius", value: `${BODIES.ceres.meanRadiusKm} km` },
  { id: "distance-from-sun", label: "Distance from Sun", value: "2.77 AU (mean)" },
  { id: "orbital-period", label: "Orbital period", value: `${(keplerPeriodDays(dwarfPlanetElements("ceres")) / 365.25).toFixed(2)} years` },
  { id: "rotation-period", label: "Rotation period", value: "About 9 hours" },
  { id: "moon-count", label: "Moons", value: "None" },
];
await writeFile(new URL("../site/preparedPanel.mjs", import.meta.url),
  `// Prepared from NASA Ceres facts and the vendored JPL astronomy data.\nexport const PREPARED_CERES_PANEL = Object.freeze(${JSON.stringify({
    introduction: "Ceres is the largest body in the asteroid belt. NASA's Dawn spacecraft mapped its cratered surface and bright salt deposits.", facts, moreFacts: [],
  })});\n`);
