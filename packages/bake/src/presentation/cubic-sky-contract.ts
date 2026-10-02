import { PREPARED_CUBIC_SKY_SCHEMA, CUBIC_SKY_STANDARD_SCHEMA } from '@cssearth/objects';


export const CUBIC_SKY_CAMERA_PRESENTATION_STANDARD = Object.freeze({
  source: "cssEarth Mars-calibrated cubic-sky camera presentation",
  sourcePath: "packages/bake/src/presentation/cubic-sky-contract.ts",
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
  schema: CUBIC_SKY_STANDARD_SCHEMA,
  cameraPitchResponse: -1.7,
  cameraZoomResponse: 0.12,
  presentationPitchOffsetDegrees: -20,
  presentationYawOffsetDegrees: 66,
});
