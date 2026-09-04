#!/usr/bin/env node

import { requireObject } from "../../../../site/objects.mjs";
import { preparePlanetDirectionalSun } from
  "../../../platform/prepare-directional-sun.mjs";
import {
  EARTH_PUBLIC_ROOT,
  ensureEarthPreparationDirectories,
} from "./preparation-paths.mjs";

await preparePlanetDirectionalSun({
  objectId: "earth",
  publicRoot: EARTH_PUBLIC_ROOT,
  preparedModulePath: new URL("../runtime/preparedSkySun.mjs", import.meta.url),
  ensureDirectories: ensureEarthPreparationDirectories,
  meanHeliocentricDistanceAu: requireObject("earth").distanceAu,
});
