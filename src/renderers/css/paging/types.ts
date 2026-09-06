import type { ObjectRuntimeView } from '../runtime/object-runtime-types.js';

export type Vector3 = readonly [number, number, number];
export interface PreparedReference {
  url: string; bytes: number; sha256: string; encoding?: string;
  offset?: number; decodedBytes?: number; decodedSha256?: string;
}
export interface PreparedBounds {
  corners: readonly Vector3[]; normal: Vector3; normalSlack?: number;
  coverageCorners?: readonly Vector3[]; coverageParts?: readonly PreparedBounds[];
}
export interface PreparedPage extends PreparedBounds {
  key: string; children: string[]; directory?: PreparedReference; stub?: boolean;
  url: string; width: number; height: number; sha256: string; bytes?: number;
  maximumCssSpan: number; childrenCoverImage?: boolean; level: number; pages?: string[];
  coarseKey: string; sourceCrop?: { u0: number; u1: number; v0: number; v1: number };
  rasterSource?: string; frameMatrix: string; textureMatrix: string; imageMatrix?: string;
  textureBackgroundSize?: string; textureBackgroundPosition?: string;
}
export interface PreparedDirectory {
  schema: string; dataset: string; nodes: PreparedPage[]; external: PreparedPage[];
}
export interface PreparedPagePlan {
  schema: string; assetPath: string; assetOrigin: string; dataset: string;
  geometryOrigin?: string; geometryVersion?: string; qualification?: string;
  topology?: string; pageTemplate?: string; poolSize: number; maximumDecodedBytes: number;
  decodedPageBytes: number; maximumConcurrentLoads: number; minimumZoom: number;
  targetCssPixels: number; rasterScale: number; roots: PreparedPage[]; lensIds?: string[];
  selectionScale?: number; coarsestCut?: boolean;
  initialLayer: { frameMatrix: string; textureMatrix: string };
  index: { maximumDirectories: number; maximumBytes: number; maximumConcurrentLoads: number; maximumDirectoryBytes: number };
}
export interface PageViewport { width: number; height: number; originX?: number; originY?: number; }
export interface PageProjection { visible: boolean; span: number; center: number[]; }
export interface ProjectedPage extends PageProjection { node: PreparedPage; path: PreparedReference[]; }
export interface PageSelection {
  keys: string[]; directories: PreparedReference[]; fallbacks?: unknown[];
  selectionScale?: number; baseSurfaceFallback?: string;
  cuts?: Array<{ scale: number; count: number; faces: Record<string, number> }>;
}
export interface PageMountOptions {
  plan: PreparedPagePlan; carrier: HTMLElement; system: HTMLElement;
  scene: HTMLElement; camera: HTMLElement; stage: HTMLElement; className: string;
  textureClassName: string; lensIds: string[]; own(cleanup: () => void): void;
  onError?(error: unknown): void;
}
export interface PageLayerRuntime {
  setPlaying(value: boolean): void; setLens(lens: { id: string | null }): void;
  publish(view: ObjectRuntimeView): void; stats(): unknown; destroy(): void;
}
