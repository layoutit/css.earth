#!/usr/bin/env node

import {
  CUBIC_SKY_CAMERA_PRESENTATION_STANDARD,
  CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD,
} from "../../../platform/cubic-sky-contract.mjs";
import { preparePlanetCubicSky } from
  "../../../platform/prepare-cubic-sky-source.mjs";
import {
  ensureMoonPreparationDirectories,
  MOON_PUBLIC_ROOT,
  MOON_SOURCE_ROOT,
} from "./preparation-paths.mjs";
import { validateMoonSourceGroup } from "./source-manifest.mjs";

await preparePlanetCubicSky({
  objectId: "moon",
  sourceRoot: MOON_SOURCE_ROOT,
  publicRoot: MOON_PUBLIC_ROOT,
  preparedModulePath: new URL("../runtime/preparedStarfield.mjs", import.meta.url),
  ensureDirectories: ensureMoonPreparationDirectories,
  validateSourceGroup: validateMoonSourceGroup,
  includeSun: false,
  cameraContract: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD,
  pointSourceContract: CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD,
  sourceSchema: "cssearth-prepared-star-source@1",
});
