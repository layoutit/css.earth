import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRecordLookup, recordLookup, recordLookupOptions, type RecordFile } from '@cssearth/bake/sources';

const records: RecordFile[] = [
  { file: 'object.json', value: { id: 'fixture', parent: 'fixture-system', properties: { worldFrame: { referenceFrame: 'sun-icrf', originM: [1, 2, 3], bodyRadiusM: 1737400 } } } },
  { file: 'source/content/object.json', value: { panel: { facts: [
    { id: 'distance', label: 'Solar semimajor axis', value: '1.524 AU', source: { url: 'https://example.org/orbits', checked: '2026-09-08' } },
    { id: 'radius', label: 'Mean radius', value: '1,737.4 km' }] }, 'more facts': { 'day length': '27.3 days' } } },
  { file: 'source/points.json', value: [[1, 2], { name: 'first', at: [3, 4] }] },
  { file: 'source/levels.json', value: [256, 512] },
];

test('a search reads an entry\'s path, keys and values, so a label finds the value kept beside it', () => {
  const label = recordLookup('fixture', records, { search: 'mean RADIUS' });
  assert.deepEqual(label.entries, [{ file: 'source/content/object.json', path: '.panel.facts[1]', fields: { id: 'radius', label: 'Mean radius', value: '1,737.4 km' } }]);
  assert.deepEqual([label.total, label.files], [9, [{ file: 'object.json', entries: 2 }, { file: 'source/content/object.json', entries: 4 }, { file: 'source/points.json', entries: 2 }, { file: 'source/levels.json', entries: 1 }]]);
  // A key finds its value, and a path finds every entry under it.
  assert.deepEqual(recordLookup('fixture', records, { search: 'radiusm' }).entries.map(entry => [entry.path, entry.fields.bodyRadiusM]), [['.properties.worldFrame', 1737400]]);
  assert.deepEqual(recordLookup('fixture', records, { search: 'facts[0]' }).entries.map(entry => entry.path), ['.panel.facts[0]', '.panel.facts[0].source']);
  assert.deepEqual(recordLookup('fixture', records, { search: 'radius', file: 'CONTENT' }).entries.map(entry => entry.file), ['source/content/object.json']);
  // A file is named by any part of its path, so `object.json` names the descriptor and the content record alike.
  assert.deepEqual([...new Set(recordLookup('fixture', records, { file: 'object.json' }).entries.map(entry => entry.file))], ['object.json', 'source/content/object.json']);
});

test('an entry is an object or list with values of its own, and its path is one jq reads', () => {
  const paths = (file: string) => recordLookup('fixture', records, {}).entries.filter(entry => entry.file === file).map(entry => [entry.path, entry.fields]);
  // A list of numbers is a value of the entry that holds it; a list of objects only holds entries.
  assert.deepEqual(paths('object.json'), [['.', { id: 'fixture', parent: 'fixture-system' }], ['.properties.worldFrame', { referenceFrame: 'sun-icrf', originM: [1, 2, 3], bodyRadiusM: 1737400 }]]);
  assert.deepEqual(paths('source/points.json'), [['.', { '[0]': [1, 2] }], ['.[1]', { name: 'first', at: [3, 4] }]]);
  assert.deepEqual(paths('source/levels.json'), [['.', { '.': [256, 512] }]]);
  assert.deepEqual(recordLookup('fixture', records, { search: 'day length' }).entries, [{ file: 'source/content/object.json', path: '.["more facts"]', fields: { 'day length': '27.3 days' } }]);
});

test('without a search or a file the lookup says where the records are; with one it prints the asked values first', () => {
  assert.equal(formatRecordLookup(recordLookup('fixture', records, {}), { full: false, all: false }),
    ['fixture: 9 entries in 4 JSON files', '2  object.json', '4  source/content/object.json', '2  source/points.json', '1  source/levels.json', ''].join('\n'));
  const options = recordLookupOptions(['fixture', '--search=radius']);
  assert.equal(formatRecordLookup(recordLookup('fixture', records, options), options), ['fixture: 2 of 9 entries (matching "radius") in 2 of 4 JSON files',
    'object.json  .properties.worldFrame  bodyRadiusM: 1737400, referenceFrame: "sun-icrf", originM: [1,2,3]',
    'source/content/object.json  .panel.facts[1]  id: "radius", label: "Mean radius", value: "1,737.4 km"', ''].join('\n'));
  const long = [{ file: 'notes.json', value: { note: 'x'.repeat(200), ...Object.fromEntries(Array.from({ length: 12 }, (_, index) => [`field${index}`, 'y'.repeat(40)])), asked: 'needle' } }];
  const cut = formatRecordLookup(recordLookup('fixture', long, { search: 'needle' }), { search: 'needle', full: false, all: false }).split('\n')[1];
  assert.match(cut, /^notes\.json {2}\. {2}asked: "needle", note: "x{79}…, field0: /u);
  assert.equal(cut.length, 'notes.json  .  '.length + 201);
  assert.match(formatRecordLookup(recordLookup('fixture', long, { search: 'needle' }), { search: 'needle', full: true, all: false }), /\n {2}\{\n {4}"note": "x{200}",\n/u);
  // A file that does not parse is named after the rows, and the others are still read.
  assert.equal(formatRecordLookup(recordLookup('fixture', records, { file: 'levels' }, ['source/orbit.json']), { file: 'levels', full: false, all: false }),
    'fixture: 1 of 9 entries (in files named "levels") in 1 of 4 JSON files\nsource/levels.json  .  .: [256,512]\nnot JSON, so not read: source/orbit.json\n');
});

test('options take object ids, a search and a file, and refuse a flag the lookup does not have', () => {
  assert.deepEqual(recordLookupOptions(['moon', 'mars', '--search=radius', '--file=object.json', '--full']),
    { ids: ['moon', 'mars'], search: 'radius', file: 'object.json', full: true, all: false, json: false });
  assert.throws(() => recordLookupOptions(['--search=radius']), /Name at least one object id/u);
  assert.throws(() => recordLookupOptions(['moon', '--kind=input']), /Unknown option '--kind'/u);
});
