import { readFile, writeFile } from "node:fs/promises";
import * as fontkit from "fontkit";
import { createPlanetTitleSource, serializePlanetTitleSource } from "../../../../tools/prepare-planet-title-sources.mjs";
import { PLANET_TITLE_RECIPE } from "../../../platform/planet-title-recipe.mjs";
import { createPreparedTitle, serializePreparedTitleModule, sha256 } from "../../../platform/prepared-title.mjs";
import { loadAstronomyPackage } from "../../../platform/astronomy-package.mjs";
import { validateEuropaSourceGroup } from "./source-manifest.mjs";
await validateEuropaSourceGroup("title");
const bytes=await readFile(new URL("../source/presentation/InterVariable.ttf",import.meta.url));
const font=fontkit.create(bytes).getVariation({wght:PLANET_TITLE_RECIPE.weight,opsz:PLANET_TITLE_RECIPE.opticalSize});
const titleSource = createPlanetTitleSource("Europa",font);
await writeFile(new URL("../source/presentation/title-mark.mjs",import.meta.url),serializePlanetTitleSource("EUROPA_TITLE_SOURCE",titleSource));
const title=createPreparedTitle(titleSource,{inputSha256:sha256(bytes),generator:"src/planets/europa/tools/prepare-content.mjs"});
await writeFile(new URL("../site/preparedTitle.mjs",import.meta.url),serializePreparedTitleModule("PREPARED_EUROPA_TITLE",title));
const {BODIES,satelliteRecord,keplerPeriodDays}=await loadAstronomyPackage();
const period=keplerPeriodDays(satelliteRecord("europa").elements).toFixed(2);
const panel={introduction:"Europa is an icy moon of Jupiter. Its fractured surface and magnetic signature provide strong evidence for a salty ocean beneath the ice.",facts:[
 {id:"radius",label:"Mean radius",value:`${BODIES.europa.meanRadiusKm.toLocaleString("en-US")} km`},
 {id:"distance-from-sun",label:"Distance from Sun",value:"5.2 AU (mean)"},
 {id:"orbital-period",label:"Orbit around Jupiter",value:`${period} Earth days`},
 {id:"rotation-period",label:"Rotation period",value:`${period} Earth days`},
 {id:"distance-from-parent",label:"Distance from Jupiter",value:"About 671,000 km"},
 {id:"atmosphere",label:"Atmosphere",value:"Tenuous oxygen"},
],moreFacts:[]};
await writeFile(new URL("../site/preparedPanel.mjs",import.meta.url),`// NASA Europa facts and vendored JPL physical/orbital data; see SOURCE.md.\nexport const PREPARED_EUROPA_PANEL = Object.freeze(${JSON.stringify(panel)});\n`);
