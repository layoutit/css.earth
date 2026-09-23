import { CUBIC_SKY_STANDARD, PREPARED_CUBIC_SKY_SCHEMA, validatePreparedCubicSky } from "./cubic-sky-contract.mts";

export interface CubicSkyPreparationOptions {
  objectId: string;
  cameraContract?: { rotationResponse: number; zoomResponse: number; horizontalFovDegrees: number; focalLengthOverViewportWidth: number; oracle?: boolean; source?: string; sourcePath?: string; qualification?: string } | null;
}

/**
 * Prepare an object's sky orientation. The application draws one shared universe sky, so an object's sky carries only
 * what its camera reads: the camera responses and presentation offsets, and the camera contract and projection its
 * perspective camera shares. It bakes no images and no stars.
 */
export function prepareCubicSky({ objectId, cameraContract = null }: CubicSkyPreparationOptions) {
  if (!/^[a-z][a-z0-9-]*$/u.test(objectId)) throw new TypeError("Cubic sky preparation requires an object id.");
  if (cameraContract !== null && ![cameraContract.rotationResponse, cameraContract.zoomResponse,
    cameraContract.horizontalFovDegrees, cameraContract.focalLengthOverViewportWidth].every(Number.isFinite)) {
    throw new TypeError("Cubic sky camera contract is invalid.");
  }
  const objectName = objectId[0].toUpperCase() + objectId.slice(1);
  return validatePreparedCubicSky(Object.freeze({
    schema: PREPARED_CUBIC_SKY_SCHEMA,
    standard: CUBIC_SKY_STANDARD.schema,
    model: "prepared-object-sky-orientation-for-the-shared-universe",
    cameraPitchResponse: cameraContract?.rotationResponse ?? CUBIC_SKY_STANDARD.cameraPitchResponse,
    cameraZoomResponse: cameraContract?.zoomResponse ?? CUBIC_SKY_STANDARD.cameraZoomResponse,
    presentationPitchOffsetDegrees: CUBIC_SKY_STANDARD.presentationPitchOffsetDegrees,
    presentationYawOffsetDegrees: CUBIC_SKY_STANDARD.presentationYawOffsetDegrees,
    ...(cameraContract === null ? {} : {
      cameraContract: Object.freeze({ ...cameraContract }),
      projection: Object.freeze({
        axis: "horizontal",
        horizontalFovDegrees: cameraContract.horizontalFovDegrees,
        focalLengthOverViewportWidth: cameraContract.focalLengthOverViewportWidth,
        cssPerspective: `${cameraContract.focalLengthOverViewportWidth * 100}cqw`,
        runtimeProjection: false,
      }),
    }),
    runtimeRasterization: false,
    orientation: "camera-rotation-only-no-translation-or-parallax",
    qualification: `${objectName}'s sky orientation for its camera; the shared universe draws the visible sky.`,
  }));
}
