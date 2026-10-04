import { PREPARED_CSS_VOLUME_SCHEMA, PREPARED_VOLUME_IMPOSTORS_SCHEMA } from './volume-schemas.js';
import type { PreparedLeafBounds } from '../../prepared-data/presentation/prepared-leaf-bounds.js';
import type { DensityVolumeFrame, VolumeVector } from '../../density-volume.js';
import type { PreparedCssSky } from '../../prepared-data/sky/css-sky-types.js';

export type VolumeAxis = 'x' | 'y' | 'z';

export interface PreparedVolumeLeafStyle {
  readonly width: string;
  readonly height: string;
  readonly transform: string;
  readonly backgroundSize: string;
  readonly backgroundPosition: string;
}

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
}
