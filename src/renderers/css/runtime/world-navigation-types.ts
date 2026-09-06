import type { PreparedWorldCameraFrame, WorldCameraPose } from '../navigation/world-camera.js';

export interface ObjectWorldNavigation {
  readonly frame: PreparedWorldCameraFrame;
  capture(): WorldCameraPose;
  apply(pose: WorldCameraPose): void;
  optics(): { focalPixels: number; principalOffsetPixels: readonly [number, number]; framingRadiusPixels: number;
    detailHandoffDiameterPixels: number };
}
