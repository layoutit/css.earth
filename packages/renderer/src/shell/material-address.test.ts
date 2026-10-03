import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SHELL_CORNER_PERMUTATIONS, shellMaterialAddress, validatePreparedCssSurfaceShell } from '@cssearth/objects';
import { nearestFacingIndex } from './material-address.js';
const authoredLevels = [-1, -.5, -.2, -.07, 0, .0125, .025, .0375, .05, .0625, .075, .0875, .1, .15, .2, .3, .4, .5, .625, .75, .875, 1];
const transform = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)';
// Small contract-built triangle: the reader has no preparation implementation or source data dependency.
const shell = validatePreparedCssSurfaceShell({ schema: 'cssearth-css-surface-shell@1', id: 'fixture', unitScale: 1,
  frame: { referenceFrame: 'fixture', epochJdTt: 123, originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1],
    metersPerUnit: 1, boundsUnits: { min: [-2, -2, -2], max: [2, 2, 2] } },
  atlas: { path: 'rim.png', tileSize: 32, columns: 46, frames: 2024, facingLevels: authoredLevels },
  visibility: { hiddenInsideM: 0, fullUntilM: 10, hiddenBeyondM: 20 },
  vertices: [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map(positionUnits => ({ positionUnits, radialNormal: positionUnits })),
  faces: [{ id: 'triangle', centerUnits: [1/3, 1/3, 1/3], radialNormal: [1, 0, 0], faceNormal: [1, 0, 0],
    atlasStepPixels: [32, 32], atlasOriginPixels: [0, 0], vertexIndices: [0, 1, 2],
    materialTransforms: SHELL_CORNER_PERMUTATIONS.map(() => transform),
    style: { width: '32px', height: '32px', transform, backgroundSize: '1472px 1408px' } }],
  resources: [{ path: 'rim.png', width: 1472, height: 1408, bytes: 1 }], provenance: {} });
const facingLevels = shell.atlas.facingLevels!;


test('every sorted triple and corner order selects its correct prepared tile without changing edge values', () => {
  const levels = facingLevels; let frame = 0;
  for (let a = 0; a < levels.length; a++) for (let b = a; b < levels.length; b++) for (let c = b; c < levels.length; c++, frame++) {
    for (const order of SHELL_CORNER_PERMUTATIONS) {
      const input = [a, b, c].map((_, i) => [a, b, c][order[i]!]!);
      const address = shellMaterialAddress(input[0]!, input[1]!, input[2]!, levels.length);
      assert.equal(Math.floor(address / 6), frame);
      const sorted = SHELL_CORNER_PERMUTATIONS[address % 6]!.map(i => input[i]!);
      assert.deepEqual(sorted, [a, b, c]);
    }
  }
  assert.equal(frame, 2024);
  for (let i = 0; i < levels.length; i++) assert.equal(nearestFacingIndex(levels[i]!, levels), i);
});


test('runtime facing quantization matches an exhaustive independent reference', () => {
  for (let sample = -1100; sample <= 1100; sample++) {
    const facing = sample / 1000;
    const expected = facingLevels.reduce((best, level, index) =>
      Math.abs(facing - level) < Math.abs(facing - facingLevels[best]!) ? index : best, 0);
    assert.equal(nearestFacingIndex(facing, facingLevels), expected);
  }
});
