import { type WorldCameraPose, type PreparedWorldCameraFrame } from '@cssearth/objects';
import type { WorldCameraViewport } from '../navigation/world-camera.js';

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
  setZoomOutCentering?(enabled: boolean): void;
  /** A wider scene can take the camera over as it zooms out: this scene's own far limit does not stop the zoom. */
  setZoomOutOpen?(open: boolean): void;
  /** True once every prepared detail group is connected and painted. */
  detailActivated?(): boolean;
  optics(): WorldCameraViewport & { framingRadiusPixels: number;
    visibleRect: import('@cssearth/engine').VisibleRect | null;
    detailHandoffDiameterPixels: number };
  subscribe(listener: ObjectWorldNavigationListener): () => void;
}
