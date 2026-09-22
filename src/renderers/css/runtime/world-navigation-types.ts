import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import type { PreparedNavigationFocus, PreparedFocusFlightOptions } from '../navigation/prepared-focus.js';

export type ObjectWorldNavigationListener = (world: WorldCameraPose, viewport: WorldCameraViewport) => void;

export interface ObjectWorldNavigation {
  readonly frame: PreparedWorldCameraFrame;
  /** The retained surface may differ from the current overview focus. */
  readonly detailFrame?: PreparedWorldCameraFrame;
  capture(): WorldCameraPose;
  apply(pose: WorldCameraPose, options?: { signal: AbortSignal }): void | Promise<boolean>;
  preparedFocus(): PreparedNavigationFocus | null;
  setPreparedFocus(focus: PreparedNavigationFocus | null): void;
  flyToPreparedFocus(focus: PreparedNavigationFocus, options?: PreparedFocusFlightOptions): Promise<{ completed: boolean }>;
  setZoomOutCentering?(enabled: boolean): void;
  /** The shared camera's view mode; false when this object cannot take it. */
  setViewMode?(mode: 'orbit' | 'free', elevationDegrees?: number): boolean;
  /** True once every prepared detail group is connected and painted. */
  detailActivated?(): boolean;
  optics(): WorldCameraViewport & { framingRadiusPixels: number;
    visibleRect: import('../solar-system/types.js').VisibleRect | null;
    detailHandoffDiameterPixels: number };
  subscribe(listener: ObjectWorldNavigationListener): () => void;
}
