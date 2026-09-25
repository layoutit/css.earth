import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { prepareText, reviewWarnings } from './prepare-text.mts';

test('every registered object has publishable reader text, and its published copies are current', async () => {
  const { objects, composition } = await prepareText({ check: true });
  assert.ok(objects > 0);
  assert.match(composition, /^(?:checked|skipped: )/u);
});

test('a run for named objects shows each warning about them once, not the catalogue\'s standing ones', () => {
  const shared = { objectId: 'aquitania', slot: 'card', rule: 'unique', detail: 'shared with siegena' };
  const standing = { objectId: 'wasp-18b', slot: 'datasets.temperature-0-97um.summary', rule: 'repetition', detail: 'repeats a sentence from datasets.temperature-0-89um.summary' };
  assert.deepEqual(reviewWarnings([standing, shared, standing, shared], ['aquitania', 'siegena']), [shared]);
  assert.deepEqual(reviewWarnings([standing, shared, standing], []), [standing, shared], 'a full run shows every object');
});

