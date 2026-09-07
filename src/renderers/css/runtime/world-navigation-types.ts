import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import type { PreparedNavigationFocus, PreparedFocusFlightOptions } from '../navigation/prepared-focus.js';

export type ObjectWorldNavigationListener = (world: WorldCameraPose, viewport: WorldCameraViewport) => void;

export interface ObjectWorldNavigation {
  readonly frame: PreparedWorldCameraFrame;
  capture(): WorldCameraPose;
  apply(pose: WorldCameraPose): void;
  preparedFocus(): PreparedNavigationFocus | null;
  setPreparedFocus(focus: PreparedNavigationFocus | null): void;
  flyToPreparedFocus(focus: PreparedNavigationFocus, options?: PreparedFocusFlightOptions): Promise<{ completed: boolean }>;
  setZoomOutCentering?(enabled: boolean): void;
  optics(): WorldCameraViewport & { framingRadiusPixels: number;
    detailHandoffDiameterPixels: number };
  subscribe(listener: ObjectWorldNavigationListener): () => void;
}
