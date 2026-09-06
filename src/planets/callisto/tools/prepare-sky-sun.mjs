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
  CALLISTO_CAMERA_POSE,
  CALLISTO_PRESENTATION_FRAME,
} from "./scene-camera-pose.mjs";
import {
  ensureCallistoPreparationDirectories,
  CALLISTO_PUBLIC_ROOT,
} from "./preparation-paths.mjs";

// Callisto's Sun direction is the observed one, not a presentation constant:
// the body-fixed direction comes from the prepared solar geometry, the local
// direction is that vector in the ecliptic presentation frame the scene is
// prepared in, and the reference view direction is the same direction under
// the default camera pose. The sprite raster and every other presentation
// fact stay standard.
const bodyFixedDirection = requireBodyFixedSunDirection("callisto");
const sceneDirection = CALLISTO_PRESENTATION_FRAME.sunDirection;
const presentation = Object.freeze({
  ...DIRECTIONAL_SUN_PRESENTATION_STANDARD,
  source: "JPL parent-relative satellite orbit plus VSOP87 Jupiter position, with IAU/WGCCRE rotation",
  sourcePath: "src/platform/solar-geometry.mjs",
  qualification:
    `Observed Callisto Sun direction at ${SOLAR_GEOMETRY_EPOCH_LABEL}, ` +
    "expressed in the ecliptic presentation frame (north up, Sun left at " +
    "zero yaw) and in view space at the default camera pose.",
  bodyFixedDirection,
  presentationFrame: CALLISTO_PRESENTATION_FRAME.model,
  localDirection: sceneDirection,
  referenceViewDirection: prepareSunReferenceViewDirection({
    bodyId: "callisto",
    ...CALLISTO_CAMERA_POSE,
    sceneDirection,
  }),
});

await preparePlanetDirectionalSun({
  objectId: "callisto",
  publicRoot: CALLISTO_PUBLIC_ROOT,
  preparedModulePath: new URL("../runtime/preparedSkySun.mjs", import.meta.url),
  ensureDirectories: ensureCallistoPreparationDirectories,
  meanHeliocentricDistanceAu: requireObject("callisto").distanceAu,
  presentation,
});
