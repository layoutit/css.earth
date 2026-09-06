import { readFile, writeFile } from "node:fs/promises";
import * as fontkit from "fontkit";
import { createPlanetTitleSource, serializePlanetTitleSource } from "../../../../tools/prepare-planet-title-sources.mjs";
import { PLANET_TITLE_RECIPE } from "../../../platform/planet-title-recipe.mjs";
import { createPreparedTitle, serializePreparedTitleModule, sha256 } from "../../../platform/prepared-title.mjs";
import { loadAstronomyPackage } from "../../../platform/astronomy-package.mjs";
import { validateCallistoSourceGroup } from "./source-manifest.mjs";
await validateCallistoSourceGroup("title");
const bytes=await readFile(new URL("../source/presentation/InterVariable.ttf",import.meta.url));
const font=fontkit.create(bytes).getVariation({wght:PLANET_TITLE_RECIPE.weight,opsz:PLANET_TITLE_RECIPE.opticalSize});
const titleSource = createPlanetTitleSource("Callisto",font);
await writeFile(new URL("../source/presentation/title-mark.mjs",import.meta.url),serializePlanetTitleSource("CALLISTO_TITLE_SOURCE",titleSource));
const title=createPreparedTitle(titleSource,{inputSha256:sha256(bytes),generator:"src/planets/callisto/tools/prepare-content.mjs"});
await writeFile(new URL("../site/preparedTitle.mjs",import.meta.url),serializePreparedTitleModule("PREPARED_CALLISTO_TITLE",title));
const {BODIES,satelliteRecord,keplerPeriodDays}=await loadAstronomyPackage();
const period=keplerPeriodDays(satelliteRecord("callisto").elements).toFixed(2);
const panel={introduction:"Callisto is Jupiter’s outermost large moon. Bright impact craters cover its ancient icy surface, which may conceal a deep ocean.",facts:[
 {id:"radius",label:"Mean radius",value:`${BODIES.callisto.meanRadiusKm.toLocaleString("en-US")} km`},
 {id:"distance-from-sun",label:"Distance from Sun",value:"5.2 AU (mean)"},
 {id:"orbital-period",label:"Orbit around Jupiter",value:`${period} Earth days`},
 {id:"rotation-period",label:"Rotation period",value:`${period} Earth days`},
 {id:"distance-from-parent",label:"Distance from Jupiter",value:"About 1,883,000 km"},
 {id:"atmosphere",label:"Atmosphere",value:"Very thin carbon dioxide, oxygen and hydrogen exosphere"},
],moreFacts:[]};
await writeFile(new URL("../site/preparedPanel.mjs",import.meta.url),`// NASA Callisto facts and vendored JPL physical/orbital data; see SOURCE.md.\nexport const PREPARED_CALLISTO_PANEL = Object.freeze(${JSON.stringify(panel)});\n`);
