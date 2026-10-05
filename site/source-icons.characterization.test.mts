import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseSourceIcons } from './source-icons.mts';
test('source icon parsing keeps only the public fields and freezes both levels', () => {
  const value = parseSourceIcons({ 'example.test': { sourceUrl: 'http://example.test/path', ignored: 1 }, 'doi:10.123': { sourceUrl: 'https://doi.org/x', assetUrl: 'https://example.test/icon' } });
  assert.deepEqual(value, { 'example.test': { sourceUrl: 'http://example.test/path' }, 'doi:10.123': { sourceUrl: 'https://doi.org/x', assetUrl: 'https://example.test/icon' } });
  assert.ok(Object.isFrozen(value));
  assert.ok(Object.isFrozen(value['doi:10.123']));
  assert.deepEqual(parseSourceIcons({}), {});
});
test('bad keys, records and insecure assets retain their error messages', () => {
  for (const input of [null, [], 'x']) assert.throws(() => parseSourceIcons(input), /must be an object of icons by key/);
  for (const raw of [null, { sourceUrl: 1 }, { sourceUrl: 'ftp://x' }, { sourceUrl: 'https://x y' }]) assert.throws(() => parseSourceIcons({ x: raw }), /needs a host or doi: key and a sourceUrl/);
  assert.throws(() => parseSourceIcons({ 'Bad Key': { sourceUrl: 'https://x' } }), /Invalid source icon Bad Key/);
  for (const assetUrl of ['http://x', '/x', null, 1]) assert.throws(() => parseSourceIcons({ x: { sourceUrl: 'https://x', assetUrl } }), /assetUrl must be an https address/);
});
