import test from 'node:test';
import assert from 'node:assert/strict';
import type { VolumeSource } from '@cssearth/bake/volume/node';
import { parseDensityPlacement, densityPlacementTransform } from '@cssearth/bake/volume';
import { prepareDensityProjection } from './density-projection.ts';

test('placed density projection samples original voxels through the inverse model transform', () => {
  const source: VolumeSource = { width: 2, height: 2, depth: 2, encodedRgba: Uint8Array.from({ length: 32 }, (_, i) => i % 4 === 3 ? 255 : 0),
    provenance: {}, recipe: { schema: 'cssearth-volume-recipe@1', grid: { path: 'grid.ktx2',
      dimensions: [2, 2, 2], encoding: 'linear-density-unorm8', bounds: { min: [-1, -2, -1], max: [1, 2, 1] } },
      material: { emission: [{ channel: 3, color: [1, 1, 1], strength: 1 }], absorption: [], intensityScale: 1, stepScale: 1, exposureGain: 1 },
      bake: { sliceCounts: { x: 2, y: 2, z: 2 }, unitsPerSourceUnit: 1, imageWidth: 2, samplesPerSlab: 1, cropTransparent: false, opticalWeight: 1 },
      anchors: [], provenance: { path: 'provenance.json' } } };
  const placement = parseDensityPlacement({ schema: 'cssearth-density-placement@1', scale: 1.5, rotationZDegrees: 70,
    pivotUnits: [0, 0, 0], translationUnits: [8, 7, 0] });
  const before = Buffer.from(source.encodedRgba), transform = densityPlacementTransform(placement);
  const projection = prepareDensityProjection(source, 60, 16, placement);
  assert.equal(projection.densityAt(...transform.point([0, 0, 0])), 1);
  assert.equal(projection.densityAt(0, 0, 0), 0);
  assert.equal(projection.densityAt(...transform.point([0, 2.1, 0])), 0);
  assert.deepEqual(Buffer.from(source.encodedRgba), before);
});
