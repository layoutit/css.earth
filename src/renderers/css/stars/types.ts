import type { DensityVolumeFrame } from '@cssearth/objects';

export type PointFieldVector = readonly [number, number, number];
export type PointFieldRgb = readonly [number, number, number];

export interface PreparedPointFieldStar {
  readonly id: string;
  readonly positionUnits: PointFieldVector;
  readonly absoluteMagnitude: number;
  readonly colorIndex: number;
  readonly name: string | null;
  readonly coverageAnchor: boolean;
}

export interface PreparedPointFieldNode {
  readonly positionUnits: PointFieldVector;
  readonly radiusUnits: number;
  readonly absoluteMagnitude: number;
  readonly colorIndex: number;
  readonly first: number;
  readonly count: number;
  readonly children: readonly number[];
}

export interface PreparedPointFieldResource {
  readonly path: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly width: number;
  readonly height: number;
}

export interface PreparedDirectStarPoint {
  readonly sourceRow: number;
  readonly positionUnits: PointFieldVector;
  readonly absoluteMagnitude: number;
  readonly colorIndex: number;
  readonly coverageAnchor: boolean;
}

/** A bounded, source-derived display sample for the lightweight retained-dot renderer.
 * The complete catalogue remains in the binary bank for preparation and specialist consumers. */
export interface PreparedDirectStarField {
  readonly schema: 'cssearth-direct-star-field@1';
  readonly catalogueCount: number;
  readonly selection: string;
  readonly points: readonly PreparedDirectStarPoint[];
}

export interface PreparedCssPointField {
  readonly schema: 'cssearth-css-point-field@1';
  readonly id: string;
  readonly frame: DensityVolumeFrame;
  readonly stars: readonly PreparedPointFieldStar[];
  readonly nodes: readonly PreparedPointFieldNode[];
  readonly atlas: {
    readonly path: string;
    readonly columns: number;
    readonly tileSize: number;
    readonly colors: readonly PointFieldRgb[];
    readonly haloRadii: number;
  };
  readonly photometry: {
    readonly minimumMagnitude: number;
    readonly maximumMagnitude: number;
    readonly step: number;
    readonly floor: number;
    readonly limitingMagnitude: number;
    readonly hintsLimitMagnitude: number;
    readonly minimumRadiusPx: number;
    readonly samples: readonly { readonly radiusPx: number; readonly luminance: number }[];
  };
  readonly policy: {
    readonly activeSlots: number;
    readonly transitionSlots: number;
    readonly maxErrorPx: number;
    readonly transitionMs: number;
  };
  readonly labels: {
    readonly activeSlots: number;
    readonly transitionSlots: number;
    readonly capHeightPx: number;
    readonly gapPx: number;
    readonly maxAlpha: number;
    readonly fadeMs: number;
  };
  readonly diffuseSky?: readonly { readonly id: string; readonly path: string }[];
  readonly directPoints?: PreparedDirectStarField;
  readonly resources: readonly PreparedPointFieldResource[];
}

export type PointFieldBankStorage = 'uint8' | 'int16' | 'uint32' | 'float32' | 'float64';

export interface PreparedPointFieldBankColumn {
  readonly name: string;
  readonly storage: PointFieldBankStorage;
  /** Element count, not rows: a 3-vector column holds three elements per row. */
  readonly count: number;
  readonly offset: number;
  readonly bytes: number;
}

/** Declared decode rule, bound and measured preparation error of one bank field. */
export interface PreparedPointFieldQuantization {
  readonly field: string;
  readonly storage: PointFieldBankStorage;
  readonly decode: string;
  readonly unit: string;
  readonly bound: number;
  readonly measured: number;
  /** Worst composited per-pixel alpha change a field error of `bound` can cause. */
  readonly displayAlphaChange: number;
}

export interface PreparedPointFieldBank {
  readonly encoding: 'cssearth-point-field-bank@1';
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
  readonly starIdPrefix: string;
  readonly starCount: number;
  readonly nodeCount: number;
  readonly childLinkCount: number;
  readonly anchorCount: number;
  readonly columns: readonly PreparedPointFieldBankColumn[];
  /** Named rows only, as increasing [star index, name] pairs. */
  readonly names: readonly (readonly [number, string])[];
  readonly quantization: readonly PreparedPointFieldQuantization[];
}

/** Prepared transport: this JSON manifest plus its pinned binary column bank. */
export interface PreparedCssPointFieldManifest extends Omit<PreparedCssPointField, 'schema' | 'stars' | 'nodes'> {
  readonly schema: 'cssearth-css-point-field-bank@1';
  readonly bank: PreparedPointFieldBank;
}

/** Prepared optical appearance used by the Sun marker, without catalogue rows or hierarchy. */
export type PreparedPointAppearance = Pick<PreparedCssPointField, 'id' | 'frame' | 'atlas' | 'photometry' | 'directPoints' | 'resources'>;
