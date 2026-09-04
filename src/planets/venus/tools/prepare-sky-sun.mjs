#!/usr/bin/env node

import { requireObject } from "../../../../site/objects.mjs";
import { preparePlanetDirectionalSun } from
  "../../../platform/prepare-directional-sun.mjs";
import {
  ensureVenusPreparationDirectories,
  VENUS_PUBLIC_ROOT,
} from "./preparation-paths.mjs";

await preparePlanetDirectionalSun({
  objectId: "venus",
  publicRoot: VENUS_PUBLIC_ROOT,
  preparedModulePath: new URL("../runtime/preparedSkySun.mjs", import.meta.url),
  ensureDirectories: ensureVenusPreparationDirectories,
  meanHeliocentricDistanceAu: requireObject("venus").distanceAu,
});
