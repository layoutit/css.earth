import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';

export type ObjectWorldNavigationListener = (world: WorldCameraPose, viewport: WorldCameraViewport) => void;

export interface ObjectWorldNavigation {
  readonly frame: PreparedWorldCameraFrame;
  capture(): WorldCameraPose;
  apply(pose: WorldCameraPose): void;
  setZoomOutCentering?(enabled: boolean): void;
  surfaceMetrics?(): { altitudeM: number; metersPerPixel: number | null } | null;
  optics(): WorldCameraViewport & { framingRadiusPixels: number;
    detailHandoffDiameterPixels: number };
  subscribe(listener: ObjectWorldNavigationListener): () => void;
}
