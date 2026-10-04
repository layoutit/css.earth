import assert from 'node:assert/strict';
import test from 'node:test';
import { OBJECT_TEXT_SCHEMA, PREPARED_TEXT_SCHEMA, parseCitedText, parseObjectText, parsePreparedText } from './object-text.js';

const source = { catalogueId: 'nasa-saturn-facts', url: 'https://science.nasa.gov/saturn/facts/', label: 'NASA Science · Saturn facts', checked: '2026-09-13' };
const blocks = {
  card: { text: 'Ringed gas giant, sixth planet from the Sun.', sources: [source] },
  introduction: { text: "Saturn's rings are billions of small chunks of ice and rock.", sources: [source] },
  datasets: { normal: { title: 'Global cloud map', summary: 'Cloud bands from archival visible-light images.' } },
};

test('published text keeps the authored blocks and names the input it was checked from', () => {
  const prepared = parsePreparedText({ schema: PREPARED_TEXT_SCHEMA, objectId: 'saturn', ...blocks }, 'saturn');
  assert.equal(prepared.introduction.text, blocks.introduction.text);
  assert.throws(() => parsePreparedText({ schema: PREPARED_TEXT_SCHEMA, objectId: 'saturn', ...blocks }, 'titan'), /belongs to saturn/u);
  assert.throws(() => parsePreparedText({ schema: OBJECT_TEXT_SCHEMA, objectId: 'saturn', ...blocks }), /prepared text schema/u);
  assert.throws(() => parsePreparedText(undefined, 'toi-6008b'), /^TypeError: toi-6008b: prepared\/text\.json is missing; run the bake's text step/u, 'a body baked short of its text step is named');
});

test('authored text and citation format validate identity, sources and exact schema', () => {
  assert.equal(OBJECT_TEXT_SCHEMA, 'cssearth-object-text@1');
  assert.equal(PREPARED_TEXT_SCHEMA, 'cssearth-prepared-text@1');
  assert.throws(() => parseCitedText({ text: 'Text.', sources: [] }, 'card'), /^TypeError: card needs at least one source\.$/u);
  assert.throws(() => parseObjectText({ schema: PREPARED_TEXT_SCHEMA, objectId: 'saturn', ...blocks }), /^TypeError: Unsupported object text schema\.$/u);
  assert.throws(() => parseObjectText({ schema: OBJECT_TEXT_SCHEMA, objectId: 'saturn', ...blocks }, 'titan'), /belongs to saturn/u);
  assert.throws(() => parseCitedText({ text: 'Text.', sources: [{ ...source, quote: 'a'.repeat(301) }] }, 'card'), /limited to 300 characters/u);
  assert.ok(Object.isFrozen(parseObjectText({ schema: OBJECT_TEXT_SCHEMA, objectId: 'saturn', ...blocks })));
});
