import type { WorldCameraPose, WorldCameraViewport } from './world-camera.js';

/** One captured camera and its corresponding application frame commit together. */
export interface WorldFrameRequest {
  world: WorldCameraPose;
  viewport: WorldCameraViewport;
  commit(): void;
  current(): boolean;
  fail(error: unknown): void;
}
export interface WorldFramePresenter { present(request: WorldFrameRequest): void; }
