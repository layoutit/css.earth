#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { requireObject } from "../../../../site/objects.mjs";
import { DIRECTIONAL_SUN_PRESENTATION_STANDARD } from
  "../../../platform/directional-sun-contract.mjs";
import { preparePlanetDirectionalSun } from
  "../../../platform/prepare-directional-sun.mjs";
import {
  ensureMarsPreparationDirectories,
  MARS_PUBLIC_ROOT,
  MARS_SOURCE_ROOT,
} from "./preparation-paths.mjs";
import { validateMarsSourcePath } from "./source-manifest.mjs";

const contractRelativePath = "sky/google-earth-pro-contract.json";
await validateMarsSourcePath(contractRelativePath);
const contract = JSON.parse(await readFile(resolve(
  MARS_SOURCE_ROOT,
  contractRelativePath,
), "utf8"));
if (contract.schema !== "cssmars-google-earth-pro-sky-contract@1" ||
    contract.sky?.googleTextureRedistributed !== false ||
    contract.sun?.sourcePixelsRedistributed !== false ||
    contract.sun?.independentBillboard !== true ||
    JSON.stringify(contract.sun?.appearance?.nativeTextureSize) !==
      JSON.stringify([128, 128]) ||
    JSON.stringify(contract.sun?.appearance?.nativeBlend) !==
      JSON.stringify(["SRC_ALPHA", "ONE"]) ||
    !direction(contract.sun?.defaultCameraBinding?.viewDirection) ||
    contract.sun?.appearance?.analyticRadialFit?.model !==
      "opaque-core-generalized-exponential-falloff") {
  throw new TypeError("Mars Google Earth Pro sky contract is incompatible.");
}

const localDirection = normalize(contract.sun.bodyDirectionAtReference);
const referenceViewDirection = normalize(
  contract.sun.defaultCameraBinding.viewDirection,
);
await preparePlanetDirectionalSun({
  objectId: "mars",
  publicRoot: MARS_PUBLIC_ROOT,
  preparedModulePath: new URL(
    "../runtime/preparedSkySun.mjs",
    import.meta.url,
  ),
  ensureDirectories: ensureMarsPreparationDirectories,
  meanHeliocentricDistanceAu: requireObject("mars").distanceAu,
  presentation: Object.freeze({
    schema: DIRECTIONAL_SUN_PRESENTATION_STANDARD.schema,
    source: contract.sourceProduct,
    sourcePath: `src/planets/mars/source/${contractRelativePath}`,
    localDirection: Object.freeze(localDirection),
    referenceViewDirection: Object.freeze(referenceViewDirection),
    appearance: Object.freeze({
      model: "clean-room-native-radial-profile-fit",
      nativeBlend: Object.freeze([...contract.sun.appearance.nativeBlend]),
      sourceOverApproximation:
        "alpha-encoded-additive-radiance-without-runtime-blend-mode",
      analyticRadialFit: Object.freeze({
        ...contract.sun.appearance.analyticRadialFit,
      }),
    }),
    projection: Object.freeze({
      focalX: contract.camera.projection.focalX,
      horizontalFovDegrees:
        contract.camera.projection.horizontalFovDegrees,
      centerDistanceOverFar: contract.sun.centerDistanceOverFar,
      halfExtentOverFar: contract.sun.halfExtentOverFar,
      halfExtentOverCenter: contract.sun.halfExtentOverCenter,
      apparentViewportWidthShare:
        contract.camera.projection.focalX *
          contract.sun.halfExtentOverCenter,
      fixedAngularSize: true,
      runtimeGeometry: false,
    }),
    culling: Object.freeze({
      states: Object.freeze([...contract.sun.cullingStates]),
      rearCameraAndViewportAtPublication: true,
      planetOccultation: "retained-paint-order-behind-opaque-body",
    }),
    qualification: contract.captureQualification,
  }),
  planMetadata: Object.freeze({
    model: "google-earth-contract-clean-room-retained-billboard",
    defaultCameraBinding: Object.freeze({
      ...contract.sun.defaultCameraBinding,
      nativeCamera: Object.freeze({
        ...contract.sun.defaultCameraBinding.nativeCamera,
      }),
      viewDirection: Object.freeze(referenceViewDirection),
    }),
    referenceTimeUtc: contract.sun.referenceTimeUtc,
    oracle: Object.freeze({
      source: contract.sourceProduct,
      sourcePath: `source/${contractRelativePath}`,
      sampleCount: contract.sampleCount,
      maximumCenterReplayResidualPixels:
        contract.sun.maximumCenterReplayResidualPixels,
      qualification: contract.captureQualification,
    }),
  }),
});

console.log("Prepared Mars clean-room directional Sun billboard.");

function normalize(value) {
  const length = Math.hypot(...value);
  return value.map((component) => component / length);
}

function direction(value) {
  return Array.isArray(value) && value.length === 3 &&
    value.every(Number.isFinite) && Math.hypot(...value) > 0;
}
