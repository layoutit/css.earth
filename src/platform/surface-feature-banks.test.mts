import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { surfaceFeatureBankIndex } from './surface-feature-banks.mts';

test('surface feature bank addresses are stable and bounded', () => {
  assert.equal(surfaceFeatureBankIndex('12345', 64), 24);
  assert.equal(surfaceFeatureBankIndex('12345', 64), surfaceFeatureBankIndex('12345', 64));
  assert.ok(Array.from({ length: 1_000 }, (_, id) => surfaceFeatureBankIndex(String(id), 64)).every(index => index >= 0 && index < 64));
});

test('surface feature bank addresses reject ambiguous inputs', () => {
  assert.throws(() => surfaceFeatureBankIndex('feature-1', 64), /invalid/u);
  assert.throws(() => surfaceFeatureBankIndex('1', 0), /invalid/u);
  assert.throws(() => surfaceFeatureBankIndex('1', 257), /invalid/u);
});
