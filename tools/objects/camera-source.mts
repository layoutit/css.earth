import {object, string, number, boolean, optional} from './material-composition/data-schema.mts';
export const responsiveFit = object({model: string, portraitBaseWidthShare: number, narrowPortraitWidthShareGain: number,
  landscapeWidthShareGain: number, narrowPortraitAspectRatio: number, portraitAspectRatio: number, squareAspectRatio: number,
  maximumHeightShare: number, maximumMobilePreviewShare: number, minimumZoom: number, maximumZoom: number});
export const camera = object({cameraModel: string, minimumControlPitchDegrees: number, maximumControlPitchDegrees: number,
  defaultControlPitchDegrees: number, defaultControlYawDegrees: number, materialReferenceControlPitchDegrees: optional(number),
  materialReferenceControlYawDegrees: optional(number), initialScenePitchDegrees: number, maximumScenePitchDegrees: number,
  minimumZoom: number, maximumZoom: number, defaultZoom: number, sceneScale: number, logicalBodyDiameter: number,
  pitchBounded: boolean, yawBounded: boolean, responsiveFit, style: optional(string),
  projection: optional(object({model: string, cssPerspective: string})),
  dolly: optional(object({model: string, wheelStepPerDelta: number, minimumDistanceRadii: number, maximumDistanceOverOrbitExtent: number, maximumDistanceOverSystemExtent: optional(number)})),
  levelOfDetail: optional(object({model: string, billboardFadeStartDiscPixels: number, billboardFullDiscPixels: number, markerFadeStartDiscPixels: number, markerFullDiscPixels: number})),
  orbitLineFade: optional(object({visibleBelowDiscHeightShare: number, hiddenAboveDiscHeightShare: number})),
  planetarySystem: optional(object({model: string, hiddenBelowDistanceOverOrbitExtent: number, visibleAboveDistanceOverOrbitExtent: number})),
  sunMarker: optional(object({model: string, fadeStartSpritePixels: number, fullSpritePixels: number})), drag: optional(object({model: string}))});
