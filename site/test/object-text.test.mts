import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OBJECT_TEXT_SCHEMA, PREPARED_TEXT_SCHEMA, compositionWarnings, parseObjectText, parsePreparedText, readerTextErrors, readerTextWarnings,
} from '../object-text.mts';

const source = { catalogueId: 'nasa-saturn-facts', url: 'https://science.nasa.gov/saturn/facts/', label: 'NASA Science · Saturn facts', checked: '2026-09-13' };
const blocks = {
  card: { text: 'Ringed gas giant, sixth planet from the Sun.', sources: [source] },
  introduction: { text: "Saturn's rings are billions of small chunks of ice and rock.", sources: [source] },
  datasets: { normal: { title: 'Global cloud map', summary: 'Cloud bands from archival visible-light images.' } },
};
const document = (overrides: Record<string, unknown> = {}) =>
  parseObjectText({ schema: OBJECT_TEXT_SCHEMA, objectId: 'saturn', ...blocks, ...overrides }, 'saturn');
const context = {
  name: 'Saturn', lenses: [{ id: 'normal', label: 'Visible color' }],
  catalogue: new Set([source.catalogueId]), evidencedDatasets: new Set(['normal']),
};
const rules = (findings: readonly { rule: string }[]) => findings.map(finding => finding.rule);

test('publishable text covers every dataset, stays within budget and cites catalogued sources', () => {
  assert.deepEqual(readerTextErrors(document(), context), []);
  assert.deepEqual(rules(readerTextErrors(document({ card: { text: `${'A long card line '.repeat(8)}.`, sources: [source] } }), context)), ['length']);
  assert.deepEqual(rules(readerTextErrors(document({ card: { text: 'Two sentences here. And another.', sources: [source] } }), context)), ['sentences']);
  assert.deepEqual(rules(readerTextErrors(document(), { ...context, lenses: [...context.lenses, { id: 'radar', label: 'Radar' }] })), ['coverage']);
  assert.deepEqual(rules(readerTextErrors(document({ card: { text: blocks.card.text, sources: [{ ...source, catalogueId: 'uncatalogued-page' }] } }), context)), ['citation']);
  assert.deepEqual(rules(readerTextErrors(document(), { ...context, evidencedDatasets: new Set() })), ['citation']);
  assert.throws(() => document({ card: { text: blocks.card.text, sources: [] } }), /needs at least one source/u);
});

test('filler, display words and repeated titles are warnings for a reviewer, not errors', () => {
  const filler = document({ card: { text: 'Explore Saturn in 3D with cssEarth.', sources: [source] },
    datasets: { normal: { title: 'Visible color', summary: blocks.datasets.normal.summary } } });
  assert.deepEqual(readerTextErrors(filler, context), []);
  assert.deepEqual(rules(readerTextWarnings(filler, context)), ['phrasing', 'phrasing', 'phrasing', 'specific-title']);
});

test('text shown together may not repeat a sentence or a six-word phrase, including identical blocks', () => {
  const sentence = 'Explored Saturn, its rings and its moons from orbit.';
  assert.deepEqual(compositionWarnings('saturn', [{ source: 'introduction', text: sentence }, { source: 'introduction', text: sentence }]), []);
  assert.deepEqual(compositionWarnings('saturn', [{ source: 'introduction', text: sentence }, { source: 'mission:cassini', text: sentence }]).map(finding => finding.detail),
    ['repeats a sentence from introduction']);
  const [shared] = compositionWarnings('saturn', [
    { source: 'introduction', text: 'Cassini explored Saturn and its rings from orbit for thirteen years.' },
    { source: 'mission:cassini', text: 'Explored Saturn and its rings from orbit, then dove into the planet.' },
  ]);
  assert.match(shared?.detail ?? '', /^shares “explored saturn and its rings from” with introduction$/u);
});

test('published text keeps the authored blocks and names the input it was checked from', () => {
  const prepared = parsePreparedText({ schema: PREPARED_TEXT_SCHEMA, objectId: 'saturn', ...blocks }, 'saturn');
  assert.equal(prepared.introduction.text, blocks.introduction.text);
  assert.throws(() => parsePreparedText({ schema: PREPARED_TEXT_SCHEMA, objectId: 'saturn', ...blocks }, 'titan'), /belongs to saturn/u);
  assert.throws(() => parsePreparedText({ schema: OBJECT_TEXT_SCHEMA, objectId: 'saturn', ...blocks }), /prepared text schema/u);
});
