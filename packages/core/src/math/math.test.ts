import { describe, expect, it } from 'vitest';
import {
  clamp, cross3, dot3, dotN, invertPreparedAffineMatrix4, multiplyPreparedMatrix4, preparedRotationMatrix4, readPreparedMatrix4,
  requirePreparedMatrix4, serializePreparedMatrix4, transformPreparedPoint,
} from '../index.js';

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

describe('vectors and scalars', () => {
  it('cross3 is right-handed and dot3 reads only three components', () => {
    expect(cross3([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
    expect(dot3([1, 2, 3, 100], [4, 5, 6, 100])).toBe(32);
    expect(dotN([1, 2, 3, 4], [1, 1, 1, 1])).toBe(10);
  });
  it('clamp limits to the closed range', () => {
    expect([clamp(-1, 0, 1), clamp(0.5, 0, 1), clamp(2, 0, 1)]).toEqual([0, 0.5, 1]);
  });
});

describe('prepared matrix transport', () => {
  it('reads arrays and matrix3d text, and rejects anything else with the published messages', () => {
    expect(readPreparedMatrix4(`matrix3d(${IDENTITY.join(',')})`)).toEqual(IDENTITY);
    expect(() => requirePreparedMatrix4([1, 2])).toThrow('Prepared projection requires a finite matrix.');
    expect(() => readPreparedMatrix4('scale(2)')).toThrow('Prepared projection requires a matrix3d view.');
    expect(() => preparedRotationMatrix4('w', 1)).toThrow('Prepared rotation axis is invalid.');
    expect(() => invertPreparedAffineMatrix4(new Array(16).fill(0))).toThrow('Prepared material parent became singular.');
  });
  it('inverts an affine transform so the product is the identity', () => {
    const rotation = preparedRotationMatrix4('z', 30), moved = [...rotation.slice(0, 12), 4, -2, 7, 1];
    const product = multiplyPreparedMatrix4(moved, invertPreparedAffineMatrix4(moved));
    product.forEach((value, index) => expect(value).toBeCloseTo(IDENTITY[index]!, 12));
    expect(transformPreparedPoint(moved, 0, 0, 0, 1)).toEqual({ x: 4, y: -2, z: 7 });
    expect(serializePreparedMatrix4([1e-13, 0.1234567890123456, ...IDENTITY.slice(2)])).toBe(`matrix3d(0,0.123456789012,${IDENTITY.slice(2).join(',')})`);
  });
});
