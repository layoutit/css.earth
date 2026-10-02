import type { PreparedLeafBounds } from './prepared-leaf-bounds.js';
export type PreparedSkyVector = readonly [number, number, number];

export const PREPARED_CSS_SKY_SCHEMA = 'cssearth-css-sky@1';

/** Prepared celestial images, optionally placed at a finite inferred display distance. */
export interface PreparedCssSky {
  readonly schema: typeof PREPARED_CSS_SKY_SCHEMA;
  readonly referenceFrame: string;
  readonly epochJdTt: number;
  readonly radiusUnits: number;
  readonly parallax?: { readonly originM: PreparedSkyVector; readonly metersPerCssPixel: number };
  readonly faces: readonly {
    readonly id: 'px' | 'nx' | 'py' | 'ny' | 'pz' | 'nz';
    readonly texturePath: string;
    readonly widthPx: number;
    readonly heightPx: number;
    readonly forwardIcrf: PreparedSkyVector;
    readonly rightIcrf: PreparedSkyVector;
    readonly upIcrf: PreparedSkyVector;
    readonly style: { readonly width: string; readonly height: string; readonly transform: string; readonly backgroundSize: string; readonly backgroundPosition: string };
    readonly boundsCssPixels?: PreparedLeafBounds;
  }[];
  readonly provenance: unknown;
  readonly approximation: unknown;
}

/** Exact resource metadata shared by the sky writer and reader. */
export type PreparedSkyResources = readonly { readonly path: string; readonly bytes: number; readonly width: number; readonly height: number }[];
