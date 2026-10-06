import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatRecordLookup, formatRecordSweep, recordLookup, recordLookupOptions, recordTally, type RecordFile } from '@cssearth/bake/sources';

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
  // The search reads a value as its row prints it, so a key with its value finds that pair alone.
  assert.deepEqual(recordLookup('fixture', records, { search: 'id: "radius"' }).entries.map(entry => entry.path), ['.panel.facts[1]']);
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
  // A file that does not parse is named after the rows and counted among the package's files, and the others are still read.
  assert.equal(formatRecordLookup(recordLookup('fixture', records, { file: 'levels' }, ['source/orbit.json']), { file: 'levels', full: false, all: false }),
    'fixture: 1 of 9 entries (in files named "levels") in 1 of 5 JSON files\nsource/levels.json  .  .: [256,512]\nnot JSON, so not read: source/orbit.json\n');
});

test('options take object ids, a search and a file, and refuse a flag the lookup does not have', () => {
  assert.deepEqual(recordLookupOptions(['moon', 'mars', '--search=radius', '--file=object.json', '--full']),
    { ids: ['moon', 'mars'], every: false, search: 'radius', file: 'object.json', by: undefined, full: true, all: false, json: false });
  assert.throws(() => recordLookupOptions(['--search=radius']), /Name at least one object id/u);
  assert.throws(() => recordLookupOptions(['moon', '--kind=input']), /Unknown option '--kind'/u);
  // Every object is asked something: a search or a file, and no ids beside it.
  assert.deepEqual([recordLookupOptions(['--every', '--file=object.json']).ids, recordLookupOptions(['--every', '--search=radius']).every], [[], true]);
  assert.throws(() => recordLookupOptions(['--every']), /--every needs --search, --file or --by/u);
  assert.deepEqual([recordLookupOptions(['--every', '--by=kind']).by, recordLookupOptions(['moon', '--by=kind']).ids], ['kind', ['moon']]);
  assert.throws(() => recordLookupOptions(['moon', '--by=']), /--by takes a key/u);
  assert.throws(() => recordLookupOptions(['moon', '--every', '--search=radius']), /Name object ids or pass --every, not both/u);
});

test('a lookup of the one file asked for still says how many the package holds, and a sweep lists every object\'s rows by id', () => {
  const content = records.filter(record => record.file === 'source/content/object.json'), options = { search: 'radius', file: 'content', full: false, all: false };
  const moon = recordLookup('moon', content, options, [], 4);
  assert.equal(formatRecordLookup(moon, options).split('\n')[0], 'moon: 1 of 4 entries (in files named "content", matching "radius") in 1 of 4 JSON files');
  const sweep = [moon, recordLookup('ceres', [], options, [], 3), recordLookup('mars', content, options, ['source/content/orbit.json'], 5)];
  assert.equal(formatRecordSweep(sweep, options), ['2 of 3 objects hold 2 entries (in files named "content", matching "radius"); 2 JSON files read',
    'moon  source/content/object.json  .panel.facts[1]  id: "radius", label: "Mean radius", value: "1,737.4 km"',
    'mars  source/content/object.json  .panel.facts[1]  id: "radius", label: "Mean radius", value: "1,737.4 km"',
    'not JSON, so not read: mars/source/content/orbit.json', ''].join('\n'));
});

test('a key counts the entries that hold it by its value, for one object or over every object', () => {
  const ledger = (statuses: readonly string[]): RecordFile[] => [{ file: 'investigations.json', value: { schema: 'ledger', entries: statuses.map((status, index) => ({ id: `entry-${index}`, status })) } }];
  const options = { by: 'status', full: false, all: false };
  const moon = recordLookup('moon', ledger(['included', 'deferred', 'included']), options), mars = recordLookup('mars', ledger(['included', 'excluded']), options);
  // Only the entries that hold the key are selected: the ledger's own entry, which has a schema and no status, is not.
  assert.deepEqual([moon.entries.length, moon.total], [3, 4]);
  assert.deepEqual(recordTally(moon.entries, 'status'), [{ value: 'included', entries: 2 }, { value: 'deferred', entries: 1 }]);
  assert.equal(formatRecordLookup(moon, options), 'moon: 3 of 4 entries hold status in 1 of 1 JSON files\n2  "included"\n1  "deferred"\n');
  assert.equal(formatRecordSweep([moon, mars, recordLookup('ceres', [], options)], options),
    '2 of 3 objects hold 5 entries with status; 2 JSON files read\n3  "included"\n1  "deferred"\n1  "excluded"\n');
  // A search narrows what is counted.
  assert.equal(formatRecordLookup(recordLookup('moon', ledger(['included', 'deferred']), { ...options, search: 'entry-1' }), { ...options, search: 'entry-1' }),
    'moon: 1 of 3 entries hold status (matching "entry-1") in 1 of 1 JSON files\n1  "deferred"\n');
});
