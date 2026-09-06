#!/usr/bin/env node

import {
  CUBIC_SKY_CAMERA_PRESENTATION_STANDARD,
  CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD,
} from "../../../platform/cubic-sky-contract.mjs";
import { prepareAstrometricCubeSampling } from
  "../../../platform/astrometric-sky-registration.mjs";
import { preparePlanetCubicSky } from
  "../../../platform/prepare-cubic-sky-source.mjs";
import { prepareCatalogueStars } from
  "../../../platform/prepare-catalogue-stars.mjs";
import {
  ensureGanymedePreparationDirectories,
  GANYMEDE_PUBLIC_ROOT,
  GANYMEDE_SOURCE_ROOT,
} from "./preparation-paths.mjs";
import { validateGanymedeSourceGroup } from "./source-manifest.mjs";

await preparePlanetCubicSky({
  objectId: "ganymede",
  sourceRoot: GANYMEDE_SOURCE_ROOT,
  publicRoot: GANYMEDE_PUBLIC_ROOT,
  preparedModulePath: new URL(
    "../runtime/preparedStarfield.mjs",
    import.meta.url,
  ),
  ensureDirectories: ensureGanymedePreparationDirectories,
  validateSourceGroup: validateGanymedeSourceGroup,
  includeSun: false,
  cameraContract: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD,
  pointSourceContract: CUBIC_SKY_POINT_SOURCE_PRESENTATION_STANDARD,
  // Ganymede's sky is astrometric: the cube is sampled in ICRF through the
  // J2000 galactic frame and the anchor-registered panorama, and the scene
  // registration prepared alongside the scene carries Ganymede's pole and
  // the epoch. No hand-tuned Euler angles.
  astrometricSampling: prepareAstrometricCubeSampling(),
  // The stars that make sense to draw: the HYG catalogue to the limit the
  // photometric chain derives at the prepared 60-degree field, stamped into
  // the faces or retained as points, over the photograph's diffuse light
  // only (the photographic point selection is superseded).
  catalogueStars: await prepareCatalogueStars({
    fovDegrees: CUBIC_SKY_CAMERA_PRESENTATION_STANDARD.horizontalFovDegrees,
  }),
});
