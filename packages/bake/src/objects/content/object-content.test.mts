import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { projectRoot } from '@cssearth/core/node';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { authoredDatasetMetadata, OBJECT_CONTENT_SCHEMA, OBJECT_CONTENT_VERSION, parseCompleteObjectContentSource, validateObjectContentEnvelope } from '@cssearth/objects';

test('dataset source links come from the authored dataset records', async () => {
  const source: unknown = JSON.parse(await readFile(resolve(projectRoot(import.meta.url), 'src/objects/earth/source/content/object.json'), 'utf8'));
  const { sourceUrls: urls } = authoredDatasetMetadata(source, 'earth');
  assert.equal(urls.get('normal'), 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/july/world.200407.3x21600x10800.jpg');
  assert.equal(urls.get('clouds'), 'https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_8192.tif');
  assert.throws(() => authoredDatasetMetadata(source, 'mars'), /metadata owner differs/u);
});

test('a dataset without a direct source link is omitted from source URLs', async () => {
  const source: unknown = JSON.parse(await readFile(resolve(projectRoot(import.meta.url), 'src/objects/sun/source/content/object.json'), 'utf8'));
  const { sourceUrls: urls, systemDatasetIds } = authoredDatasetMetadata(source, 'sun');
  assert.equal(urls.get('cor1-density'), undefined);
  assert.ok(urls.get('photosphere'));
  assert.equal(systemDatasetIds.has('cor1-density'), false, 'the corona belongs to the Sun card');
});

test('Betelgeuse atmosphere volumes remain on its body card', async () => {
  const source: unknown = JSON.parse(await readFile(resolve(projectRoot(import.meta.url), 'src/objects/betelgeuse/source/content/object.json'), 'utf8'));
  assert.equal(authoredDatasetMetadata(source, 'betelgeuse').systemDatasetIds.size, 0);
});

test('debris discs stay with their host system card', async () => {
  for (const [id, datasets] of [
    ['beta-pictoris', ['debris-disc-visible', 'debris-disc-color', 'debris-disc']],
    ['hd-181327', ['debris-ring']],
    ['pds-70', ['dust-ring']],
  ] as const) {
    const source: unknown = JSON.parse(await readFile(resolve(projectRoot(import.meta.url), `src/objects/${id}/source/content/object.json`), 'utf8'));
    const { systemDatasetIds } = authoredDatasetMetadata(source, id);
    assert.deepEqual([...systemDatasetIds], datasets);
  }
});

test('authored envelope retains preparation admission and diagnostics', () => {
  assert.doesNotThrow(() => validateObjectContentEnvelope({schema: OBJECT_CONTENT_SCHEMA, version: OBJECT_CONTENT_VERSION, id: 'fixture'}));
  assert.throws(() => validateObjectContentEnvelope({schema: 'unsupported', version: OBJECT_CONTENT_VERSION, id: 'fixture'}), {message: 'fixture: unsupported object content schema'});
  assert.throws(() => validateObjectContentEnvelope({schema: OBJECT_CONTENT_SCHEMA, version: 2, id: 'fixture'}), {message: 'fixture: unsupported object content schema'});
});

test('source parser validates nested wire fields and preserves original metadata', async () => {
  const raw: unknown = JSON.parse(await readFile(resolve(projectRoot(import.meta.url), 'src/objects/earth/source/content/object.json'), 'utf8'));
  const parsed = parseCompleteObjectContentSource(raw);
  assert.equal(parsed, raw);
  const invalid = structuredClone(parsed);
  Reflect.set(invalid.datasets.controls[0].source, 'id', 7);
  assert.throws(() => parseCompleteObjectContentSource(invalid), /source.id/);
});

test('dataset metadata preserves owner, duplicate and scope diagnostics', () => {
  const source = {schema: OBJECT_CONTENT_SCHEMA, id: 'fixture', datasets: {controls: [{id: 'one'}, {id: 'one'}]}};
  assert.throws(() => authoredDatasetMetadata(source, 'other'), {message: 'other: dataset metadata owner differs.'});
  assert.throws(() => authoredDatasetMetadata(source, 'fixture'), {message: 'fixture: duplicate dataset one.'});
  assert.throws(() => authoredDatasetMetadata({...source, datasets: {controls: [{id: 'one', scope: 'body'}]}}, 'fixture'), {message: 'fixture: invalid dataset scope for one.'});
});

test('serialized identifiers stay byte-identical', () => {
  assert.equal(OBJECT_CONTENT_SCHEMA, 'cssearth-object-content@2');
  assert.equal(OBJECT_CONTENT_VERSION, 1);
});
