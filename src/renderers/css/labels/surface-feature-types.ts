import type { LabelScreenRect } from './screen-label-layout.js';

/** Prepared nomenclature labels anchored to a body mesh. Every anchor, priority and
 * caption is prepared; the runtime projects them through the current camera only. */
export type SurfaceFeatureKind = 'point' | 'linear' | 'region';
export interface SurfaceFeaturePolicy {
  /** Share of the camera's logarithmic zoom range that must be reached before any label shows (1 = the last zoom only). */
  readonly minimumZoomShare: number;
  readonly minimumDiameterPixels: number; readonly alwaysVisibleCount: number; readonly maximumVisible: number; readonly limbCosine: number;
}
export interface PreparedSurfaceFeaturePlan {
  readonly catalog: { readonly url: string; readonly bytes: number; readonly sha256: string; readonly count: number };
  /** Mesh radius in the target node's raw coordinates; anchors sit on this sphere. */
  readonly target: number; readonly lensIds: readonly string[]; readonly meshRadiusUnits: number; readonly policy: SurfaceFeaturePolicy;
  /** Retained screen-space line pieces tracing the hovered feature's published diameter. */
  readonly outline: { readonly pieces: number };
}
/** Prepared boundary in mesh units: a small circle of the sphere for circular features, rim(φ) = center + east·cos φ + north·sin φ,
 * or the Gazetteer's published extent as a closed polygon for everything else. */
export type SurfaceFeatureOutline =
  | { readonly kind: 'circle'; readonly center: readonly [number, number, number]; readonly east: readonly [number, number, number]; readonly north: readonly [number, number, number] }
  | { readonly kind: 'box'; readonly points: readonly (readonly [number, number, number])[] };
export interface PreparedSurfaceFeature {
  readonly id: string; readonly name: string; readonly kind: SurfaceFeatureKind; readonly type: string; readonly code: string;
  readonly diameterKm: number; readonly longitudeDeg: number; readonly latitudeDeg: number;
  readonly anchorUnits: readonly [number, number, number]; readonly normal: readonly [number, number, number]; readonly radiusUnits: number;
  readonly outline: SurfaceFeatureOutline;
  readonly origin: string; readonly approved: string; readonly quad: string; readonly link: string;
}
export interface PreparedSurfaceFeatureCatalog {
  readonly schema: 'cssearth-prepared-surface-features@1'; readonly objectId: string;
  readonly source: string; readonly snapshotDate: string; readonly sourcePage: string; readonly license: string; readonly qualification: string;
  readonly features: readonly PreparedSurfaceFeature[];
}
export interface SurfaceFeatureLayerStats {
  readonly loaded: boolean; readonly count: number; readonly visible: number; readonly eligible: number; readonly hovered: string | null; readonly pinned: string | null;
  readonly enabled: boolean; readonly playing: boolean; readonly frames: number; readonly error: string | null;
  readonly zoomGate: boolean; readonly outlinePieces: number;
}
export interface SurfaceFeatureLayerRuntime {
  readonly root: HTMLElement;
  publish(view: { readonly projection?: import('../rendering/physical-projection.js').PhysicalProjection; readonly levelOfDetail?: { readonly stage: string } | null; readonly zoom?: number }): void;
  setLens(selection: { readonly id: string | null }): void;
  setPlaying(value: boolean): void;
  stats(): SurfaceFeatureLayerStats;
  inspect(): { readonly labels: Readonly<Record<string, HTMLElement>>; readonly tooltip: HTMLElement; readonly outline: readonly HTMLElement[]; readonly rects: ReadonlyMap<string, LabelScreenRect> };
  destroy(): void;
}
