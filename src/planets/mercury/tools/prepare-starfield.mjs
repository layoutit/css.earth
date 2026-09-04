#!/usr/bin/env node

import {
  CUBIC_SKY_CAMERA_PRESENTATION_STANDARD,
  CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD,
} from "../../../platform/cubic-sky-contract.mjs";
import { preparePlanetCubicSky } from
  "../../../platform/prepare-cubic-sky-source.mjs";
import {
  ensureMercuryPreparationDirectories,
  MERCURY_PUBLIC_ROOT,
  MERCURY_SOURCE_ROOT,
} from "./preparation-paths.mjs";
import { validateMercurySourceGroup } from "./source-manifest.mjs";

await preparePlanetCubicSky({
  objectId: "mercury",
  sourceRoot: MERCURY_SOURCE_ROOT,
  publicRoot: MERCURY_PUBLIC_ROOT,
  preparedModulePath: new URL(
    "../runtime/preparedStarfield.mjs",
    import.meta.url,
  ),
  ensureDirectories: ensureMercuryPreparationDirectories,
  validateSourceGroup: validateMercurySourceGroup,
  includeSun: false,
  cameraContract: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD,
  pointSourceContract: CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD,
});
