import assert from 'node:assert/strict';
import test from 'node:test';
import { DELIVERED_PREPARED_RECORDS, WORKING_PREPARED_RECORDS, deliveredPreparedFiles, deliveredPreparedRecord, isWorkingPreparedFile, preparedDeliveryContext } from './prepared-delivery.ts';

test('a working record is never delivered, and a delivered record names its reader', () => {
  for (const name of ['scene.json', 'material.json', 'image-quality.json', 'title.json', 'runtime-assets.json', 'material-datasets.json', 'views.json', 'layouts.json', 'sky.json', 'sun.json', 'world-navigation.json', 'object.json', 'page.json', 'inventory.json', 'terrain.json', 'terrain-zimpol.json',
    'slope-source-index.json', 'provenance.json', 'lenses.json']) {
    assert.equal(isWorkingPreparedFile(name), true, name);
    assert.equal(deliveredPreparedRecord(name), undefined, name);
  }
  assert.equal(deliveredPreparedRecord('runtime.json')?.reader, 'page');
  assert.equal(deliveredPreparedRecord('source-lighting-dlr.json')?.reader, 'later-bake');
  assert.equal(deliveredPreparedRecord('surface-raster-plan.json')?.reader, 'later-bake');
  // Every delivered record names who reads it: none is listed on trust.
  for (const record of DELIVERED_PREPARED_RECORDS) assert.ok(['page', 'site-build', 'later-bake'].includes(record.reader), String(record.name));
  for (const record of DELIVERED_PREPARED_RECORDS) assert.ok(record.read.length > 10, String(record.name));
  for (const record of WORKING_PREPARED_RECORDS) assert.ok(record.why.length > 10, String(record.name));
});

test('no name is both delivered and working', () => {
  const samples = ['runtime.json', 'leaf-boxes.json', 'content.json', 'text.json', 'datasets.json', 'minimaps.json', 'arrival-billboard.json', 'authored-preparation.json',
    'assets.json', 'surfaces.json', 'members.json', 'world-context.json', 'volume.json', 'source-lighting.json'];
  for (const name of samples) { assert.ok(deliveredPreparedRecord(name), name); assert.equal(isWorkingPreparedFile(name), false, name); }
});

test('the delivered files of a directory: working records out, nested files in, an undeclared record refused', () => {
  const found = ['runtime.json', 'scene.json', 'sky.json', 'minimaps/color.webp', 'layers/z-detail.webp', 'dots.bin', 'eso-optical/volume.json', 'views/toi-700.json', 'terrain.json'];
  assert.deepEqual(deliveredPreparedFiles(found, 'fixture'), ['runtime.json', 'minimaps/color.webp', 'layers/z-detail.webp', 'dots.bin', 'eso-optical/volume.json', 'views/toi-700.json']);
  // A nested file named like a working record is its folder's own file.
  assert.deepEqual(deliveredPreparedFiles(['views/scene.json'], 'fixture'), ['views/scene.json']);
  assert.throws(() => deliveredPreparedFiles(['runtime.json', 'notes.json'], 'fixture'), /Object fixture wrote prepared record\(s\) the delivery ledger does not declare: notes\.json/u);
});

test('the paged lane, whose reuse-images run reads its scene, keeps it delivered; a shape body and a sphere do not', () => {
  const descriptor = (...ids: string[]) => ({ properties: { recipe: { sources: ids.map(id => ({ id, path: `source/preparation/${id}.json` })) } } });
  const retains = (value: unknown) => preparedDeliveryContext(value).retainsScene;
  assert.equal(retains(descriptor('terrestrial', 'content')), false);
  assert.equal(retains(descriptor('shape-model')), false);
  assert.equal(retains(descriptor('paged-ellipsoid')), true);
  assert.equal(retains(descriptor('geometry', 'presentation', 'raster')), false);
  for (const value of [null, undefined, 'object', {}, { properties: { recipe: {} } }]) assert.deepEqual(preparedDeliveryContext(value), { retainsScene: false, keepsMaterial: false });
  assert.equal(isWorkingPreparedFile('scene.json', { retainsScene: true }), false);
  assert.equal(deliveredPreparedRecord('scene.json', { retainsScene: true })?.reader, 'later-bake');
  assert.deepEqual(deliveredPreparedFiles(['runtime.json', 'scene.json', 'sky.json'], 'fixture', { retainsScene: true }), ['runtime.json', 'scene.json']);
  assert.deepEqual(deliveredPreparedFiles(['runtime.json', 'scene.json', 'sky.json'], 'fixture'), ['runtime.json']);
});

test('a solid sphere keeps its material; a shape body, whose material would be its surface list again, has none', () => {
  const shaped = (kind: string) => ({ properties: { recipe: { shape: { kind }, sources: [{ id: 'terrestrial' }] } } });
  assert.equal(preparedDeliveryContext(shaped('sphere')).keepsMaterial, true);
  assert.equal(preparedDeliveryContext(shaped('ellipsoid')).keepsMaterial, true);
  assert.equal(preparedDeliveryContext(shaped('radial-terrain')).keepsMaterial, false);
  const found = ['runtime.json', 'scene.json', 'surfaces.json', 'material.json'];
  assert.deepEqual(deliveredPreparedFiles(found, 'io', preparedDeliveryContext(shaped('sphere'))), ['runtime.json', 'surfaces.json', 'material.json']);
  assert.deepEqual(deliveredPreparedFiles(found, 'eros', preparedDeliveryContext(shaped('radial-terrain'))), ['runtime.json', 'surfaces.json']);
});
