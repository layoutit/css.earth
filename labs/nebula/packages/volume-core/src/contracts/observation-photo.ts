export interface ObservationPhoto {
  width: number; height: number; rgb: Uint8Array; intensity: Float32Array;
  coveredPixels: number;
  /** 1 where the source itself declared coverage, 0 where it declared none (an alpha-bearing source only). */
  sourceCoverage?: Uint8Array;
}
