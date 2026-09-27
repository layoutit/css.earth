import { isArray } from '@cssearth/core';
import type { CubicSkyPlan } from "@cssearth/renderer/solar-system/cubic-sky-plan.ts";
export interface PreparedCubicSkyPlan extends CubicSkyPlan {
  schema: string; standard: string; model: string; runtimeRasterization: boolean; orientation: string; qualification: string;
  projection?: NonNullable<CubicSkyPlan["projection"]> & { axis: string; runtimeProjection: boolean };
}
export const PREPARED_CUBIC_SKY_SCHEMA = "cssearth-prepared-cubic-sky@3";

export const CUBIC_SKY_CAMERA_PRESENTATION_STANDARD = Object.freeze({
  source: "cssEarth Mars-calibrated cubic-sky camera presentation",
  sourcePath: "src/platform/cubic-sky-contract.mts",
  rotationResponse: -1,
  zoomResponse: 0,
  horizontalFovDegrees: 60,
  focalLengthOverViewportWidth: Math.sqrt(3) / 2,
  qualification:
    "Shared visual presentation derived from the accepted Mars contract; " +
    "no per-object native camera or ephemeris parity is claimed.",
});

/** The orientation an object's sky keeps for its camera; the shared universe draws the visible sky. */
export const CUBIC_SKY_STANDARD = Object.freeze({
  schema: "cssearth-cubic-sky-standard@3",
  cameraPitchResponse: -1.7,
  cameraZoomResponse: 0.12,
  presentationPitchOffsetDegrees: -20,
  presentationYawOffsetDegrees: 66,
});

const skyRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !isArray(value);
const skyFinite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const skyText = (value: unknown): value is string => typeof value === "string" && value.length > 0;

function skyShape(input: unknown): input is PreparedCubicSkyPlan {
  if (!skyRecord(input)) return false;
  const camera = input.cameraContract, projection = input.projection;
  return input.schema === PREPARED_CUBIC_SKY_SCHEMA && input.standard === CUBIC_SKY_STANDARD.schema && skyText(input.model) &&
    input.runtimeRasterization === false && input.orientation === "camera-rotation-only-no-translation-or-parallax" &&
    skyText(input.qualification) &&
    ["cameraPitchResponse", "cameraZoomResponse", "presentationPitchOffsetDegrees", "presentationYawOffsetDegrees"].every(key => skyFinite(input[key])) &&
    (input.sceneRegistration === undefined || typeof input.sceneRegistration === "string") &&
    (camera === undefined || typeof camera === "string" || (skyRecord(camera) &&
      ["source", "sourcePath", "qualification"].every(key => typeof camera[key] === "string") &&
      ["rotationResponse", "zoomResponse", "horizontalFovDegrees", "focalLengthOverViewportWidth"].every(key => skyFinite(camera[key])))) &&
    (projection === undefined || (skyRecord(projection) && projection.axis === "horizontal" &&
      skyFinite(projection.horizontalFovDegrees) && skyFinite(projection.focalLengthOverViewportWidth) &&
      skyText(projection.cssPerspective) && projection.runtimeProjection === false));
}

export function validatePreparedCubicSky(input: unknown): PreparedCubicSkyPlan {
  if (!skyShape(input)) throw new TypeError("Prepared retained cubic sky is incompatible.");
  return input;
}
