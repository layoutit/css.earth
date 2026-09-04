#!/usr/bin/env node

import {
  CUBIC_SKY_CAMERA_PRESENTATION_STANDARD,
  CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD,
} from "../../../platform/cubic-sky-contract.mjs";
import { preparePlanetCubicSky } from
  "../../../platform/prepare-cubic-sky-source.mjs";
import {
  ensureNeptunePreparationDirectories,
  NEPTUNE_PUBLIC_ROOT,
  NEPTUNE_SOURCE_ROOT,
} from "./preparation-paths.mjs";
import { validateNeptuneSourceGroup } from "./source-manifest.mjs";

await preparePlanetCubicSky({
  objectId: "neptune",
  sourceRoot: NEPTUNE_SOURCE_ROOT,
  publicRoot: NEPTUNE_PUBLIC_ROOT,
  preparedModulePath: new URL("../runtime/preparedStarfield.mjs", import.meta.url),
  ensureDirectories: ensureNeptunePreparationDirectories,
  validateSourceGroup: validateNeptuneSourceGroup,
  includeSun: false,
  cameraContract: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD,
  pointSourceContract: CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD,
});
