import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOURCE_MANIFEST_SCHEMA } from '@cssearth/objects';
import { validateSourceManifest, type SourceInput } from '@cssearth/objects/node';
import { formatManifestLookup, manifestLookup, manifestLookupOptions } from '@cssearth/bake/sources';

const input = (id: string, path: string, consumers: readonly string[], origin: string): SourceInput => ({ id, path, origin, credit: 'NASA', license: 'Public domain',
  acquisition: 'checked download', redistribution: 'allowed with credit', consumers, sourceBinding: { kind: 'local', reason: 'Fixture input without a catalogue record.' } });
const manifest = validateSourceManifest('fixture', { schema: SOURCE_MANIFEST_SCHEMA,
  inputs: [input('lro-color', 'surface/lroc-color.jpg', ['navigation'], 'https://example.org/lroc_color.jpg'),
    input('grail-gravity', 'datasets/grail.tif', ['datasets', 'science'], 'https://example.org/GRAIL_bouguer.tif')],
  generatedIntermediates: [{ path: 'surface/color-2k.png', generator: 'packages/bake/authoring/fixture/color.mts' }],
  documents: [{ path: 'reference/grail-paper.md', purpose: 'Method note for the gravity map' }, { path: 'NOTICE.md' }] });

test('a search reads every field of an entry, and the summary counts each kind it selected', () => {
  const options = manifestLookupOptions(['fixture', '--search=grail']);
  const lookup = manifestLookup('fixture', manifest, options);
  assert.deepEqual(lookup.entries.map(item => [item.kind, item.entry.path]), [['input', 'datasets/grail.tif'], ['document', 'reference/grail-paper.md']]);
  assert.deepEqual([lookup.total, lookup.counts], [5, { input: 1, generated: 0, document: 1 }]);
  assert.equal(formatManifestLookup(lookup, options), ['fixture: 2 of 5 entries (matching "grail"): input 1, document 1',
    'input      datasets/grail.tif  [grail-gravity]  for datasets, science', 'document   reference/grail-paper.md  (Method note for the gravity map)', ''].join('\n'));
  // An origin is a field like any other: the address finds the input that came from it.
  assert.deepEqual(manifestLookup('fixture', manifest, { search: 'LROC_COLOR.JPG' }).entries.map(item => item.entry.path), ['surface/lroc-color.jpg']);
});

test('a kind or a consumer selects entries, and the full form prints the whole record under its line', () => {
  assert.deepEqual(manifestLookup('fixture', manifest, { kind: 'generated' }).entries.map(item => item.entry.path), ['surface/color-2k.png']);
  const lookup = manifestLookup('fixture', manifest, { consumer: 'science' });
  assert.deepEqual(lookup.entries.map(item => item.entry.path), ['datasets/grail.tif']);
  const text = formatManifestLookup(lookup, { consumer: 'science', full: true, all: false });
  assert.match(text, /^fixture: 1 of 5 entries \(for science\): input 1\ninput {6}datasets\/grail\.tif .*\n {2}\{\n {4}"id": "grail-gravity",/u);
  assert.match(text, /\n {4}"origin": "https:\/\/example\.org\/GRAIL_bouguer\.tif",\n/u);
  assert.match(formatManifestLookup(manifestLookup('fixture', manifest, {}), { full: false, all: false }),
    /^fixture: 5 entries: input 2, generated 1, document 2\n(?:.*\n)*generated {2}surface\/color-2k\.png {2}by packages\/bake\/authoring\/fixture\/color\.mts\n(?:.*\n)*document {3}NOTICE\.md\n$/u);
});

test('options refuse an unknown kind and a consumer asked of entries that name none', () => {
  assert.deepEqual(manifestLookupOptions(['moon', 'mars', '--kind=document', '--full']).ids, ['moon', 'mars']);
  assert.throws(() => manifestLookupOptions(['moon', '--kind=inputs']), /Choose a kind from input, generated, document/u);
  assert.throws(() => manifestLookupOptions(['moon', '--kind=document', '--consumer=navigation']), /Only inputs name consumers/u);
  assert.throws(() => manifestLookupOptions([]), /at least one object id/u);
});
