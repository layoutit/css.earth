import { PREPARED_CSS_VOLUME_SCHEMA, PREPARED_VOLUME_IMPOSTORS_SCHEMA } from './volume-schemas.js';
import type { PreparedLeafBounds, PreparedVolumeLeafStyle } from '../../prepared-data/presentation/prepared-leaf-bounds.js';
import type { DensityVolumeFrame, VolumeVector } from '../../density-volume.js';
import type { PreparedCssSky } from '../../prepared-data/sky/css-sky-types.js';

export type VolumeAxis = 'x' | 'y' | 'z';
export type VolumeOpticalRole = 'merged-three' | 'single' | 'merged-two';

export interface PreparedVolumeLeaf {
  readonly id: string;
  readonly centerUnits: VolumeVector;
  readonly texturePath: string;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly style: PreparedVolumeLeafStyle;
  readonly boundsCssPixels?: PreparedLeafBounds;
  /** An opt-in physical slab may use one merged image or a coincident original/pair image. */
  readonly opticalSlab?: { readonly id: string; readonly role: VolumeOpticalRole };
}

export interface PreparedVolumeStack {
  readonly axis: VolumeAxis;
  /** Prepared unit normal after an authored rigid model placement. */
  readonly normalUnits?: VolumeVector;
  readonly leaves: readonly PreparedVolumeLeaf[];
}

/** A finite emitter keeps its own direction-selection bounds inside the shared physical frame. */
export interface PreparedVolumeComponent {
  readonly id: string;
  readonly boundsUnits: DensityVolumeFrame['boundsUnits'];
  readonly stacks: readonly PreparedVolumeStack[];
  readonly mergedOpticalCopies?: 3;
}

/** Offline projections of the same cloud, with its saved optical presentation. */
export interface PreparedVolumeImpostors {
  readonly schema: typeof PREPARED_VOLUME_IMPOSTORS_SCHEMA;
  readonly radiusUnits: number;
  readonly fullBelowDiameterPixels: number;
  readonly volumeAboveDiameterPixels: number;
  /** Optional physical distance window; distant pictures remain authoritative while zooming from afar. */
  /** Opt-in: a thin disc's plane. A picture is laid on that plane as the camera sees it, and an edge-on picture leaves as the view opens. */
  readonly discPlane?: { readonly right: VolumeVector; readonly up: VolumeVector };
  readonly distanceFade?: { readonly detailBelowUnits: number; readonly impostorAboveUnits: number };
  readonly views: readonly {
    readonly id: string;
    readonly back: VolumeVector;
    readonly right: VolumeVector;
    readonly down: VolumeVector;
    readonly texturePath: string;
  }[];
}

export interface PreparedCssVolume {
  readonly schema: typeof PREPARED_CSS_VOLUME_SCHEMA;
  readonly id: string;
  readonly frame: DensityVolumeFrame;
  readonly anchors?: readonly { readonly id: string; readonly positionUnits: VolumeVector }[];
  readonly stacks: readonly PreparedVolumeStack[];
  readonly components?: readonly PreparedVolumeComponent[];
  /** Transparent completed groups use normalized shares, rather than opaque backdrop compensation. */
  readonly stackCompositing?: 'transparent-normalized';
  /** Opt-in: the sight-line cosines to a thin volume's normal between which its thin stack hands over to the side stacks: side stacks only at the first and below, thin stack only at the second and above. */
  readonly thinHandoverCosines?: readonly [number, number];
  /** Opt-in: cloud-point banks (prepared files beside the volume, cloud-points.ts) drawn with its detail presentation. */
  readonly pointOverlays?: readonly string[];
  readonly resources: readonly { readonly path: string; readonly bytes: number; readonly width: number; readonly height: number }[];
  /** How the volume was made. A bake writes both; in the file a page fetches both are absent (volume-dataset-bank-files.ts). */
  readonly provenance: unknown;
  readonly approximation: unknown;
  readonly sky?: PreparedCssSky;
  readonly impostors?: PreparedVolumeImpostors;
  /** Each slice image already holds its three coincident optical copies (alpha 1 - (1 - a)^3): the runtime draws one
   * layer per slice at opacity gain / 3 instead of three. Absent, the runtime stacks the copies itself. */
  readonly mergedOpticalCopies?: 3;
}
