export const PREPARED_SURFACE_FEATURES_SCHEMA = 'cssearth-prepared-surface-features@1';

export interface TraceSummary { readonly source: string; readonly sourcePage: string; readonly license: string; readonly snapshotDate: string; readonly traces: number; readonly matched: number; readonly byCode: Readonly<Record<string, number>>; readonly unmatched: readonly string[]; readonly maximumVertices: number; }

export type SurfaceFeatureKind = 'point' | 'linear' | 'region';

export type SurfaceFeatureOutline =
  | { readonly kind: 'circle'; readonly center: readonly [number, number, number]; readonly east: readonly [number, number, number]; readonly north: readonly [number, number, number] }
  | { readonly kind: 'box'; readonly points: readonly (readonly [number, number, number])[] }
  /** Mapped structural traces associated with the feature: open polylines on the sphere, in mesh units. */
  | { readonly kind: 'trace'; readonly paths: readonly (readonly (readonly [number, number, number])[])[] };

/** Where a surface map places latitude and longitude on its mesh node: the prime, east and north axes, with longitude counted
 * east from the map's left edge (texture u = 0). The surface map is the only owner of both. */
export interface SurfaceFeatureAxes { readonly prime: readonly [number, number, number]; readonly east: readonly [number, number, number]; readonly north: readonly [number, number, number]; readonly mapLeftEdgeLongitudeDeg: number; }


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
  readonly landmarks?: { readonly source: string; readonly frame: string; readonly evidence: readonly SurfaceFeatureLandmarkEvidence[] };
  readonly features: readonly PreparedSurfaceFeature[];
}

export interface SurfaceFeatureLandmarkEvidence { readonly id: string; readonly sourceFace?: number; readonly displayFace?: number; readonly distanceMeters?: number; readonly regionId?: number; }

/** The reader normalizes optional wire values for retained label consumers. */
export type ParsedSurfaceFeature = Omit<PreparedSurfaceFeature, 'note' | 'facilityId' | 'searchOnly'> & {
  readonly note: NonNullable<PreparedSurfaceFeature['note']> | null; readonly facilityId: string | null; readonly searchOnly: boolean;
};
export type ParsedSurfaceFeatureCatalog = Pick<PreparedSurfaceFeatureCatalog, 'schema' | 'objectId' | 'source' | 'snapshotDate' | 'sourcePage' | 'license' | 'qualification'> & { readonly features: readonly ParsedSurfaceFeature[] };
