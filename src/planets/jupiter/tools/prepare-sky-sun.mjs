#!/usr/bin/env node

import { requireObject } from "../../../../site/objects.mjs";
import { preparePlanetDirectionalSun } from
  "../../../platform/prepare-directional-sun.mjs";
import {
  ensureJupiterPreparationDirectories,
  JUPITER_PUBLIC_ROOT,
} from "./preparation-paths.mjs";

await preparePlanetDirectionalSun({
  objectId: "jupiter",
  publicRoot: JUPITER_PUBLIC_ROOT,
  preparedModulePath: new URL("../runtime/preparedSkySun.mjs", import.meta.url),
  ensureDirectories: ensureJupiterPreparationDirectories,
  meanHeliocentricDistanceAu: requireObject("jupiter").distanceAu,
});
