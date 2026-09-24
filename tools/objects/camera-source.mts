import {object, string, number, boolean, optional} from '@cssearth/core/schema';
export const responsiveFit = object({model: string, portraitBaseWidthShare: number, narrowPortraitWidthShareGain: number,
  landscapeWidthShareGain: number, narrowPortraitAspectRatio: number, portraitAspectRatio: number, squareAspectRatio: number,
  maximumHeightShare: number, maximumMobilePreviewShare: number, minimumZoom: number, maximumZoom: number});
export const cameraFields = {cameraModel: string, minimumControlPitchDegrees: number, maximumControlPitchDegrees: number,
  defaultControlPitchDegrees: number, defaultControlYawDegrees: number, materialReferenceControlPitchDegrees: optional(number),
  materialReferenceControlYawDegrees: optional(number), initialScenePitchDegrees: number, maximumScenePitchDegrees: number,
  minimumZoom: number, maximumZoom: number, defaultZoom: number, sceneScale: number, logicalBodyDiameter: number,
  pitchBounded: boolean, yawBounded: boolean, responsiveFit, style: optional(string),
  projection: optional(object({model: string, cssPerspective: string})),
  dolly: optional(object({model: string, wheelStepPerDelta: number, minimumDistanceRadii: number, maximumDistanceOverOrbitExtent: number})),
  levelOfDetail: optional(object({model: string, billboardFadeStartDiscPixels: number, billboardFullDiscPixels: number, markerFadeStartDiscPixels: number, markerFullDiscPixels: number})),
  orbitLineFade: optional(object({visibleBelowDiscHeightShare: number, hiddenAboveDiscHeightShare: number})),
  drag: optional(object({model: string}))};
export const camera = object(cameraFields);
/** A recipe's camera without the default angles, which preparation derives (src/platform/default-camera.mts). */
export const DERIVED_CAMERA_ANGLE_FIELDS = ['defaultControlPitchDegrees', 'defaultControlYawDegrees', 'initialScenePitchDegrees',
  'materialReferenceControlPitchDegrees', 'materialReferenceControlYawDegrees'] as const;
const {defaultControlPitchDegrees: _pitch, defaultControlYawDegrees: _yaw, initialScenePitchDegrees: _scenePitch,
  materialReferenceControlPitchDegrees: _referencePitch, materialReferenceControlYawDegrees: _referenceYaw, ...recipeCameraFields} = cameraFields;
export const recipeCamera = object(recipeCameraFields);
