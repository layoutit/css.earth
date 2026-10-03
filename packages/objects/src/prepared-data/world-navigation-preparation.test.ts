import assert from 'node:assert/strict';
import test from 'node:test';
import { WORLD_NAVIGATION_PREPARATION_SCHEMA, requireWorldNavigationReceiptIdentity, requireWorldNavigationReceiptContext, samePreparedWorldFrame } from './world-navigation-preparation.ts';

const frame = { referenceFrame: 'icrf', epochJdTt: 2451545, originM: [0, 0, 0], presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], bodyRadiusM: 1000, metersPerUnit: 1 };
const receipt = { schema: WORLD_NAVIGATION_PREPARATION_SCHEMA, id: 'probe', frame, model: 'authored-context-focus' };

test('world receipts retain tolerant frame identity and diagnostic ordering', () => {
  assert.equal(WORLD_NAVIGATION_PREPARATION_SCHEMA, 'cssearth-world-navigation-preparation@1');
  requireWorldNavigationReceiptIdentity(receipt, 'probe', { ...frame, metersPerUnit: 1 + 1e-10 });
  for (const input of [{ ...receipt, schema: 'other' }, { ...receipt, id: 'other' }, { ...receipt, frame: { ...frame, metersPerUnit: 2 } }])
    assert.throws(() => requireWorldNavigationReceiptIdentity(input, 'probe', frame), { message: 'Authored physical frame receipt differs from its descriptor.' });
  for (const bodyRadiusM of [0, NaN, Infinity, '1']) {
    const invalid = { ...frame, bodyRadiusM };
    assert.throws(() => requireWorldNavigationReceiptIdentity({ ...receipt, frame: invalid }, 'probe', invalid), { message: 'Authored physical frame has invalid physical units.' });
  }
});

test('authored-context receipts compare only the historically selected fields', () => {
  requireWorldNavigationReceiptContext(receipt, frame, { ...frame, extra: true });
  for (const input of [{ ...receipt, model: 'other' }, { ...receipt, model: undefined }])
    assert.throws(() => requireWorldNavigationReceiptContext(input, frame, frame), { message: 'Authored physical frame does not reproduce its authored context.' });
  assert.throws(() => requireWorldNavigationReceiptContext(receipt, frame, null), /Authored context frame/);
  assert.throws(() => requireWorldNavigationReceiptContext(receipt, frame, { ...frame, orbitUpReference: [0, 1, 0] }), /does not reproduce/);
});

test('frame comparison preserves JSON recursive and primitive equality', () => {
  assert.ok(samePreparedWorldFrame([NaN, Infinity, -0], [NaN, Infinity, 0]));
  assert.ok(samePreparedWorldFrame({ a: [1] }, { a: [1 + 1e-10] }));
  for (const [left, right] of [[null, undefined], [[1], [1, 2]], [{ a: 1 }, { b: 1 }], [1, 1 + 1e-7]])
    assert.equal(samePreparedWorldFrame(left, right), false);
});
