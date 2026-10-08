import assert from 'node:assert/strict';
import test from 'node:test';
import { DELIVERED_PREPARED_RECORDS, WORKING_PREPARED_RECORDS, deliveredPreparedFiles, deliveredPreparedRecord, isWorkingPreparedFile, retainsPreparedScene } from './prepared-delivery.ts';

test('a working record is never delivered, and a delivered record names its reader', () => {
  for (const name of ['scene.json', 'sky.json', 'sun.json', 'world-navigation.json', 'object.json', 'page.json', 'inventory.json', 'terrain.json', 'terrain-zimpol.json',
    'slope-source-index.json', 'provenance.json', 'lenses.json']) {
    assert.equal(isWorkingPreparedFile(name), true, name);
    assert.equal(deliveredPreparedRecord(name), undefined, name);
  }
  assert.equal(deliveredPreparedRecord('runtime.json')?.reader, 'page');
  assert.equal(deliveredPreparedRecord('source-lighting-dlr.json')?.reader, 'later-bake');
  for (const record of DELIVERED_PREPARED_RECORDS) assert.ok(record.read.length > 10, String(record.name));
  for (const record of WORKING_PREPARED_RECORDS) assert.ok(record.why.length > 10, String(record.name));
});

test('no name is both delivered and working', () => {
  const samples = ['runtime.json', 'controls.json', 'content.json', 'text.json', 'datasets.json', 'minimaps.json', 'arrival-billboard.json', 'authored-preparation.json',
    'assets.json', 'surfaces.json', 'material.json', 'members.json', 'world-context.json', 'volume.json', 'source-lighting.json'];
  for (const name of samples) { assert.ok(deliveredPreparedRecord(name), name); assert.equal(isWorkingPreparedFile(name), false, name); }
});

test('the delivered files of a directory: working records out, nested files in, an undeclared record refused', () => {
  const found = ['runtime.json', 'scene.json', 'sky.json', 'minimaps/color.webp', 'layers/z-detail.webp', 'dots.bin', 'eso-optical/volume.json', 'views/toi-700.json', 'terrain.json'];
  assert.deepEqual(deliveredPreparedFiles(found, 'fixture'), ['runtime.json', 'minimaps/color.webp', 'layers/z-detail.webp', 'dots.bin', 'eso-optical/volume.json', 'views/toi-700.json']);
  // A nested file named like a working record is its folder's own file.
  assert.deepEqual(deliveredPreparedFiles(['views/scene.json'], 'fixture'), ['views/scene.json']);
  assert.throws(() => deliveredPreparedFiles(['runtime.json', 'notes.json'], 'fixture'), /Object fixture wrote prepared record\(s\) the delivery ledger does not declare: notes\.json/u);
});

test('a lane whose refreshes repaint from its scene keeps the scene delivered; a sphere does not', () => {
  const descriptor = (...ids: string[]) => ({ properties: { recipe: { sources: ids.map(id => ({ id, path: `source/preparation/${id}.json` })) } } });
  assert.equal(retainsPreparedScene(descriptor('terrestrial', 'content')), true);
  assert.equal(retainsPreparedScene(descriptor('shape-model')), true);
  assert.equal(retainsPreparedScene(descriptor('paged-ellipsoid')), true);
  assert.equal(retainsPreparedScene(descriptor('geometry', 'presentation', 'raster')), false);
  for (const value of [null, undefined, 'object', {}, { properties: { recipe: {} } }]) assert.equal(retainsPreparedScene(value), false);
  assert.equal(isWorkingPreparedFile('scene.json', { retainsScene: true }), false);
  assert.equal(deliveredPreparedRecord('scene.json', { retainsScene: true })?.reader, 'later-bake');
  assert.deepEqual(deliveredPreparedFiles(['runtime.json', 'scene.json', 'sky.json'], 'fixture', { retainsScene: true }), ['runtime.json', 'scene.json']);
  assert.deepEqual(deliveredPreparedFiles(['runtime.json', 'scene.json', 'sky.json'], 'fixture'), ['runtime.json']);
});
