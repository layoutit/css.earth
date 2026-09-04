#!/usr/bin/env node

import {
  CUBIC_SKY_CAMERA_PRESENTATION_STANDARD,
  CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD,
} from "../../../platform/cubic-sky-contract.mjs";
import { preparePlanetCubicSky } from
  "../../../platform/prepare-cubic-sky-source.mjs";
import {
  ensureJupiterPreparationDirectories,
  JUPITER_PUBLIC_ROOT,
  JUPITER_SOURCE_ROOT,
} from "./preparation-paths.mjs";
import { validateJupiterSourceGroup } from "./source-manifest.mjs";

await preparePlanetCubicSky({
  objectId: "jupiter",
  sourceRoot: JUPITER_SOURCE_ROOT,
  publicRoot: JUPITER_PUBLIC_ROOT,
  preparedModulePath: new URL("../runtime/preparedStarfield.mjs", import.meta.url),
  ensureDirectories: ensureJupiterPreparationDirectories,
  validateSourceGroup: validateJupiterSourceGroup,
  includeSun: false,
  cameraContract: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD,
  pointSourceContract: CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD,
});
