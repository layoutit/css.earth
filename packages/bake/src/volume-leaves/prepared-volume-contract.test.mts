import test from 'node:test';
import assert from 'node:assert/strict';
import { type VolumeRecipe, type VolumeSlices, type Bounds3, validatePreparedCssVolume } from '@cssearth/objects';
import { bakeSlab } from '../volume/node/index.ts';
import { compileCssVolume } from './volume.ts';

test('homogeneous emission produces the canonical one-byte alpha texel', () => {
  const count = 256;
  const recipe: VolumeRecipe = { schema: 'cssearth-volume-recipe@1', grid: { path: 'density.ktx2',
    dimensions: [1, 1, 1], encoding: 'sqrt-density-unorm8', bounds: { min: [-1, -1, -1], max: [1, 1, 1] } },
    material: { emission: [0, 1, 2].map(channel => ({ channel, color: [Number(channel === 0), Number(channel === 1), Number(channel === 2)], strength: 1 })),
      absorption: [], intensityScale: 1, stepScale: 1, exposureGain: 16 },
    bake: { sliceCounts: { x: count, y: count, z: count }, unitsPerSourceUnit: 1, imageWidth: 1, samplesPerSlab: 1, cropTransparent: false, opticalWeight: 1 },
    anchors: [], provenance: { path: 'provenance.json' } };
  const texel = bakeSlab({ width: 1, height: 1, depth: 1, encodedRgba: Buffer.from([32, 32, 32, 0]), recipe, provenance: {} }, 'z', 0, 2 / count, 1, 1, undefined).rgba;
  assert.deepEqual(([...texel]), [255, 255, 255, 1]);
});

test('compiled slices pass the portable objects contract with prepared bounds and resources', () => {
  const boundsUnits: Bounds3 = { min: [-1,-1,-1], max: [1,1,1] };
  const slices: VolumeSlices = { boundsUnits, provenance: {}, approximation: {
    method: 'fixture', radialEmission: 'homogeneous', limitations: [], samplesPerSlab: 1,
    opticalWeight: 1, exposureGain: 16, sliceCounts: { x: 1, y: 1, z: 1 }, slabPitchUnits: { x: 2, y: 2, z: 2 },
  }, quads: ['x','y','z'].map((axis, coordinate) => {
    const point = (u: number, v: number): [number,number,number] => {
      const p: [number,number,number] = [0,0,0]; p[(coordinate+1)%3] = u; p[(coordinate+2)%3] = v; return p;
    };
    const normal: [number,number,number] = [0,0,0]; normal[coordinate] = 1;
    assert.ok(axis === 'x' || axis === 'y' || axis === 'z');
    return { id: axis, axis, sliceIndex: 0, texturePath: `${axis}.png`, widthPx: 1, heightPx: 1, bytes: 1,
      vertices: [point(-1,-1), point(1,-1), point(1,1), point(-1,1)],
      uvs: [[0,0],[1,0],[1,1],[0,1]], center: [0,0,0], normal, alphaCoverage: 1 };
  }) };
  const volume = validatePreparedCssVolume(compileCssVolume({ id: 'fixture', frame: { referenceFrame: 'fixture', epochJdTt: 123, originM: [0,0,0],
    localToReferenceXyzw: [0,0,0,1], metersPerUnit: 1, boundsUnits }, recipe: { anchors: [] }, slices }));
  assert.deepEqual(volume.stacks.map(stack => stack.leaves.length), [1,1,1]);
  assert.equal(volume.resources.length, 3);
  assert.ok(volume.stacks.every(stack => stack.leaves[0]?.boundsCssPixels));
});
