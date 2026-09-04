#!/usr/bin/env node

import { requireObject } from "../../../../site/objects.mjs";
import { preparePlanetDirectionalSun } from
  "../../../platform/prepare-directional-sun.mjs";
import {
  ensureMercuryPreparationDirectories,
  MERCURY_PUBLIC_ROOT,
} from "./preparation-paths.mjs";

await preparePlanetDirectionalSun({
  objectId: "mercury",
  publicRoot: MERCURY_PUBLIC_ROOT,
  preparedModulePath: new URL("../runtime/preparedSkySun.mjs", import.meta.url),
  ensureDirectories: ensureMercuryPreparationDirectories,
  meanHeliocentricDistanceAu: requireObject("mercury").distanceAu,
});
