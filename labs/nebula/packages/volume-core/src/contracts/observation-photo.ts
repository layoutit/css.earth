export interface ObservationPhoto {
  width: number; height: number; rgb: Uint8Array; intensity: Float32Array;
  coveredPixels: number;
}
