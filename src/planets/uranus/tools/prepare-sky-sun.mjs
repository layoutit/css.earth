#!/usr/bin/env node

import { requireObject } from "../../../../site/objects.mjs";
import { preparePlanetDirectionalSun } from
  "../../../platform/prepare-directional-sun.mjs";
import {
  ensureUranusPreparationDirectories,
  URANUS_PUBLIC_ROOT,
} from "./preparation-paths.mjs";

await preparePlanetDirectionalSun({
  objectId: "uranus",
  publicRoot: URANUS_PUBLIC_ROOT,
  preparedModulePath: new URL("../runtime/preparedSkySun.mjs", import.meta.url),
  ensureDirectories: ensureUranusPreparationDirectories,
  meanHeliocentricDistanceAu: requireObject("uranus").distanceAu,
});
