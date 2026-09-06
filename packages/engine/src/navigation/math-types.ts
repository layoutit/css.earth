/** Numeric camera and trackball inputs shared by renderer implementations. */
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
  tumbleOnly?: boolean;
}
export interface PitchCalibration {
  defaultControlPitchDegrees: number; maximumControlPitchDegrees: number; initialScenePitchDegrees: number;
}
