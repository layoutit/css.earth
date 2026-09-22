import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { prepareText } from './prepare-text.mts';

test('every registered object has publishable reader text, and its published copies are current', async () => {
  const { objects, composition } = await prepareText({ check: true });
  assert.ok(objects > 0);
  assert.match(composition, /^(?:checked|skipped: )/u);
});
