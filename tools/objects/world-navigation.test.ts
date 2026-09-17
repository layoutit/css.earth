import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { preparePhysicalWorldFrame, transform, multiply, transpose, type Matrix3 } from './world-navigation.js';
import { chain, POLYCSS_SURFACE_PLACEMENT } from './world-navigation-sources.js';

const identity: Matrix3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
/** PolyCSS's own surface placement: body +x along CSS +y, body +y along CSS +x. */
const swap: Matrix3 = [0, 1, 0, 1, 0, 0, 0, 0, 1];
const physical = { referenceFrame: 'test-inertial', epochJdTt: 2461286.5, originM: [100, 200, -300] as const,
  bodyToReference: identity, bodyToPresentation: swap, orbitUpReference: [0, 0, 1] as const,
  renderedRadiusUnits: 253, physicalRadiusM: 6378137 };

describe('authored physical frame preparation', () => {
  it('preserves physical scale without rounding to the presentation diameter', () => {
    const frame = preparePhysicalWorldFrame(physical);
    assert.equal(frame.metersPerUnit * 253, 6378137);
    assert.deepEqual(frame.originM, [100, 200, -300]);
    assert.notEqual(frame.metersPerUnit, 6378137 / 230);
  });
  it('composes the authored body and inertial axes instead of assuming identity or ecliptic presentation', () => {
    const bodyToPresentation = multiply(chain('rotateZ(60deg)', 'rotateY(-23.4deg)', 'rotateZ(-128deg)'), swap);
    const bodyToReference = chain('rotateX(17deg)', 'rotateZ(31deg)');
    const frame = preparePhysicalWorldFrame({ ...physical, bodyToPresentation, bodyToReference });
    for (const axis of [[1, 0, 0], [0, 1, 0], [0, 0, 1]] as const) {
      const reference = transform(frame.presentationToReference, transform(bodyToPresentation, axis));
      transform(bodyToReference, axis).forEach((value, index) => assert.ok(Math.abs(reference[index] - value) < 1e-13));
    }
    assert.notDeepEqual(frame.presentationToReference, identity);
  });
  it('rejects proper, scaled, translated and undefined frame inputs: a body drawn in CSS 3D space is a reflection', () => {
    assert.deepEqual([POLYCSS_SURFACE_PLACEMENT.prime, POLYCSS_SURFACE_PLACEMENT.east], [[0, 1, 0], [1, 0, 0]]);
    assert.throws(() => preparePhysicalWorldFrame({ ...physical, bodyToPresentation: identity }), /handedness/);
    assert.throws(() => preparePhysicalWorldFrame({ ...physical, bodyToPresentation: [2, 0, 0, 0, 1, 0, 0, 0, 1] }), /orthonormal/);
    assert.throws(() => chain('translate3d(1px,0px,0px)'), /Unsupported/);
    assert.throws(() => preparePhysicalWorldFrame({ ...physical, renderedRadiusUnits: 0 }), /radii/);
  });
  it('parses authored CSS rotation order without changing the physical axis convention', () => {
    const basis = chain('transform:rotateZ(60deg) rotateY(-23.4deg)', 'transform:rotateZ(-128deg)');
    const product = multiply(basis, transpose(basis));
    product.forEach((component, index) => assert.ok(Math.abs(component - identity[index]) < 1e-14));
    const rotated = transform(chain('rotateZ(90deg)'), [1, 0, 0]);
    assert.ok(Math.abs(rotated[0]) < 1e-14); assert.equal(rotated[1], 1); assert.equal(rotated[2], 0);
  });
});
