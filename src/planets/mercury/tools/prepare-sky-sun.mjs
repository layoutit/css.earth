#!/usr/bin/env node
import { requireObject } from "../../../../site/objects.mjs";
import { preparePlanetDirectionalSun } from "../../../platform/prepare-directional-sun.mjs";
import { prepareSolarSystemSunPresentation } from "../../../../tools/objects/solar-system-scene.mjs";
import solarSystemSource from "../source/presentation/solar-system.json" with { type: "json" };
import { ensureMercuryPreparationDirectories, MERCURY_PUBLIC_ROOT } from "./preparation-paths.mjs";
import { validateMercurySourceGroup } from "./source-manifest.mjs";

await validateMercurySourceGroup("sky-sun");
await preparePlanetDirectionalSun({
  objectId: solarSystemSource.bodyId, publicRoot: MERCURY_PUBLIC_ROOT,
  preparedModulePath: new URL("../runtime/preparedSkySun.mjs", import.meta.url),
  ensureDirectories: ensureMercuryPreparationDirectories,
  meanHeliocentricDistanceAu: requireObject(solarSystemSource.bodyId).distanceAu,
  presentation: prepareSolarSystemSunPresentation(solarSystemSource),
});
