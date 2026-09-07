import type { ObjectRuntimeView } from '../runtime/object-runtime-types.js';

export type Vector3 = readonly [number, number, number];
export interface PreparedOpaqueDisc { center: Vector3; normal: Vector3; radius: number; }
export interface PreparedReference {
  url: string; bytes: number; sha256: string; encoding?: string;
  offset?: number; decodedBytes?: number; decodedSha256?: string;
}
export interface PreparedBounds {
  corners: readonly Vector3[]; normal: Vector3; normalSlack?: number;
  coverageCorners?: readonly Vector3[]; coverageParts?: readonly PreparedBounds[];
}
export interface WmtsRasterSource {
  schema: 'cssearth-wmts-raster-source@1'; identity: 'versioned-provider'; dataset: string; version: string;
  matrixSet: 'webmercator'; tileSize: 256; urlTemplate: string; levels: string[];
  extent: [number, number, number, number];
  emptyImage?: { sha256: string; bytes: number; width: 1; height: 1 };
}
export interface PreparedImage {
  url: string; width: number; height: number; sha256?: string; bytes?: number;
  rasterSource?: string; provider?: WmtsRasterSource; level?: number; x?: number; y?: number;
}
export interface PreparedPage extends PreparedBounds {
  key: string; children: string[]; directory?: PreparedReference; stub?: boolean;
  url: string; width: number; height: number; sha256: string; bytes?: number;
  maximumCssSpan: number; childrenCoverImage?: boolean; level: number; pages?: string[];
  coarseKey: string; sourceCrop?: { u0: number; u1: number; v0: number; v1: number };
  provider?: WmtsRasterSource; x?: number; y?: number;
  replacement?: { empty?: boolean; branches?: string[][] };
  rasterSource?: string; frameMatrix: string; textureMatrix: string; imageMatrix?: string;
  textureBackgroundSize?: string; textureBackgroundPosition?: string;
}
export interface PreparedDirectory {
  schema: string; dataset: string; nodes: PreparedPage[]; external: PreparedPage[];
}
export interface PreparedPagePlan {
  opaqueDiscs?: readonly PreparedOpaqueDisc[];
  schema: string; assetPath: string; assetOrigin: string; dataset: string;
  geometryOrigin?: string; geometryVersion?: string; qualification?: string;
  topology?: string; pageTemplate?: string; poolSize: number; maximumDecodedBytes: number;
  decodedPageBytes: number; maximumConcurrentLoads: number; minimumZoom: number;
  targetCssPixels: number; rasterScale: number; roots: PreparedPage[]; lensIds?: string[];
  selectionScale?: number; coarsestCut?: boolean;
  backing?: { roots: PreparedPage[]; minimumZoom: number; rootDecodedBytes?: number };
  imageSource?: WmtsRasterSource; geometryDataset?: string;
  rootDirectory?: PreparedReference; levels?: { minimum: number; maximum: number }; rasterScales?: number[];
  initialLayer: { frameMatrix: string; textureMatrix: string };
  index: { maximumDirectories: number; maximumBytes: number; maximumConcurrentLoads: number; maximumDirectoryBytes: number };
}
export interface PageViewport {
  opaqueDiscs?: readonly PreparedOpaqueDisc[];
  width: number; height: number; zoom?: number; originX?: number; originY?: number;
  projection?: Pick<import('../rendering/physical-projection.js').PhysicalProjection, 'focalPixels' | 'principalOffsetPixels'>;
}
export interface PageProjection { visible: boolean; span: number; center: number[]; }
export interface ProjectedPage extends PageProjection { node: PreparedPage; path: PreparedReference[]; }
export interface PageGroup { key: string; lineage: string[]; pages: string[]; pending?: boolean; backing?: boolean; replacements?: string[]; }
export interface PublicationSlot { key: string | null; ready: boolean; published: boolean; decodedBytes: number; group: PageGroup | null; }
export interface PublicationLimits { pages: number; bytes: number; }
export interface PageSelection {
  keys: string[]; directories: PreparedReference[]; groups?: PageGroup[]; backing?: {pieces: number; decodedBytes: number; retiring: number}; fallbacks?: unknown[];
  selectionScale?: number; baseSurfaceFallback?: string;
  cuts?: Array<{ scale: number; count: number; faces: Record<string, number> }>;
}
export interface PageMountOptions {
  plan: PreparedPagePlan; carrier: HTMLElement; system: HTMLElement;
  paintLayer?: number;
  scene: HTMLElement; camera: HTMLElement; stage: HTMLElement; className: string;
  textureClassName: string; lensIds: string[]; own(cleanup: () => void): void;
  images?: import("./api-image-transport.js").ApiImageScope | null; onStatus?(): void;
  onError?(error: unknown): void;
}
export interface PageLayerRuntime {
  setPlaying(value: boolean): void; setLens(lens: { id: string | null }): void;
  publish(view: ObjectRuntimeView): void; stats(): unknown; destroy(): void;
}
