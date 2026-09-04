#!/usr/bin/env node

import { readPlutoFacts } from "./physical-source.mjs";
import { preparePlanetDirectionalSun } from
  "../../../platform/prepare-directional-sun.mjs";
import {
  ensurePlutoPreparationDirectories,
  PLUTO_PUBLIC_ROOT,
} from "./preparation-paths.mjs";

await preparePlanetDirectionalSun({
  objectId: "pluto",
  publicRoot: PLUTO_PUBLIC_ROOT,
  preparedModulePath: new URL("../runtime/preparedSkySun.mjs", import.meta.url),
  ensureDirectories: ensurePlutoPreparationDirectories,
  meanHeliocentricDistanceAu: (await readPlutoFacts()).meanHeliocentricDistanceAu,
});
