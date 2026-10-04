import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePreparedPanelContent, PREPARED_CONTENT_SCHEMA } from './prepared-content.js';

const content = () => ({schema: PREPARED_CONTENT_SCHEMA, objectId: 'fixture', title: {label: 'Fixture'},
  facts: [{id: 'mass', label: 'Mass', value: '1', source: {ignored: true}}], moreFacts: [],
  charts: [{id: 'chart', title: {label: 'Chart'}, src: 'chart.webp', width: 0, height: -1, alt: ''}], galleries: [],
  resources: 'not rendered', provenance: null});

test('panel projection preserves historical accepted fields and omitted source metadata', () => {
  const parsed = parsePreparedPanelContent(content());
  assert.deepEqual(parsed.facts, [{id: 'mass', label: 'Mass', value: '1'}]);
  assert.equal(parsed.charts[0].width, 0);
  assert.equal(parsed.charts[0].height, -1);
  assert.equal(Object.hasOwn(parsed, 'resources'), false);
});

test('panel projection pins schema and nested field diagnostics', () => {
  assert.throws(() => parsePreparedPanelContent({...content(), schema: 'unsupported'}), {message: 'Prepared panel content schema is incompatible.'});
  assert.throws(() => parsePreparedPanelContent({...content(), title: {label: 7}}), {message: 'Prepared title label must be text.'});
  assert.throws(() => parsePreparedPanelContent({...content(), facts: [{id: 'mass', label: 'Mass', value: {}}]}), {message: 'Prepared fact value must be text.'});
  assert.throws(() => parsePreparedPanelContent({...content(), charts: [{...content().charts[0], open: 'yes'}]}), {message: 'Prepared chart open must be boolean.'});
});

test('serialized identifiers stay byte-identical', () => {
  assert.equal(PREPARED_CONTENT_SCHEMA, 'cssearth-prepared-content@2');
});
