import type { DensityVolumeFrame, VolumeSliceQuad } from '@cssearth/objects';
import { compileCssVolume } from './volume.ts';

type Vector3 = [number, number, number];

/** One picture on a plane in `frame`, compiled by the same PolyCSS volume compiler as every other plane: the leaf's box
 * and matrix. `quad` is the picture's rectangle, on the frame's z axis. */
export function compilePlaneLeaf(id: string, frame: DensityVolumeFrame, quad: VolumeSliceQuad) {
  // The compiler wants a normal for every axis; empty quads carry the other two and compile to no leaf.
  const empty = (axis: 'x' | 'y', normal: Vector3): VolumeSliceQuad => ({ id: `${axis}-empty`, axis, sliceIndex: 0, texturePath: `${id}/${axis}-empty`, widthPx: 1, heightPx: 1,
    vertices: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], center: [0, 0, 0], normal, bytes: 0, alphaCoverage: 0 });
  const compiled = compileCssVolume({ id, frame, recipe: { anchors: [] }, slices: { quads: [quad, empty('x', [-1, 0, 0]), empty('y', [0, 1, 0])],
    boundsUnits: { min: [...frame.boundsUnits.min] as Vector3, max: [...frame.boundsUnits.max] as Vector3 }, provenance: null, approximation: { method: '', radialEmission: 'None.', limitations: [], samplesPerSlab: 1, opticalWeight: 1,
      exposureGain: 1, sliceCounts: { x: 0, y: 0, z: 1 }, slabPitchUnits: { x: 0, y: 0, z: 0 } } } });
  return compiled.stacks.find(stack => stack.axis === 'z')!.leaves[0]!;
}
