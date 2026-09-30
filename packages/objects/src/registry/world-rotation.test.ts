import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { validateWorldReflection, validateWorldRotation } from './world-rotation.js';

const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
// A quarter turn about z: orthonormal, determinant +1.
const quarterTurn = [0, -1, 0, 1, 0, 0, 0, 0, 1];
// CSS to a right-handed reference frame flips y: orthonormal, determinant -1.
const flipY = [1, 0, 0, 0, -1, 0, 0, 0, 1];

describe('validateWorldRotation', () => {
  it('accepts proper rotations', () => {
    assert.doesNotThrow(() => validateWorldRotation(identity));
    assert.doesNotThrow(() => validateWorldRotation(quarterTurn));
  });
  it('rejects a wrong length or non-finite component', () => {
    assert.throws(() => validateWorldRotation(identity.slice(0, 8)), /World rotation must contain nine finite components\./);
    assert.throws(() => validateWorldRotation([...identity.slice(0, 8), Number.NaN]), /World rotation must contain nine finite components\./);
  });
  it('rejects a matrix whose rows are not orthonormal', () => {
    assert.throws(() => validateWorldRotation([2, 0, 0, 0, 1, 0, 0, 0, 1]), /World rotation must be orthonormal\./);
    assert.throws(() => validateWorldRotation([1, 0, 0, 1, 0, 0, 0, 0, 1]), /World rotation must be orthonormal\./);
  });
  it('rejects a reflection', () => {
    assert.throws(() => validateWorldRotation(flipY), /World rotation must preserve handedness\./);
  });
});

describe('validateWorldReflection', () => {
  it('accepts a handedness-reversing map', () => {
    assert.doesNotThrow(() => validateWorldReflection(flipY));
  });
  it('rejects a proper rotation and a non-orthonormal matrix', () => {
    assert.throws(() => validateWorldReflection(identity), /A map between CSS and a reference frame must reverse handedness\./);
    assert.throws(() => validateWorldReflection([1, 0, 0, 0, -2, 0, 0, 0, 1]), /World rotation must be orthonormal\./);
    assert.throws(() => validateWorldReflection([Number.POSITIVE_INFINITY, ...flipY.slice(1)]), /World rotation must contain nine finite components\./);
  });
});
