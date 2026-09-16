import type { Axis, Bounds3, DisplayColorMatrix, Vector3, VolumeRecipe } from './volume-recipe.ts';
export interface VolumeSliceQuad {
  id: string; axis: Axis; sliceIndex: number; texturePath: string; widthPx: number; heightPx: number;
  /** Image top-left first: required by PolyCSS's image/projective backend. */
  vertices: [Vector3, Vector3, Vector3, Vector3];
  uvs: [[number, number], [number, number], [number, number], [number, number]];
  center: Vector3; normal: Vector3; sha256: string; bytes: number; alphaCoverage: number;
}
export interface VolumeSlices {
  quads: VolumeSliceQuad[]; boundsUnits: Bounds3; provenance: unknown;
  approximation: { method: string; radialEmission: string; limitations: string[];
    samplesPerSlab: number; opticalWeight: number; exposureGain: number;
    displayColorMatrix?: DisplayColorMatrix; emissionTransfer?: VolumeRecipe['material']['emissionTransfer'];
    sliceCounts: Record<Axis, number>; slabPitchUnits: Record<Axis, number> };
}
