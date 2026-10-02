import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validatePreparedCssVolume } from './css-volume-validation.js';
import type { PreparedCssVolume } from './css-volume-types.js';

const valid = (): PreparedCssVolume => ({
  schema: 'cssearth-css-volume@1', id: 'milky-way',
  frame: { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [0, 0, 0],
    localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1,
    boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } },
  anchors: [],
  stacks: [{ axis: 'x', leaves: [{ id: 'x-0', centerUnits: [0, 0, 0], texturePath: 'slices/x/00.png', widthPx: 2, heightPx: 2,
    style: { width: '2px', height: '2px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', backgroundSize: '2px 2px', backgroundPosition: '0px 0px' } }] },
    { axis: 'y', leaves: [{ id: 'y-0', centerUnits: [0, 0, 0], texturePath: 'slices/y/00.png', widthPx: 2, heightPx: 2,
      style: { width: '2px', height: '2px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', backgroundSize: '2px 2px', backgroundPosition: '0px 0px' } }] },
    { axis: 'z', leaves: [{ id: 'z-0', centerUnits: [0, 0, 0], texturePath: 'slices/z/00.png', widthPx: 2, heightPx: 2,
      style: { width: '2px', height: '2px', transform: 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)', backgroundSize: '2px 2px', backgroundPosition: '0px 0px' } }] }],
  resources: ['x', 'y', 'z'].map(axis => ({ path: `slices/${axis}/00.png`, bytes: 2, width: 2, height: 2 })),
  provenance: {}, approximation: {},
});

test('accepts the direct prepared CSS volume payload and all three stacks', () => {
  assert.equal(validatePreparedCssVolume(valid()).stacks.length, 3);
});

test('rejects a runtime URL in authored leaf style', () => {
  const value = valid();
  Object.assign(value.stacks[0]!.leaves[0]!, { style: { ...value.stacks[0]!.leaves[0]!.style, transform: 'url(/runtime.png)' } });
  assert.throws(() => validatePreparedCssVolume(value), /URL-free/);
});

test('rotated bank normals must remain an orthonormal basis', () => {
  const value = valid();
  const normals = [[0, 1, 0], [-1, 0, 0], [0, 0, 1]];
  value.stacks.forEach((stack, i) => Object.assign(stack, { normalUnits: normals[i] }));
  assert.deepEqual(validatePreparedCssVolume(value).stacks[0]!.normalUnits, [0, 1, 0]);
  Object.assign(value.stacks[1]!, { normalUnits: [0, 1, 0] }); assert.throws(() => validatePreparedCssVolume(value), /orthogonal/);
  Object.assign(value.stacks[1]!, { normalUnits: [0, 2, 0] }); assert.throws(() => validatePreparedCssVolume(value), /unit vector/);
});
