import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import type { PreparedNavigationFocus, PreparedFocusFlightOptions } from '../navigation/prepared-focus.js';

export type ObjectWorldNavigationListener = (world: WorldCameraPose, viewport: WorldCameraViewport) => void;

export interface ObjectWorldNavigation {
  readonly motion: import('../navigation/camera-motion.js').CameraMotion;
  readonly frame: PreparedWorldCameraFrame;
  /** The body's volume-equivalent radius over its longest reach when below 1 (an elongated shape model). */
  readonly framingScale?: number;
  readonly labelEdge?: import('../navigation/prepared-label-edge.js').PreparedLabelEdge;
  /** The retained surface may differ from the current overview focus. */
  readonly detailFrame?: PreparedWorldCameraFrame;
  /** Retain the departing surface until navigation is cancelled or its scene is disposed. */
  holdPresentation?(): () => void;
  capture(): WorldCameraPose;
  apply(pose: WorldCameraPose, options?: { signal: AbortSignal; departing?: boolean }): void | Promise<boolean>;
  preparedFocus(): PreparedNavigationFocus | null;
  setPreparedFocus(focus: PreparedNavigationFocus | null): void;
  flyToPreparedFocus(focus: PreparedNavigationFocus, options?: PreparedFocusFlightOptions): Promise<{ completed: boolean }>;
  setZoomOutCentering?(enabled: boolean): void;
  /** True once every prepared detail group is connected and painted. */
  detailActivated?(): boolean;
  optics(): WorldCameraViewport & { framingRadiusPixels: number;
    visibleRect: import('../solar-system/types.js').VisibleRect | null;
    detailHandoffDiameterPixels: number };
  subscribe(listener: ObjectWorldNavigationListener): () => void;
}
