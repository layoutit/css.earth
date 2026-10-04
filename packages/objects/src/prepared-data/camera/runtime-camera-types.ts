import type { PitchCalibration } from '@cssearth/core';
import type { LevelOfDetailPlan, OrbitLineFade } from '../presentation/world-presentation.js';

export type { PitchCalibration } from '@cssearth/core';

export interface ResponsiveFit {
  model: string; portraitBaseWidthShare: number; narrowPortraitWidthShareGain: number;
  landscapeWidthShareGain: number; narrowPortraitAspectRatio: number; portraitAspectRatio: number;
  squareAspectRatio: number; maximumHeightShare: number; maximumMobilePreviewShare: number;
  minimumZoom: number; maximumZoom: number;
}

export interface CameraPlan extends PitchCalibration {
  cameraModel: string; pitchBounded: boolean; yawBounded: boolean;
  minimumControlPitchDegrees: number; defaultControlYawDegrees: number;
  materialReferenceControlPitchDegrees?: number; materialReferenceControlYawDegrees?: number;
  minimumZoom: number; maximumZoom: number; defaultZoom: number; sceneScale: number;
  logicalBodyDiameter: number; responsiveFit: ResponsiveFit;
  /** Volume-equivalent radius over the body's largest radius when below 1 (an elongated body); the fit is already scaled by it. */
  framingScale?: number;
  projection?: { model: string; cssPerspective: string };
  dolly?: { model: string; wheelStepPerDelta: number; minimumDistanceRadii: number;
    maximumDistanceOverOrbitExtent: number;
    /** The least surface arc (seen from the body's centre) one CSS pixel may show before its prepared imagery only
     * stretches: the body's sharpest texel times its texture levels' texels-per-CSS-pixel target. */
    surfaceArcPerCssPixelRadians?: number };
  levelOfDetail?: LevelOfDetailPlan; orbitLineFade?: OrbitLineFade;
  drag?: { model: string };
}

export interface PerspectiveCameraPlan extends CameraPlan {
  projection: NonNullable<CameraPlan['projection']>; dolly: NonNullable<CameraPlan['dolly']>;
  levelOfDetail: LevelOfDetailPlan; orbitLineFade: OrbitLineFade;
}

export interface CubicSkyCameraContract {source:string;sourcePath:string;rotationResponse:number;zoomResponse:number;horizontalFovDegrees:number;focalLengthOverViewportWidth:number;qualification:string;}

export interface CubicSkyPlan {cameraPitchResponse:number;cameraZoomResponse:number;presentationPitchOffsetDegrees:number;presentationYawOffsetDegrees:number;sceneRegistration?:string;cameraContract?:string|CubicSkyCameraContract;projection?:{cssPerspective:string;horizontalFovDegrees:number;focalLengthOverViewportWidth?:number};}

export interface DirectionalSunPlan { localDirection: readonly number[]; referenceViewDirection: readonly number[]; }

export interface PreparedCubicSkyPlan extends CubicSkyPlan {
  schema: string; standard: string; model: string; runtimeRasterization: boolean; orientation: string; qualification: string;
  projection?: NonNullable<CubicSkyPlan["projection"]> & { axis: string; runtimeProjection: boolean };
}


export interface PreparedDirectionalSunPlan extends DirectionalSunPlan {
  schema: string; model: string; localDirection: readonly number[]; referenceViewDirection: readonly number[];
  provenance: { source: string; sourcePath: string; qualification: string };
}

export const DIRECTIONAL_SUN_PRESENTATION_STANDARD_SCHEMA = 'cssearth-directional-sun-presentation-standard@2';

/** Sky/Sun identifiers required by the runtime envelope's validator. */
export const PREPARED_CUBIC_SKY_SCHEMA = 'cssearth-prepared-cubic-sky@3';
export const CUBIC_SKY_STANDARD_SCHEMA = 'cssearth-cubic-sky-standard@3';
export const PREPARED_DIRECTIONAL_SUN_SCHEMA = 'cssearth-prepared-directional-sun@4';
