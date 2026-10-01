import { test } from 'node:test';
import assert from 'node:assert/strict';
import { objectFacts } from './object-facts.js';

const source = { label: 'A paper (2020)', url: 'https://example.org/paper' };
const descriptor = (facts: unknown) => ({ schema: 'cssearth-object@2', id: 'm31', type: 'image-layer-bank', properties: { facts } });

test('reads the facts a package states, each with its source', () => {
  assert.deepEqual(objectFacts(descriptor([{ id: 'distance', label: 'Distance', value: '776 kpc', note: 'RR Lyrae.', source }])),
    [{ id: 'distance', label: 'Distance', value: '776 kpc', note: 'RR Lyrae.', source }]);
  assert.deepEqual(objectFacts({ schema: 'cssearth-object@2', id: 'earth', properties: {} }), []);
});

test('refuses a fact without a source, a repeated fact and a field it does not know, naming the file', () => {
  const fact = { id: 'distance', label: 'Distance', value: '776 kpc', source };
  assert.throws(() => objectFacts(descriptor([{ ...fact, source: undefined }])), /src\/objects\/m31\/object\.json: properties\.facts\[0\]\.source needs a label and an https url/);
  assert.throws(() => objectFacts(descriptor([{ ...fact, source: { ...source, url: 'http://example.org' } }])), /https url/);
  assert.throws(() => objectFacts(descriptor([fact, fact])), /properties\.facts\[1\] repeats the fact distance/);
  assert.throws(() => objectFacts(descriptor([{ ...fact, unit: 'kpc' }])), /needs an id, a label and a value/);
  assert.throws(() => objectFacts(descriptor({})), /is a list of facts/);
});
