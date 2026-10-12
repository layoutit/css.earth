import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCrossref } from './archives.mts';

test('Crossref group authors retain their name without creating a blank catalogue creator', () => {
  const message = { title: ['HL Tau observations'], issued: { 'date-parts': [[2015]] },
    author: [{ name: 'ALMA Partnership' }, { given: 'C. L.', family: 'Brogan' }, {}], 'container-title': ['ApJL'], volume: '808', page: 'L3' };
  const paper = parseCrossref(JSON.stringify({ message }), '10.1088/2041-8205/808/1/L3', 'https://doi.org/10.1088/2041-8205/808/1/L3');
  assert.deepEqual(paper.creators, ['ALMA Partnership', 'C. L. Brogan']);
  assert.throws(() => parseCrossref(JSON.stringify({ message: { ...message, author: [{ name: 42 }] } }), '10.1/test', 'https://doi.org/10.1/test'), /group author/u);
});
