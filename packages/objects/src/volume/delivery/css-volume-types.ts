import { PREPARED_CSS_VOLUME_SCHEMA, PREPARED_VOLUME_IMPOSTORS_SCHEMA } from './volume-schemas.js';
import type { PreparedLeafBounds, PreparedVolumeLeafStyle } from '../../prepared-data/presentation/prepared-leaf-bounds.js';
import type { DensityVolumeFrame, VolumeVector } from '../../density-volume.js';
import type { PreparedCssSky } from '../../prepared-data/sky/css-sky-types.js';

export type VolumeAxis = 'x' | 'y' | 'z';

export interface PreparedVolumeLeaf {
  readonly id: string;
  readonly centerUnits: VolumeVector;
  readonly texturePath: string;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly style: PreparedVolumeLeafStyle;
  readonly boundsCssPixels?: PreparedLeafBounds;
}

export interface PreparedVolumeStack {
  readonly axis: VolumeAxis;
  /** Prepared unit normal after an authored rigid model placement. */
  readonly normalUnits?: VolumeVector;
  readonly leaves: readonly PreparedVolumeLeaf[];
}

/** Offline projections of the same cloud, with its saved optical presentation. */
export interface PreparedVolumeImpostors {
  readonly schema: typeof PREPARED_VOLUME_IMPOSTORS_SCHEMA;
  readonly radiusUnits: number;
  readonly fullBelowDiameterPixels: number;
  readonly volumeAboveDiameterPixels: number;
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
  readonly resources: readonly { readonly path: string; readonly bytes: number; readonly width: number; readonly height: number }[];
  /** How the volume was made. A bake writes both; in the file a page fetches both are absent (volume-dataset-bank-files.ts). */
  readonly provenance: unknown;
  readonly approximation: unknown;
  readonly sky?: PreparedCssSky;
  readonly impostors?: PreparedVolumeImpostors;
  /** Fixed top pair plus a cylindrical side atlas, all prepared from the runtime slab composite. */
  readonly farPlanes?: {
    readonly gainBlend: readonly { readonly axis: VolumeAxis; readonly samples: readonly (readonly [number, number])[] }[];
    readonly radiusUnits: number;
    readonly belowDiameterPixels: number;
    readonly stacks: readonly PreparedVolumeStack[];
    readonly side: {
      readonly leaf: PreparedVolumeLeaf;
      readonly highTexturePath: string;
      readonly views: 16;
      /** Per azimuth: elevation degrees, normal opacity, bright opacity. */
      readonly coefficients: readonly (readonly (readonly [number, number, number])[])[];
    };
  };
  /** Each slice image already holds its three coincident optical copies (alpha 1 - (1 - a)^3): the runtime draws one
   * layer per slice at opacity gain / 3 instead of three. Absent, the runtime stacks the copies itself. */
  readonly mergedOpticalCopies?: 3;
  /** Rigid prepared pictures in one populated stack: one image per leaf, with no optical-length or view mixing. */
  readonly fixedImages?: true;
}
