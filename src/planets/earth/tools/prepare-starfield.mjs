#!/usr/bin/env node

import {
  CUBIC_SKY_CAMERA_PRESENTATION_STANDARD,
  CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD,
} from "../../../platform/cubic-sky-contract.mjs";
import { preparePlanetCubicSky } from
  "../../../platform/prepare-cubic-sky-source.mjs";
import {
  EARTH_PUBLIC_ROOT,
  EARTH_SOURCE_ROOT,
  ensureEarthPreparationDirectories,
} from "./preparation-paths.mjs";
import { validateEarthSourceGroup } from "./source-manifest.mjs";

await preparePlanetCubicSky({
  objectId: "earth",
  sourceRoot: EARTH_SOURCE_ROOT,
  publicRoot: EARTH_PUBLIC_ROOT,
  preparedModulePath: new URL("../runtime/preparedStarfield.mjs", import.meta.url),
  ensureDirectories: ensureEarthPreparationDirectories,
  validateSourceGroup: validateEarthSourceGroup,
  includeSun: false,
  cameraContract: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD,
  pointSourceContract: CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD,
});
