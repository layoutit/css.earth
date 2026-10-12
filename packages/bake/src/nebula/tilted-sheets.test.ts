import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { DensityVolumeFrame, VolumeSliceQuad, VolumeSlices } from '@cssearth/objects';
import { compileCssVolume } from '../volume-leaves/index.ts';
import { tiltedSheetQuads } from './tilted-sheets.ts';

const frame = (localToReferenceXyzw: [number, number, number, number], half: [number, number, number]): DensityVolumeFrame => ({ referenceFrame: 'lab-sky-west-north-toward', epochJdTt: 2461286.5,
  originM: [0, 0, 0], localToReferenceXyzw, metersPerUnit: 1, boundsUnits: { min: [-half[0], -half[1], -half[2]], max: half } });
const sheet = (id: string, z: number, half: number): VolumeSliceQuad => ({ id, axis: 'z', sliceIndex: 0, texturePath: `slices/z/${id}.webp`, widthPx: 8, heightPx: 8,
  vertices: [[-half, half, z], [half, half, z], [half, -half, z], [-half, -half, z]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], center: [0, 0, z], normal: [0, 0, -1], bytes: 10, alphaCoverage: 1 });
const slices = (quads: VolumeSliceQuad[], half: [number, number, number]): VolumeSlices => ({ quads, boundsUnits: { min: [-half[0], -half[1], -half[2]], max: half }, provenance: null,
  approximation: { method: '', radialEmission: 'None.', limitations: [], samplesPerSlab: 8, opticalWeight: 1, exposureGain: 1, sliceCounts: { x: 0, y: 0, z: quads.length }, slabPitchUnits: { x: 0, y: 0, z: 1 } } });
// A quarter turn about x: the tilted grid's z lies along the host's -y.
const QUARTER_ABOUT_X: [number, number, number, number] = [Math.SQRT1_2, 0, 0, Math.SQRT1_2];

test('a tilted recipe\'s sheets are turned into the grid\'s frame and drawn with its z stack', () => {
  const host = frame([0, 0, 0, 1], [10, 10, 1]), [turned] = tiltedSheetQuads([sheet('00', 0.5, 2)], frame(QUARTER_ABOUT_X, [2, 2, 1]), host, 0, 3);
  assert.equal(turned!.id, 'z-tilted-0-0'); assert.equal(turned!.tilted, true); assert.equal(turned!.sliceIndex, 3);
  assert.equal(turned!.texturePath, 'tilted-0/slices/z/00.webp');
  const close = (actual: readonly number[], expected: readonly number[]) => actual.forEach((value, axis) => assert.ok(Math.abs(value - expected[axis]!) < 1e-12, `${actual} is not ${expected}`));
  close(turned!.center, [0, -0.5, 0]); close(turned!.normal, [0, 1, 0]); close(turned!.vertices[0], [-2, -0.5, 2]);
  assert.throws(() => tiltedSheetQuads([sheet('00', 0, 2)], { ...frame(QUARTER_ABOUT_X, [2, 2, 1]), originM: [1, 0, 0] }, host, 0, 0), /shares its grid's reference frame, unit and origin/u);
  assert.throws(() => tiltedSheetQuads([{ ...sheet('00', 0, 2), axis: 'x' }], frame(QUARTER_ABOUT_X, [2, 2, 1]), host, 0, 0), /slabs across its z only/u);
});

test('a disc prepared as sheets compiles one stack, and a tilted sheet joins it without being parallel', () => {
  const half: [number, number, number] = [10, 10, 1], host = frame([0, 0, 0, 1], half), flat = [sheet('z-0', -0.5, 10), sheet('z-1', 0.5, 10)];
  const tilted = tiltedSheetQuads([sheet('00', 0, 2)], frame(QUARTER_ABOUT_X, [2, 2, 1]), host, 0, 2);
  const volume = compileCssVolume({ id: 'sheets', frame: host, slices: slices([...flat, ...tilted], half), recipe: { anchors: [] } });
  assert.deepEqual(volume.stacks.map(stack => [stack.axis, stack.leaves.length]), [['x', 0], ['y', 0], ['z', 3]]);
  assert.equal(volume.stacks[2]!.normalUnits, undefined);
  // Without the mark, a sheet that is not parallel to its stack is refused as before.
  const unmarked = tilted.map(({ tilted: _tilted, ...quad }) => quad);
  assert.throws(() => compileCssVolume({ id: 'sheets', frame: host, slices: slices([...flat, ...unmarked], half), recipe: { anchors: [] } }), /parallel unit normals/u);
});
