import assert from 'node:assert/strict';
import { test } from 'node:test';
import { refusedPreparedRows } from './check-prepared-delivery.mts';

const inventory = (...filenames: string[]) => ({ assets: [{ location: 'public', filename: 'scene.json' }, ...filenames.map(filename => ({ location: 'prepared', filename }))] });
const sphere = { properties: { recipe: { sources: [{ id: 'geometry' }, { id: 'raster' }] } } };
const shape = { properties: { recipe: { shape: { kind: 'radial-terrain' }, sources: [{ id: 'terrestrial' }] } } };

test('delivered records, nested files and public files pass', () => {
  assert.deepEqual(refusedPreparedRows('vega', inventory('runtime.json', 'leaf-boxes.json', 'content.json', 'minimaps/color.webp', 'views/scene.json'), sphere), []);
});

test('a working record or an unnamed record is refused, with its body and file', () => {
  assert.deepEqual(refusedPreparedRows('vega', inventory('runtime.json', 'scene.json', 'controls.json', 'sky.json', 'notes.json'), sphere), [
    'vega/prepared/scene.json: a working record', 'vega/prepared/controls.json: a working record', 'vega/prepared/sky.json: a working record',
    'vega/prepared/notes.json: not named in the delivery ledger']);
});

test('the paged lane keeps its scene listed; a shape body, whose runtime holds it, does not', () => {
  assert.deepEqual(refusedPreparedRows('earth', inventory('runtime.json', 'scene.json'), { properties: { recipe: { sources: [{ id: 'paged-ellipsoid' }] } } }), []);
  assert.deepEqual(refusedPreparedRows('eros', inventory('runtime.json', 'scene.json', 'surfaces.json'), shape), ['eros/prepared/scene.json: a working record']);
});

test('a shape body lists no material, and a solid sphere keeps its own', () => {
  assert.deepEqual(refusedPreparedRows('eros', inventory('surfaces.json', 'material.json'), shape), ['eros/prepared/material.json: a working record']);
  assert.deepEqual(refusedPreparedRows('io', inventory('surfaces.json', 'material.json'), { properties: { recipe: { shape: { kind: 'sphere' }, sources: [{ id: 'terrestrial' }] } } }), []);
});
