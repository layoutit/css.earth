import type { PreparedLeafBounds } from '../rendering/prepared-leaf-frustum.js';
import type { PositionM } from '@cssearth/engine';
import type { PreparedVolumeLeafStyle } from '../volume/types.js';

/** Prepared celestial images, optionally placed at a finite inferred display distance. */
export interface PreparedCssSky {
  readonly schema: 'cssearth-css-sky@1';
  readonly referenceFrame: string;
  readonly epochJdTt: number;
  readonly radiusUnits: number;
  readonly parallax?: { readonly originM: PositionM; readonly metersPerCssPixel: number };
  readonly faces: readonly {
    readonly id: 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';
    readonly texturePath: string;
    readonly widthPx: number;
    readonly heightPx: number;
    readonly forwardIcrf: PositionM;
    readonly rightIcrf: PositionM;
    readonly upIcrf: PositionM;
    readonly style: PreparedVolumeLeafStyle;
    readonly boundsCssPixels?: PreparedLeafBounds;
  }[];
  /** The same cube with a prepared point field baked in, for the observer near
   * that field's origin; the plain faces take over as it travels away. */
  readonly nearFaces?: PreparedCssSky['faces'];
  readonly stars?: { readonly objectId: string; readonly cssPixelsPerDegree: number };
  readonly provenance: unknown;
  readonly approximation: unknown;
}
