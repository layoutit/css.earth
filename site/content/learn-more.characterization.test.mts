import assert from 'node:assert/strict';
import { test } from 'node:test';
import { wikipediaLearnMoreUrl } from './learn-more.mts';
test('authored links win and search preserves punctuation and Unicode', () => {
  assert.equal(wikipediaLearnMoreUrl('Ignored', '/authored'), '/authored');
  assert.equal(wikipediaLearnMoreUrl('A & B/α?', ''), 'https://en.wikipedia.org/wiki/Special:Search?search=A+%26+B%2F%CE%B1%3F&go=Go');
  assert.equal(wikipediaLearnMoreUrl(''), 'https://en.wikipedia.org/wiki/Special:Search?search=&go=Go');
});
