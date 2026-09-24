import type { prepareLandmarks } from './landmarks.js';
export interface TraceSummary { readonly source: string; readonly sourcePage: string; readonly license: string; readonly snapshotDate: string; readonly traces: number; readonly matched: number; readonly byCode: Readonly<Record<string, number>>; readonly unmatched: readonly string[]; readonly maximumVertices: number; }

export const PREPARED_SURFACE_FEATURES_SCHEMA = 'cssearth-prepared-surface-features@1';


/** Sparse catalogues must not spread a handful of names across the entire zoom range.
 * A floor of 200 keeps roughly ten unnoted names eligible at whole-body framing
 * (share 0.43). Denser catalogues retain their existing progression. Actual label
 * admission still checks projected feature size, facing, overlap and the label cap. */
export function featureDiscoveryZoomShare(rank: number, count: number, noted = false): number {
  return Math.min(1, Math.log10(1 + (noted ? rank / 4 : rank)) / Math.log10(Math.max(200, count)));
}


export type SurfaceFeatureKind = 'point' | 'linear' | 'region';

export type SurfaceFeatureOutline =
  | { readonly kind: 'circle'; readonly center: readonly [number, number, number]; readonly east: readonly [number, number, number]; readonly north: readonly [number, number, number] }
  | { readonly kind: 'box'; readonly points: readonly (readonly [number, number, number])[] }
  /** Mapped structural traces associated with the feature: open polylines on the sphere, in mesh units. */
  | { readonly kind: 'trace'; readonly paths: readonly (readonly (readonly [number, number, number])[])[] };

/** Where a surface map places latitude and longitude on its mesh node: the prime, east and north axes, with longitude counted
 * east from the map's left edge (texture u = 0). The surface map is the only owner of both. */
export interface SurfaceFeatureAxes { readonly prime: readonly [number, number, number]; readonly east: readonly [number, number, number]; readonly north: readonly [number, number, number]; readonly mapLeftEdgeLongitudeDeg: number; }

export interface SurfaceFeaturePolicy { readonly minimumZoomShare: number; readonly minimumDiameterPixels: number; readonly alwaysVisibleCount: number; readonly maximumVisible: number; readonly limbCosine: number; }

export interface PreparedSurfaceFeature {
  readonly id: string; readonly name: string; readonly kind: SurfaceFeatureKind; readonly type: string; readonly code: string;
  readonly diameterKm: number; readonly longitudeDeg: number; readonly latitudeDeg: number;
  readonly anchorUnits: readonly [number, number, number]; readonly normal: readonly [number, number, number]; readonly radiusUnits: number;
  /** Circular features trace their published diameter as a small circle of the sphere, rim(φ) = center + east·cos φ + north·sin φ;
   * other features trace the Gazetteer's published latitude/longitude extent as a closed polygon on the sphere. Mesh units. */
  readonly outline: SurfaceFeatureOutline;
  readonly searchNames: readonly string[]; readonly searchContext: string;
  readonly origin: string; readonly approved: string; readonly quad: string; readonly link: string;
  /** Who published the name or site and when, for the caption's credit line. */
  readonly credit: string;
  /** A source-backed note for the caption (a Wikipedia lead summary, or the quoted source sentence of a site) with its page and credit. */
  readonly note?: { readonly text: string; readonly title: string; readonly url: string; readonly credit: string };
  /** The facilities-catalogue id of the spacecraft at a site, when catalogued. */
  readonly facilityId?: string;
  /** Discovery tier: the share of the zoom range (0 whole body, 1 closest) from which this name competes for a label. */
  readonly minimumZoomShare: number;
  /** Found by search and labelled when selected, never by default. */
  readonly searchOnly?: true;
}

export interface PreparedSurfaceFeatureCatalog {
  readonly schema: typeof PREPARED_SURFACE_FEATURES_SCHEMA; readonly objectId: string;
  readonly source: string; readonly snapshotDate: string; readonly sourcePage: string; readonly license: string; readonly qualification: string;
  readonly datum: { readonly name: string; readonly radiusM: number; readonly authoredRadiusM: number; readonly longitude: string };
  readonly excluded: Readonly<Record<string, { readonly count: number; readonly reason: string }>>;
  /** Rows left out for a reason other than an excluded type: not adopted, no label kind, or no diameter. */
  readonly skipped: Readonly<Record<string, { readonly count: number; readonly reason: string }>>;
  /** Type codes outside the kind table, labelled as regions, and features whose empty extent fell back to a circle. */
  /** `unsized` counts labelled names the Gazetteer publishes without a diameter, by type code. */
  readonly assumed: { readonly regionTypes: Readonly<Record<string, number>>; readonly extentFallbacks: number; readonly meshMisses: number; readonly unsized: Readonly<Record<string, number>> };
  /** Mapped-structure traces associated with named features, when a trace archive is declared. */
  readonly traces?: TraceSummary;
  /** Rows the export repeats for one feature identity; the first row's centre is kept. */
  readonly duplicates: { readonly features: number; readonly rows: number; readonly maxSeparationDeg: number; readonly maxDiameterDifferenceKm: number };
  /** Present when the recipe pins a notes document: its provenance and how many features carry a note. */
  readonly notes?: { readonly source: string; readonly retrievedAt: string; readonly license: string; readonly licenseUrl: string; readonly count: number };
  /** Present when the recipe pins a sites document: its provenance and how many sites and traverses were placed. */
  readonly sites?: { readonly source: string; readonly retrievedAt: string; readonly count: number };
  readonly landmarks?: { readonly source: string; readonly frame: string; readonly evidence: Awaited<ReturnType<typeof prepareLandmarks>>['evidence'] };
  readonly features: readonly PreparedSurfaceFeature[];
}

export interface SurfaceFeatureCatalogDescriptor { readonly url: string; readonly bytes: number; readonly sha256: string; readonly count: number; }

export interface SurfaceFeatureSelectionPlan { readonly count: number; readonly banks: readonly SurfaceFeatureCatalogDescriptor[]; }

export interface PreparedSurfaceFeaturePlan {
  readonly catalog: SurfaceFeatureCatalogDescriptor; readonly selection?: SurfaceFeatureSelectionPlan; readonly target: number; readonly lensIds: readonly string[];
  /** Mesh radius in raw prepared scene coordinates (before the camera's scene scale). */
  readonly meshRadiusUnits: number; readonly policy: SurfaceFeaturePolicy;
  /** Shape-model bodies: the radius band of the picking mesh, inside which every anchor and outline point lies. */
  readonly surfaceRadiusUnits?: { readonly minimum: number; readonly maximum: number };
  /** Ellipsoidal bodies: reference semi-axes and polar axis in mesh units, and the normalised-radius band (1 = on the ellipsoid) every prepared point lies within. */
  readonly surfaceEllipsoidUnits?: { readonly equatorial: number; readonly polar: number; readonly north: Vector3; readonly minimumShare: number; readonly maximumShare: number };
  readonly outline: { readonly pieces: number };
}

/** Same folding as the shell's destination search: lower case, no diacritics, single spaces. */
export function normalizeSearchText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/gu, '').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export type Vector3 = readonly [number, number, number];
