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
  readonly resources: readonly PreparedPointFieldResource[];
  readonly provenance: unknown;
}
