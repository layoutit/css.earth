import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import {
  clamp, cross3, dot3, dotN, invertPreparedAffineMatrix4, multiplyPreparedMatrix4, preparedRotationMatrix4, readPreparedMatrix4,
  requirePreparedMatrix4, serializePreparedMatrix4, transformPreparedPoint,
} from '../index.js';

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

describe('vectors and scalars', () => {
  it('cross3 is right-handed and dot3 reads only three components', () => {
    assert.deepEqual(cross3([1, 0, 0], [0, 1, 0]), [0, 0, 1]);
    assert.equal(dot3([1, 2, 3, 100], [4, 5, 6, 100]), 32);
    assert.equal(dotN([1, 2, 3, 4], [1, 1, 1, 1]), 10);
  });
  it('clamp limits to the closed range', () => {
    assert.deepEqual(([clamp(-1, 0, 1), clamp(0.5, 0, 1), clamp(2, 0, 1)]), [0, 0.5, 1]);
  });
});

describe('prepared matrix transport', () => {
  it('reads arrays and matrix3d text, and rejects anything else with the published messages', () => {
    assert.deepEqual(readPreparedMatrix4(`matrix3d(${IDENTITY.join(',')})`), IDENTITY);
    assert.throws(() => requirePreparedMatrix4([1, 2]), /Prepared projection requires a finite matrix\./);
    assert.throws(() => readPreparedMatrix4('scale(2)'), /Prepared projection requires a matrix3d view\./);
    assert.throws(() => preparedRotationMatrix4('w', 1), /Prepared rotation axis is invalid\./);
    assert.throws(() => invertPreparedAffineMatrix4(new Array(16).fill(0)), /Prepared material parent became singular\./);
  });
  it('inverts an affine transform so the product is the identity', () => {
    const rotation = preparedRotationMatrix4('z', 30), moved = [...rotation.slice(0, 12), 4, -2, 7, 1];
    const product = multiplyPreparedMatrix4(moved, invertPreparedAffineMatrix4(moved));
    product.forEach((value, index) => assert.ok(Math.abs(value - (IDENTITY[index]!)) < 10 ** -12 / 2, `${value} is not close to ${IDENTITY[index]!}`));
    assert.deepEqual(transformPreparedPoint(moved, 0, 0, 0, 1), { x: 4, y: -2, z: 7 });
    assert.equal(serializePreparedMatrix4([1e-13, 0.1234567890123456, ...IDENTITY.slice(2)]), `matrix3d(0,0.123456789012,${IDENTITY.slice(2).join(',')})`);
  });
});
