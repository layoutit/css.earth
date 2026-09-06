#!/usr/bin/env node

import { requireObject } from "../../../../site/objects.mjs";
import { DIRECTIONAL_SUN_PRESENTATION_STANDARD } from
  "../../../platform/directional-sun-contract.mjs";
import { preparePlanetDirectionalSun } from
  "../../../platform/prepare-directional-sun.mjs";
import {
  SOLAR_GEOMETRY_EPOCH_LABEL,
  requireBodyFixedSunDirection,
} from "../../../platform/solar-geometry.mjs";
import { prepareSunReferenceViewDirection } from
  "../../../platform/prepare-sun-view-direction.mjs";
import {
  CERES_CAMERA_POSE,
  CERES_PRESENTATION_FRAME,
} from "./scene-camera-pose.mjs";
import {
  ensureCeresPreparationDirectories,
  CERES_PUBLIC_ROOT,
} from "./preparation-paths.mjs";

// Ceres's Sun direction is the observed one, not a presentation constant:
// the body-fixed direction comes from the prepared solar geometry, the local
// direction is that vector in the ecliptic presentation frame the scene is
// prepared in, and the reference view direction is the same direction under
// the default camera pose. The sprite raster and every other presentation
// fact stay standard.
const bodyFixedDirection = requireBodyFixedSunDirection("ceres");
const sceneDirection = CERES_PRESENTATION_FRAME.sunDirection;
const presentation = Object.freeze({
  ...DIRECTIONAL_SUN_PRESENTATION_STANDARD,
  source: "JPL Kepler heliocentric positions with IAU/WGCCRE rotation elements",
  sourcePath: "src/platform/solar-geometry.mjs",
  qualification:
    `Observed Ceres Sun direction at ${SOLAR_GEOMETRY_EPOCH_LABEL}, ` +
    "expressed in the ecliptic presentation frame (north up, Sun left at " +
    "zero yaw) and in view space at the default camera pose.",
  bodyFixedDirection,
  presentationFrame: CERES_PRESENTATION_FRAME.model,
  localDirection: sceneDirection,
  referenceViewDirection: prepareSunReferenceViewDirection({
    bodyId: "ceres",
    ...CERES_CAMERA_POSE,
    sceneDirection,
  }),
});

await preparePlanetDirectionalSun({
  objectId: "ceres",
  publicRoot: CERES_PUBLIC_ROOT,
  preparedModulePath: new URL("../runtime/preparedSkySun.mjs", import.meta.url),
  ensureDirectories: ensureCeresPreparationDirectories,
  meanHeliocentricDistanceAu: requireObject("ceres").distanceAu,
  presentation,
});
