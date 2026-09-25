import assert from 'node:assert/strict';
import { test } from 'vitest';
import { compilerPreparedSlices } from './compiler-frame.ts';
import { validateVolumeLayerSlices, type VolumeLayerPlan, type VolumeSlices, type VolumeSliceQuad } from '../contracts/volume-slices.ts';
import type { Vector3 } from '../contracts/volume-recipe.ts';

function sourceSlices(): VolumeSlices {
  const boundsUnits = { min: [-2, -3, -5] as Vector3, max: [2, 5, 11] as Vector3 };
  const plan: VolumeLayerPlan = { schema: 'cssearth-volume-layer-plan@1', referenceSliceCounts: { x: 4, y: 4, z: 8 }, referenceSamplesPerSlab: 4,
    axes: { x: [{ startCell: 0, endCell: 1 }, { startCell: 1, endCell: 4 }],
      y: [{ startCell: 0, endCell: 3 }, { startCell: 3, endCell: 4 }],
      z: [{ startCell: 0, endCell: 1 }, { startCell: 1, endCell: 3 }, { startCell: 3, endCell: 8 }] } };
  const quads: VolumeSliceQuad[] = [];
  for (const [axial, axis] of (['x', 'y', 'z'] as const).entries()) for (const [sliceIndex, group] of plan.axes[axis].entries()) {
    const pitch = (boundsUnits.max[axial]! - boundsUnits.min[axial]!) / plan.referenceSliceCounts[axis];
    const start = boundsUnits.min[axial]! + group.startCell * pitch, end = boundsUnits.min[axial]! + group.endCell * pitch, depth = (start + end) / 2;
    const point = (u: number, v: number): Vector3 => axis === 'x' ? [depth, u, v] : axis === 'y' ? [u, depth, v] : [u, v, depth];
    const horizontal = axis === 'x' ? 1 : 0, vertical = axis === 'z' ? 1 : 2;
    const u0 = boundsUnits.min[horizontal], u1 = boundsUnits.max[horizontal], v0 = boundsUnits.min[vertical], v1 = boundsUnits.max[vertical];
    quads.push({ id: `${axis}-${sliceIndex}`, axis, sliceIndex, texturePath: `${axis}-${sliceIndex}.png`, widthPx: 2, heightPx: 2,
      vertices: [point(u0, v1), point(u1, v1), point(u1, v0), point(u0, v0)], center: point((u0 + u1) / 2, (v0 + v1) / 2),
      normal: axis === 'x' ? [1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]],
      sha256: 'a'.repeat(64), bytes: 1, alphaCoverage: 1,
      slab: { start, end, startCell: group.startCell, endCell: group.endCell, samples: (group.endCell - group.startCell) * 4 } });
  }
  return { quads, boundsUnits, provenance: {}, approximation: { method: 'fixture', radialEmission: 'none', limitations: [],
    samplesPerSlab: 4, opticalWeight: 1, exposureGain: 1, sliceCounts: { x: 2, y: 2, z: 3 },
    slabPitchUnits: { x: 2, y: 4, z: 16 / 3 }, layerPlan: plan } };
}

test('prepared reflection keeps planned intervals, sample counts and logical indices valid in the reflected frame', () => {
  const source = sourceSlices(), before = structuredClone(source);
  assert.ok(validateVolumeLayerSlices(source));
  const prepared = compilerPreparedSlices(source);
  assert.ok(validateVolumeLayerSlices(prepared), 'Prepared interval metadata must describe the actual reflected physical planes.');
  assert.deepEqual(source, before);
  assert.deepEqual(prepared.boundsUnits, { min: [-2, -3, -11], max: [2, 5, 5] });
  assert.deepEqual(prepared.approximation.layerPlan!.axes.z,
    [{ startCell: 0, endCell: 5 }, { startCell: 5, endCell: 7 }, { startCell: 7, endCell: 8 }]);
  assert.deepEqual(prepared.quads.filter(q => q.axis === 'z').map(q => ({ id: q.id, index: q.sliceIndex, slab: q.slab })), [
    { id: 'z-0', index: 2, slab: { start: 3, end: 5, samples: 4, startCell: 7, endCell: 8 } },
    { id: 'z-1', index: 1, slab: { start: -1, end: 3, samples: 8, startCell: 5, endCell: 7 } },
    { id: 'z-2', index: 0, slab: { start: -11, end: -1, samples: 20, startCell: 0, endCell: 5 } },
  ]);
  assert.deepEqual(prepared.quads.map(q => [q.id, q.texturePath, q.sha256, q.uvs]), source.quads.map(q => [q.id, q.texturePath, q.sha256, q.uvs]));
  assert.deepEqual(compilerPreparedSlices(prepared), source, 'Reflecting geometry and interval metadata twice is an exact identity.');
});
