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
  /** The body's north pole as a unit view direction (CSS axes): body drags turn about it and never roll it. */
  pole?: Vector3;
  /** The drawn body and the projection that draws it: pole drags keep the grabbed ground under the pointer
   * (engine pole-drag.ts). It carries its own optical centre and focal length, which interactionTrackball replaces. */
  grabSphere?: { center: Vector3; radius: number; opticalCenterX: number; opticalCenterY: number; focalLength: number };
}
export interface CameraUpdate { rotX?: number; rotY?: number; zoom?: number; distance?: number; distanceKilometers?: number; }
export interface NavigationCamera {
  readonly state: Readonly<{ rotX: number; rotY: number; zoom: number; distance: number }>;
}
export interface CameraDelta { controlPitchDelta: number; controlYawDelta: number; zoom?: number; distance?: number; rotation?: Quaternion; }
export interface ControlsUpdate { drag?: boolean; wheel?: boolean; }
export interface MotionCompletion { completed: boolean; }
export interface CameraAngles { controlPitch: number; controlYaw: number; }
export function errorMessage(error: unknown): string { return error instanceof Error ? error.message : String(error); }
