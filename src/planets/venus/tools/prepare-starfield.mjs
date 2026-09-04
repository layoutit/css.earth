#!/usr/bin/env node

import {
  CUBIC_SKY_CAMERA_PRESENTATION_STANDARD,
  CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD,
} from "../../../platform/cubic-sky-contract.mjs";
import { preparePlanetCubicSky } from
  "../../../platform/prepare-cubic-sky-source.mjs";
import {
  ensureVenusPreparationDirectories,
  VENUS_PUBLIC_ROOT,
  VENUS_SOURCE_ROOT,
} from "./preparation-paths.mjs";
import { validateVenusSourceGroup } from "./source-manifest.mjs";

await preparePlanetCubicSky({
  objectId: "venus",
  sourceRoot: VENUS_SOURCE_ROOT,
  publicRoot: VENUS_PUBLIC_ROOT,
  preparedModulePath: new URL(
    "../runtime/preparedStarfield.mjs",
    import.meta.url,
  ),
  ensureDirectories: ensureVenusPreparationDirectories,
  validateSourceGroup: validateVenusSourceGroup,
  includeSun: false,
  cameraContract: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD,
  pointSourceContract: CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD,
  sourceSchema: "cssvenus-prepared-star-cubemap-source@1",
});
