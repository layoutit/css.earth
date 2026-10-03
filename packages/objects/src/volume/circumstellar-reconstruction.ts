/** Data-only reconstruction written by the lab; scientific evaluation stays with callers. */
export const CIRCUMSTELLAR_RECONSTRUCTION_SCHEMA = 'cssearth-circumstellar-reconstruction@2';
export interface CircumstellarOpacity {
  readonly drawnColumns: number; readonly median: number; readonly p90: number; readonly max: number;
}
export interface EdgeOnReconstruction {
  readonly schema: typeof CIRCUMSTELLAR_RECONSTRUCTION_SCHEMA; readonly objectId: string; readonly datasetId: string;
  readonly grid: { readonly size: number; readonly halfUnits: number };
  readonly method: Record<string, unknown>; readonly ktx2: { readonly path: string; readonly bytes: number };
  readonly peak: number; readonly filledVoxels: number; readonly exposureGain: number;
  readonly opacity: CircumstellarOpacity; readonly checks: Record<string, unknown>;
}
