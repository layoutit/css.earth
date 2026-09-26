import { describe, expect, it } from 'vitest';
import { validateWorldReflection, validateWorldRotation } from './world-rotation.js';

const identity = [1, 0, 0, 0, 1, 0, 0, 0, 1];
// A quarter turn about z: orthonormal, determinant +1.
const quarterTurn = [0, -1, 0, 1, 0, 0, 0, 0, 1];
// CSS to a right-handed reference frame flips y: orthonormal, determinant -1.
const flipY = [1, 0, 0, 0, -1, 0, 0, 0, 1];

describe('validateWorldRotation', () => {
  it('accepts proper rotations', () => {
    expect(() => validateWorldRotation(identity)).not.toThrow();
    expect(() => validateWorldRotation(quarterTurn)).not.toThrow();
  });
  it('rejects a wrong length or non-finite component', () => {
    expect(() => validateWorldRotation(identity.slice(0, 8))).toThrow('World rotation must contain nine finite components.');
    expect(() => validateWorldRotation([...identity.slice(0, 8), Number.NaN])).toThrow('World rotation must contain nine finite components.');
  });
  it('rejects a matrix whose rows are not orthonormal', () => {
    expect(() => validateWorldRotation([2, 0, 0, 0, 1, 0, 0, 0, 1])).toThrow('World rotation must be orthonormal.');
    expect(() => validateWorldRotation([1, 0, 0, 1, 0, 0, 0, 0, 1])).toThrow('World rotation must be orthonormal.');
  });
  it('rejects a reflection', () => {
    expect(() => validateWorldRotation(flipY)).toThrow('World rotation must preserve handedness.');
  });
});

describe('validateWorldReflection', () => {
  it('accepts a handedness-reversing map', () => {
    expect(() => validateWorldReflection(flipY)).not.toThrow();
  });
  it('rejects a proper rotation and a non-orthonormal matrix', () => {
    expect(() => validateWorldReflection(identity)).toThrow('A map between CSS and a reference frame must reverse handedness.');
    expect(() => validateWorldReflection([1, 0, 0, 0, -2, 0, 0, 0, 1])).toThrow('World rotation must be orthonormal.');
    expect(() => validateWorldReflection([Number.POSITIVE_INFINITY, ...flipY.slice(1)])).toThrow('World rotation must contain nine finite components.');
  });
});
