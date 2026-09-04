#!/usr/bin/env node

import {
  CUBIC_SKY_CAMERA_PRESENTATION_STANDARD,
  CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD,
} from "../../../platform/cubic-sky-contract.mjs";
import { preparePlanetCubicSky } from
  "../../../platform/prepare-cubic-sky-source.mjs";
import {
  ensureUranusPreparationDirectories,
  URANUS_PUBLIC_ROOT,
  URANUS_SOURCE_ROOT,
} from "./preparation-paths.mjs";
import { validateUranusSourceGroup } from "./source-manifest.mjs";

await preparePlanetCubicSky({
  objectId: "uranus",
  sourceRoot: URANUS_SOURCE_ROOT,
  publicRoot: URANUS_PUBLIC_ROOT,
  preparedModulePath: new URL("../runtime/preparedStarfield.mjs", import.meta.url),
  ensureDirectories: ensureUranusPreparationDirectories,
  validateSourceGroup: validateUranusSourceGroup,
  includeSun: false,
  cameraContract: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD,
  pointSourceContract: CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD,
});
