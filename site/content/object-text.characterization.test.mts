import assert from 'node:assert/strict';
import { test } from 'node:test';
import { OBJECT_TEXT_SCHEMA, parseObjectText } from '@cssearth/objects';
import { catalogueTextWarnings, textBlockBudgetErrors, textBudgetErrors, sentences, compositionWarnings, readerTextErrors } from './object-text.mts';
const citation = { catalogueId: 'source', url: 'https://example.test/source', label: 'Source', checked: '2026-01-01' };
const text = (id: string, name: string) => parseObjectText({ schema: OBJECT_TEXT_SCHEMA, objectId: id, card: { text: `${name} has bright rings.`, sources: [citation] }, introduction: { text: `${name} has several moons.`, sources: [citation] }, datasets: { normal: { title: 'Ring image', summary: 'The rings reflect light.', detail: 'Optical', sources: [citation] } } }, id);
test('catalogue warnings normalize names and list only three peers plus the remainder', () => {
  const entries = ['one', 'two', 'three', 'four', 'five', 'six'].map((id, i) => ({ text: text(id, 'Body' + i), name: 'Body' + i }));
  const findings = catalogueTextWarnings(entries);
  assert.equal(findings.length, 12);
  assert.equal(catalogueTextWarnings(entries.slice(0, 4))[0].detail, 'shared with two, three, four');
  assert.equal(catalogueTextWarnings(entries.slice(0, 5))[0].detail, 'shared with two, three, four and 1 more');
  assert.deepEqual(findings[0], { objectId: 'one', slot: 'card', rule: 'unique', detail: 'shared with two, three, four and 2 more' });
  assert.deepEqual(catalogueTextWarnings(entries.slice(0, 1)), []);
  assert.equal(catalogueTextWarnings(entries.slice(0, 2))[0].detail, 'shared with two');
});
test('budgets and sentence splitting retain abbreviation and punctuation behavior', () => {
  assert.deepEqual(sentences('Dr. A. Smith saw it. Next?'), ['Dr. A. Smith saw it.', 'Next?']);
  assert.deepEqual(sentences(''), []);
  assert.deepEqual(textBudgetErrors(text('one', 'Body')), []);
  assert.deepEqual(textBlockBudgetErrors('one', 'title', 'Label.').map(x => x.rule), ['punctuation']);
  assert.deepEqual(textBlockBudgetErrors('one', 'summary', 'No full stop').map(x => x.rule), ['punctuation']);
  assert.deepEqual(textBlockBudgetErrors('one', 'title', 'x'.repeat(40)), []);
  assert.deepEqual(textBlockBudgetErrors('one', 'title', 'x'.repeat(41)).map(x => x.rule), ['length']);
  assert.deepEqual(compositionWarnings('one', [{ source: 'same', text: 'Old.' }, { source: 'same', text: 'New.' }, { source: 'other', text: 'Old.' }]), [], 'last block for a source wins');
  const doc = text('one', 'Body');
  const errors = readerTextErrors(doc, { name: 'Body', datasets: [], catalogue: new Set(), evidencedDatasets: new Set() });
  assert.ok(errors.some(x => x.rule === 'coverage'));
  assert.ok(errors.some(x => x.slot === 'datasets.normal' && x.rule === 'citation'));
});

test('composition phrases require exactly six shared words', () => {
  const pair = (words: string) => [{ source: 'first', text: `Before ${words}.` }, { source: 'second', text: `After ${words}!` }];
  assert.deepEqual(compositionWarnings('one', pair('one two three four five')), []);
  assert.deepEqual(compositionWarnings('one', pair('one two three four five six')), [{
    objectId: 'one', slot: 'second', rule: 'composition', detail: 'shares “one two three four five six” with first',
  }]);
});
test('dataset sources may be omitted only for an evidenced dataset', () => {
  const cited = text('one', 'Body');
  const document = parseObjectText({ ...cited, datasets: { normal: { title: 'Ring image', summary: 'The rings reflect light.' } } }, 'one');
  const context = { name: 'Body', datasets: [{ id: 'normal', label: 'Visible' }], catalogue: new Set(['source']), evidencedDatasets: new Set(['normal']) };
  assert.deepEqual(readerTextErrors(document, context), []);
  assert.deepEqual(readerTextErrors(document, { ...context, evidencedDatasets: new Set() }), [{
    objectId: 'one', slot: 'datasets.normal', rule: 'citation', detail: 'cite the sources this summary describes; its prepared product names none',
  }]);
});
