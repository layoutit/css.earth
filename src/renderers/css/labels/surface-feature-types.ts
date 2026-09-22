import type { LabelScreenRect } from './screen-label-layout.js';

/** Prepared nomenclature labels anchored to a body mesh. Every anchor, priority and
 * caption is prepared; the runtime projects them through the current camera only. */
export type SurfaceFeatureKind = 'point' | 'linear' | 'region';
export interface SurfaceFeaturePolicy {
  /** Share of the camera's logarithmic zoom range that must be reached before any label shows (1 = the last zoom only). */
  readonly minimumZoomShare: number;
  readonly minimumDiameterPixels: number; readonly alwaysVisibleCount: number; readonly maximumVisible: number; readonly limbCosine: number;
}
export interface SurfaceFeatureCatalogDescriptor {
  readonly url: string; readonly bytes: number; readonly sha256: string; readonly count: number;
}
export interface SurfaceFeatureSelectionPlan {
  readonly count: number; readonly banks: readonly SurfaceFeatureCatalogDescriptor[];
}
export interface PreparedSurfaceFeaturePlan {
  readonly catalog: SurfaceFeatureCatalogDescriptor;
  readonly selection?: SurfaceFeatureSelectionPlan;
  /** Mesh radius in the target node's raw coordinates; anchors sit on this sphere. */
  readonly target: number; readonly lensIds: readonly string[]; readonly meshRadiusUnits: number; readonly policy: SurfaceFeaturePolicy;
  /** Shape-model bodies: the radius band of the prepared picking mesh that every anchor and outline point lies within. */
  readonly surfaceRadiusUnits?: { readonly minimum: number; readonly maximum: number };
  /** Ellipsoidal bodies: the reference semi-axes in mesh units, the polar axis, and the normalised-radius band
   * (1 = on the ellipsoid) that every prepared anchor and outline point lies within on the rendered surface. */
  readonly surfaceEllipsoidUnits?: { readonly equatorial: number; readonly polar: number; readonly north: readonly [number, number, number]; readonly minimumShare: number; readonly maximumShare: number };
  /** Retained screen-space line pieces tracing the hovered feature's published diameter. */
  readonly outline: { readonly pieces: number };
}
/** Prepared boundary in mesh units: a small circle of the sphere for circular features, rim(φ) = center + east·cos φ + north·sin φ,
 * or the Gazetteer's published extent as a closed polygon for everything else. */
export type SurfaceFeatureOutline =
  | { readonly kind: 'circle'; readonly center: readonly [number, number, number]; readonly east: readonly [number, number, number]; readonly north: readonly [number, number, number] }
  | { readonly kind: 'box'; readonly points: readonly (readonly [number, number, number])[] }
  /** Mapped structural traces associated with the feature: open polylines on the sphere. */
  | { readonly kind: 'trace'; readonly paths: readonly (readonly (readonly [number, number, number])[])[] };
export interface PreparedSurfaceFeature {
  readonly id: string; readonly name: string; readonly kind: SurfaceFeatureKind; readonly type: string; readonly code: string;
  readonly diameterKm: number; readonly longitudeDeg: number; readonly latitudeDeg: number;
  readonly anchorUnits: readonly [number, number, number]; readonly normal: readonly [number, number, number]; readonly radiusUnits: number;
  readonly outline: SurfaceFeatureOutline;
  /** Prepared search keys: the normalised name and clean name, and the normalised type. */
  readonly searchNames: readonly string[]; readonly searchContext: string;
  readonly origin: string; readonly approved: string; readonly quad: string; readonly link: string;
  /** Who published the name or site and when, for the caption's credit line. */
  readonly credit: string;
  /** A source-backed caption note (a Wikipedia lead summary or a site's quoted source sentence) with its page and credit. */
  readonly note: { readonly text: string; readonly title: string; readonly url: string; readonly credit: string } | null;
  /** The facilities-catalogue id of the spacecraft at a site, when catalogued. */
  readonly facilityId: string | null;
  /** Discovery tier: the share of the zoom range (0 whole body, 1 closest) from which this name competes for a label. */
  readonly minimumZoomShare: number;
  /** Found by search and labelled when selected, never by default. */
  readonly searchOnly: boolean;
}
export interface PreparedSurfaceFeatureCatalog {
  readonly schema: 'cssearth-prepared-surface-features@1'; readonly objectId: string;
  readonly source: string; readonly snapshotDate: string; readonly sourcePage: string; readonly license: string; readonly qualification: string;
  readonly features: readonly PreparedSurfaceFeature[];
}
export interface SurfaceFeatureLayerStats {
  readonly loaded: boolean; readonly count: number; readonly visible: number; readonly eligible: number; readonly hovered: string | null; readonly pinned: string | null;
  readonly enabled: boolean; readonly playing: boolean; readonly frames: number; readonly error: string | null;
  readonly zoomGate: boolean; readonly outlinePieces: number; readonly flying: boolean;
}
/** The shell-facing surface: the loaded catalogue and selection by feature id (pin, caption, outline, flight). */
export interface SurfaceFeatureNavigationRuntime {
  catalog(): PreparedSurfaceFeatureCatalog | null;
  loaded(): Promise<PreparedSurfaceFeatureCatalog>;
  select(id: string): Promise<{ completed: boolean }>;
  selected(): string | null;
  clear(): void;
  /** A flight into this body is under way (true) or has ended (false). A flight that ends with the body on screen has
   * landed; one another navigation replaced has not, and drops the loads it held. */
  setNavigationInFlight?(active: boolean, landed?: boolean): void;
}
export interface SurfaceFeatureLayerRuntime extends SurfaceFeatureNavigationRuntime {
  readonly root: HTMLElement;
  publish(view: { readonly projection?: import('../prepared-data/physical-projection.js').PhysicalProjection; readonly levelOfDetail?: { readonly stage: string } | null; readonly zoom?: number }): void;
  setLens(selection: { readonly id: string | null }): void;
  setPlaying(value: boolean): void;
  stats(): SurfaceFeatureLayerStats;
  inspect(): { readonly labels: Readonly<Record<string, HTMLElement>>; readonly tooltip: HTMLElement; readonly outline: readonly HTMLElement[]; readonly rects: ReadonlyMap<string, LabelScreenRect> };
  destroy(): void;
}
