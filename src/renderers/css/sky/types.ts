import type { PositionM } from '@cssearth/engine';
import type { PreparedVolumeLeafStyle } from '../volume/types.js';

/** Prepared distant directions; translation does not change this background. */
export interface PreparedCssSky {
  readonly schema: 'cssearth-css-sky@1';
  readonly referenceFrame: string;
  readonly epochJdTt: number;
  readonly radiusUnits: number;
  readonly faces: readonly {
    readonly id: 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';
    readonly texturePath: string;
    readonly widthPx: number;
    readonly heightPx: number;
    readonly forwardIcrf: PositionM;
    readonly rightIcrf: PositionM;
    readonly upIcrf: PositionM;
    readonly style: PreparedVolumeLeafStyle;
  }[];
  readonly provenance: unknown;
  readonly approximation: unknown;
}
