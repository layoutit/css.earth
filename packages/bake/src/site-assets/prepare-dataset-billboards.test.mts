import assert from 'node:assert/strict';
import { test } from 'node:test';
import { imageLayerQuadLeaves } from './prepare-dataset-billboards.ts';

const CORNERS = [[0, 0], [1, 0], [1, 1], [0, 1]];
const square = [[0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0]];
const quad = (id: string) => ({ id, verticesUnits: square, uvs: CORNERS });
const shape = (id: string) => ({ id, verticesUnits: square, uvs: [[0.25, 0.25], [0.5, 0.25], [0.5, 0.5], [0.25, 0.5]] });

test('a bank mixing slices and shell shape leaves is drawn from its slices', () => {
  const leaves = [quad('z-detail'), shape('shape-0000'), shape('shape-0001'), quad('z-wide')];
  assert.deepEqual(imageLayerQuadLeaves('cassiopeia-a-layers', leaves).map(leaf => leaf.id), ['z-detail', 'z-wide']);
});

test('a bank of shape leaves only has no billboard to draw', () => {
  assert.throws(() => imageLayerQuadLeaves('cassiopeia-a-layers', [shape('shape-0000')]), /no source-facing slice/u);
});

test('a leaf that is neither a corner quad nor a shape leaf is refused', () => {
  assert.throws(() => imageLayerQuadLeaves('m31', [quad('z-detail'), { id: 'z-odd', verticesUnits: square, uvs: shape('x').uvs }]), /a slice must be one quad with corner UVs/u);
  assert.throws(() => imageLayerQuadLeaves('m31', [quad('z-detail'), { id: 'z-odd', verticesUnits: square.slice(0, 3), uvs: CORNERS }]), /a slice must be one quad/u);
});

test('a bank of only whole-picture slices is unchanged', () => {
  const leaves = [quad('a'), quad('b')];
  assert.deepEqual(imageLayerQuadLeaves('m31', leaves), leaves);
});
