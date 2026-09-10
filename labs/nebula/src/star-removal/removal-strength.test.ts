import assert from 'node:assert/strict';
import test from 'node:test';
import { createRemovalStrengthStore, validateRemovalStrength } from './removal-strength.js';

test('removal strength defaults to 100 and survives reload independently for each original source', () => {
  let saved: string | null = null;
  const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } };
  const current = createRemovalStrengthStore(storage);
  assert.equal(current.get('vista'), 100);
  current.set('vista', 0); current.set('wise', 50); current.set('horalek', 100);
  const reloaded = createRemovalStrengthStore(storage);
  assert.equal(reloaded.get('vista'), 0); assert.equal(reloaded.get('wise'), 50); assert.equal(reloaded.get('horalek'), 100);
  assert.equal(reloaded.get('another'), 100);
  assert.throws(() => current.set('vista', 101), TypeError); assert.equal(current.get('vista'), 0);
});
test('malformed records cannot suppress valid source preferences and unavailable storage keeps session values', () => {
  const raw = JSON.stringify({ schema: 'cssearth-nebula-removal-strength@1', values: [['good', 35], ['negative', -1], ['overflow', 101], ['string', '50']] });
  const loaded = createRemovalStrengthStore({ getItem: () => raw, setItem() { throw new Error('denied'); } });
  assert.equal(loaded.get('good'), 35); assert.equal(loaded.get('negative'), 100); assert.equal(loaded.get('overflow'), 100); assert.equal(loaded.get('string'), 100);
  loaded.set('good', 20); assert.equal(loaded.get('good'), 20);
  for (const value of [-1, 101, NaN, Infinity]) assert.throws(() => validateRemovalStrength(value), TypeError);
});
