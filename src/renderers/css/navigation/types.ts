/** CSS camera input values; independent of object data and application policy. */
export type Vector3 = readonly number[];
export type Quaternion = readonly number[];
export type Matrix3 = readonly (readonly number[])[];
export interface PointerDelta { previousX: number; previousY: number; currentX: number; currentY: number; }
export interface TrackballMetrics {
  centerX: number; centerY: number; radius: number; surfaceRadius: number;
  focalLength: number; viewportWidth: number;
  opticalCenterX?: number; opticalCenterY?: number;
  viewportCenterX?: number; viewportCenterY?: number;
  angularDegreesPerTrackballRadius?: number; pitchResponse?: number;
  tumbleOnly?: boolean; sceneMatrix?: string | readonly number[];
}
export interface CameraUpdate { rotX?: number; rotY?: number; zoom?: number; distance?: number; distanceKilometers?: number; }
export interface NavigationCamera {
  readonly state: Readonly<{ rotX: number; rotY: number; zoom: number; distance: number }>;
}
export interface CameraDelta { controlPitchDelta: number; controlYawDelta: number; zoom?: number; distance?: number; rotation?: Quaternion; }
export interface ControlsUpdate { drag?: boolean; wheel?: boolean; }
export interface MotionCompletion { completed: boolean; }
export interface PitchCalibration {
  defaultControlPitchDegrees: number; maximumControlPitchDegrees: number; initialScenePitchDegrees: number; maximumScenePitchDegrees: number;
}
export interface ResponsiveFit {
  model: string; portraitBaseWidthShare: number; narrowPortraitWidthShareGain: number;
  landscapeWidthShareGain: number; narrowPortraitAspectRatio: number; portraitAspectRatio: number;
  squareAspectRatio: number; maximumHeightShare: number; maximumMobilePreviewShare: number;
  minimumZoom: number; maximumZoom: number;
}
export interface LevelOfDetailPlan {
  model: string; billboardFadeStartDiscPixels: number; billboardFullDiscPixels: number;
  markerFadeStartDiscPixels: number; markerFullDiscPixels: number;
}
export interface OrbitLineFade { visibleBelowDiscHeightShare: number; hiddenAboveDiscHeightShare: number; }
export interface CameraPlan extends PitchCalibration {
  cameraModel: string; pitchBounded: boolean; yawBounded: boolean;
  minimumControlPitchDegrees: number; defaultControlYawDegrees: number;
  materialReferenceControlPitchDegrees?: number; materialReferenceControlYawDegrees?: number;
  minimumZoom: number; maximumZoom: number; defaultZoom: number; sceneScale: number;
  logicalBodyDiameter: number; responsiveFit: ResponsiveFit;
  projection?: { model: string; cssPerspective: string };
  dolly?: { model: string; wheelStepPerDelta: number; minimumDistanceRadii: number;
    maximumDistanceOverOrbitExtent: number };
  levelOfDetail?: LevelOfDetailPlan; orbitLineFade?: OrbitLineFade;
  drag?: { model: string };
}
export interface PerspectiveCameraPlan extends CameraPlan {
  projection: NonNullable<CameraPlan['projection']>; dolly: NonNullable<CameraPlan['dolly']>;
  levelOfDetail: LevelOfDetailPlan; orbitLineFade: OrbitLineFade;
}
export interface PhysicalCameraPose { schema: 'cssearth-camera-pose@2'; scene: string; }
export type CameraPose = PhysicalCameraPose;
export interface CameraAngles { controlPitch: number; controlYaw: number; }
export function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
