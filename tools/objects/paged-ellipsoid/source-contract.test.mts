import { fixtureRecord, required } from '../../contract/test-values.mts';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {parsePagedProfile, parsePagedLensBindings} from './profile-source.mts';
import {parseInteriorSource, parseAtmosphereResponse} from './source-contract.mts';
import {readMapConfiguration, readRefreshContent, readRefreshBindings, readRefreshManifest} from './refresh-source.mts';
const sourceRoot = new URL('../../../src/objects/earth/source/', import.meta.url);
const read = async (path: string): Promise<unknown> => JSON.parse(await readFile(new URL(path, sourceRoot), 'utf8'));

test('Earth preparation boundaries preserve every source and provenance field', async () => {
  for (const [path, parse] of [['preparation/paged-ellipsoid.json', parsePagedProfile],
    ['content/lens-bindings.json', parsePagedLensBindings], ['interior/earth-interior.json', parseInteriorSource],
    ['atmosphere/google-earth-pro-presentation-response.json', parseAtmosphereResponse]] as const) {
    const value = await read(path), before = JSON.stringify(value);
    assert.equal(JSON.stringify(parse(value)), before, path);
    assert.equal(JSON.stringify(value), before, `${path} input remains unchanged`);
  }
});

test('Earth profile rejects invalid geometry, decoder variants and geographic budgets', async () => {
  for (const mutate of [(value: unknown) => { fixtureRecord(value,'geometry').EQUATORIAL_RADIUS = '230'; },
(value: unknown) => { fixtureRecord(value,'surface','maps',0).scientific = {kind: 'gebco-elevation'}; },
(value: unknown) => { fixtureRecord(value,'geographic','pages','presentation').maximumDecodedBytes = null; },
(value: unknown) => { fixtureRecord(value,'camera','responsiveFit').minimumZoom = Infinity; }]) {
    const value = await read('preparation/paged-ellipsoid.json'); mutate(value);
    assert.throws(() => parsePagedProfile(value), TypeError);
  }
});

test('focused lens transitions require complete numeric addresses', async () => {
  const value = parsePagedLensBindings(await read('content/lens-bindings.json'));
  const lens = required(value.controls.find(value => value.focus));
  Reflect.deleteProperty(required(lens.focus), 'latitude');
  assert.throws(() => parsePagedLensBindings(value), /paged lens bindings/);
});

test('source refresh readers retain bytes as mutable private copies without running acquisition', async () => {
  for (const [path, parse] of [['preparation/paged-ellipsoid.json', readMapConfiguration], ['content/object.json', readRefreshContent],
    ['content/lens-bindings.json', readRefreshBindings], ['manifest.json', readRefreshManifest]] as const) {
    const original = await read(path), before = JSON.stringify(original);
    const value = await parse(new URL(path, sourceRoot).pathname);
    assert.equal(JSON.stringify(value), before, path);
    assert.equal(Object.isFrozen(value), false);
    Object.assign(value,{migrationProbe:true});
    assert.equal(JSON.stringify(original), before);
  }
});
