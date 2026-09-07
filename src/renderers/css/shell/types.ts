import type { DensityVolumeFrame } from '@cssearth/objects';
import type { PositionM } from '@cssearth/engine';

/** Prepared transparent surface geometry and a view-facing material bank. */
export interface PreparedCssSurfaceShell {
  readonly schema: 'cssearth-css-surface-shell@1';
  readonly id: string;
  readonly frame: DensityVolumeFrame;
  readonly unitScale: number;
  readonly atlas: { readonly path: string; readonly tileSize: number; readonly columns: number; readonly frames: number;
    /** Sorted corner triples, enumerated a <= b <= c. Omitted for a constant-facing bank. */
    readonly facingLevels?: readonly number[];
    /** Pixel-area coverage surrounds all three edges inside this transparent image guard. */
    readonly triangleInsetPixels?: number };
  readonly vertices?: readonly { readonly positionUnits: PositionM; readonly radialNormal: PositionM }[];
  readonly visibility: { readonly hiddenInsideM: number; readonly fullUntilM: number; readonly hiddenBeyondM: number };
  readonly faces: readonly {
    readonly id: string;
    readonly centerUnits: PositionM;
    readonly radialNormal: PositionM;
    readonly faceNormal: PositionM;
    readonly style: { readonly width: string; readonly height: string; readonly transform: string; readonly backgroundSize: string };
    readonly atlasStepPixels: readonly [number, number];
    readonly atlasOriginPixels: readonly [number, number];
    readonly vertexIndices?: readonly [number, number, number];
    /** The same physical triangle in each of the six atlas corner orders. */
    readonly materialTransforms?: readonly string[];
  }[];
  readonly resources: readonly { readonly path: string; readonly sha256: string; readonly bytes: number; readonly width: number; readonly height: number }[];
  readonly provenance: Readonly<Record<string, unknown>>;
}
