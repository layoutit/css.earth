import assert from 'node:assert/strict';
import { test } from 'node:test';
import * as objects from '@cssearth/objects';
import { parseCompleteObjectContentSource } from '@cssearth/objects/node/contract';

test('browser entry exposes domain readers and keeps generic guards and fixture readers private', () => {
  const exports = Object.keys(objects);
  for (const name of ['record', 'array', 'text', 'finite', 'positive', 'parseCataloguePoints', 'parseCompleteObjectContentSource']) {
    assert.equal(exports.includes(name), false, name);
  }
  assert.equal(typeof objects.readCataloguePointBank, 'function');
  assert.equal(typeof objects.requireJsonData, 'function');
});

test('node content fixture parser preserves scope, volume and step fields', () => {
  const control = { id: 'measured', label: 'Measured', thumbnail: '/fixture.webp', source: { id: 'source' },
    scope: 'system', volume: { objectId: 'companion', datasetId: 'field', surface: 'map' },
    step: { group: 'sequence', label: 'First', autoplay: false, opens: 'last' } };
  const fixture = { schema: objects.OBJECT_CONTENT_SCHEMA, version: objects.OBJECT_CONTENT_VERSION,
    id: 'fixture', displayName: 'Fixture', panel: { facts: [] },
    datasets: { titleKey: 'datasets', defaultDataset: 'measured', controls: [control] },
    settings: { titleKey: 'settings', controls: [] }, charts: [], resources: [], provenance: {} };
  assert.deepEqual(parseCompleteObjectContentSource(fixture).datasets.controls[0], control);
  assert.throws(() => parseCompleteObjectContentSource({ ...fixture,
    datasets: { ...fixture.datasets, controls: [{ ...control, scope: 'body' }] } }), /scope/);
});
