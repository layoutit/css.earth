import assert from 'node:assert/strict';
import test from 'node:test';
import { readBibliography } from './bibliography.js';

test('bibliography keeps source keys and locators with nested or escaped title braces', () => {
  const entry = '@ARTICLE{Example2026,\n title = "{A {nested} title}",\n adsurl = {https://example.org/paper},\n}\n';
  const parsed = readBibliography(entry + entry);
  assert.equal(parsed.size, 1, 'identical duplicate records in the retained bibliography are harmless');
  assert.deepEqual(parsed.get('Example2026'), { id: 'Example2026', catalogueId: 'publication-example2026', url: 'https://example.org/paper', citation: 'Example2026: A nested title' });
  assert.throws(() => readBibliography(entry + entry.replace('nested', 'different')), /Conflicting bibliography key/);
  assert.throws(() => readBibliography(entry.replace('https://example.org/paper', 'javascript:alert(1)')), /Invalid bibliography URL/);
  assert.throws(() => readBibliography(entry.replace('"{A {nested} title}"', 'macroTitle')), /Unsupported bibliography field/);
  assert.throws(() => readBibliography(entry.replace('"{A {nested} title}"', '"first" # "second"')), /Unsupported bibliography concatenation/);
  assert.equal(readBibliography('@ARTICLE{NoLocator,\n title={No online locator},\n}\n').size, 0);
});
