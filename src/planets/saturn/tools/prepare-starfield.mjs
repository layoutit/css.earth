#!/usr/bin/env node

import {
  CUBIC_SKY_CAMERA_PRESENTATION_STANDARD,
  CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD,
} from "../../../platform/cubic-sky-contract.mjs";
import { preparePlanetCubicSky } from
  "../../../platform/prepare-cubic-sky-source.mjs";
import {
  ensureSaturnPreparationDirectories,
  SATURN_PUBLIC_ROOT,
  SATURN_SOURCE_ROOT,
} from "./preparation-paths.mjs";
import { validateSaturnSourceGroup } from "./source-manifest.mjs";

await preparePlanetCubicSky({
  objectId: "saturn",
  sourceRoot: SATURN_SOURCE_ROOT,
  publicRoot: SATURN_PUBLIC_ROOT,
  preparedModulePath: new URL("../runtime/preparedStarfield.mjs", import.meta.url),
  ensureDirectories: ensureSaturnPreparationDirectories,
  validateSourceGroup: validateSaturnSourceGroup,
  includeSun: false,
  cameraContract: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD,
  pointSourceContract: CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD,
});
