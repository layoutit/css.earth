import assert from 'node:assert/strict';
import { test } from 'node:test';
import { outwardSphere } from './spatial-context.ts';

const holds = (rounded: ReturnType<typeof outwardSphere>, exact: { centerM: readonly number[]; radiusM: number }) =>
  rounded.radiusM >= exact.radiusM + Math.hypot(...rounded.centerM.map((value, axis) => value - exact.centerM[axis]!));

test('a culling sphere is written in millionths of its radius and still holds the sphere it rounds', () => {
  const exact = { centerM: [149597870700.123, -2.5e10, 12345.678] as const, radiusM: 384400000.5 }, rounded = outwardSphere(exact);
  assert.ok(holds(rounded, exact));
  assert.ok(rounded.radiusM <= exact.radiusM * (1 + 3e-6));
  assert.equal(rounded.centerM[0], 149597870700);
});

test('a centre too far from the Sun to be written in those steps is kept, so the sphere grows by no more than its step', () => {
  // A hosted orbit in the Andromeda Galaxy: doubles are 4e6 m apart at its centre, its step is 1e4 m.
  const exact = { centerM: [1.7455991783029173e22, 3.4406937275875485e21, 1.5734668090095776e22] as const, radiusM: 15728618329.414434 }, rounded = outwardSphere(exact);
  assert.deepEqual([...rounded.centerM], [...exact.centerM]);
  assert.ok(holds(rounded, exact));
  assert.ok(rounded.radiusM <= exact.radiusM * (1 + 3e-6), `${rounded.radiusM}`);
});
