#!/usr/bin/env node

import { requireObject } from "../../../../site/objects.mjs";
import { preparePlanetDirectionalSun } from
  "../../../platform/prepare-directional-sun.mjs";
import {
  ensureNeptunePreparationDirectories,
  NEPTUNE_PUBLIC_ROOT,
} from "./preparation-paths.mjs";

await preparePlanetDirectionalSun({
  objectId: "neptune",
  publicRoot: NEPTUNE_PUBLIC_ROOT,
  preparedModulePath: new URL("../runtime/preparedSkySun.mjs", import.meta.url),
  ensureDirectories: ensureNeptunePreparationDirectories,
  meanHeliocentricDistanceAu: requireObject("neptune").distanceAu,
});
