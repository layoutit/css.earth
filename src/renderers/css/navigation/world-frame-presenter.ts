import type { WorldCameraPose, WorldCameraViewport } from './world-camera.js';

/** One captured camera and its corresponding application frame commit together. */
export interface WorldFrameRequest {
  world: WorldCameraPose;
  viewport: WorldCameraViewport;
  commit(): void;
  current(): boolean;
  fail(error: unknown): void;
}
export interface WorldFramePresenter {
  /** Input can replace pending views. Flights await the displayed view before
   * advancing their checkpoint or releasing the current navigation owner.
   * A synchronous commit returns void; a promise acknowledges a later presentation frame. */
  present(request: WorldFrameRequest, signal?: AbortSignal): void | Promise<boolean>;
}
