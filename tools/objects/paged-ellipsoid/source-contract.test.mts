import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {parsePagedProfile, parsePagedLensBindings, parsePagedCelestial} from './profile-source.mts';
import {parseInteriorSource, parseAtmosphereResponse} from './source-contract.mts';
import {readMapConfiguration, readRefreshContent, readRefreshBindings, readRefreshManifest, readRefreshDescriptor} from './refresh-source.mts';
const sourceRoot = new URL('../../../src/planets/earth/source/', import.meta.url);
const read = async path => JSON.parse(await readFile(new URL(path, sourceRoot), 'utf8'));

test('Earth preparation boundaries preserve every source and provenance field', async () => {
  for (const [path, parse] of [['preparation/paged-ellipsoid.json', parsePagedProfile], ['preparation/celestial.json', parsePagedCelestial],
    ['content/lens-bindings.json', parsePagedLensBindings], ['interior/earth-interior.json', parseInteriorSource],
    ['atmosphere/google-earth-pro-presentation-response.json', parseAtmosphereResponse]]) {
    const value = await read(path), before = JSON.stringify(value);
    assert.equal(JSON.stringify(parse(value)), before, path);
    assert.equal(JSON.stringify(value), before, `${path} input remains unchanged`);
  }
});

test('Earth profile rejects invalid geometry, decoder variants and geographic budgets', async () => {
  for (const mutate of [value => { value.geometry.EQUATORIAL_RADIUS = '230'; },
    value => { value.surface.maps[0].scientific = {kind: 'gebco-elevation'}; },
    value => { value.geographic.pages.presentation.maximumDecodedBytes = null; },
    value => { value.camera.responsiveFit.minimumZoom = Infinity; }]) {
    const value = await read('preparation/paged-ellipsoid.json'); mutate(value);
    assert.throws(() => parsePagedProfile(value), TypeError);
  }
});

test('focused lens transitions require complete numeric addresses', async () => {
  const value = await read('content/lens-bindings.json');
  const lens = value.controls.find(value => value.focus);
  delete lens.focus.latitude;
  assert.throws(() => parsePagedLensBindings(value), /paged lens bindings/);
});

test('source refresh readers retain bytes as mutable private copies without running acquisition', async () => {
  for (const [path, parse] of [['preparation/paged-ellipsoid.json', readMapConfiguration], ['content/object.json', readRefreshContent],
    ['content/lens-bindings.json', readRefreshBindings], ['manifest.json', readRefreshManifest], ['../object.json', readRefreshDescriptor]]) {
    const original = await read(path), before = JSON.stringify(original);
    const value = await parse(new URL(path, sourceRoot).pathname);
    assert.equal(JSON.stringify(value), before, path);
    assert.equal(Object.isFrozen(value), false);
    value.migrationProbe = true;
    assert.equal(JSON.stringify(original), before);
  }
});
