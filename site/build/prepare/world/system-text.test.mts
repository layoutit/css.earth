import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
import { readSourceCatalog } from '@cssearth/bake/sources';
import input from '../../../source/navigation/system-text.json' with { type: 'json' };
import { allSatelliteSystems } from '../../../world/systems/satellite-systems.mts';
import { requireObject } from '../../../directory/objects.mts';
import { systemObjectId } from '../../../model/system-address.mts';
import { prepareSystemIntroductions } from './system-text.mts';
import { showsDefaultContextOrbit } from './prepare-world-presentation.mts';
const test = sourceTest();

test('every satellite system has a cited introduction, which is its system object\'s description', async () => {
  const catalogue = await readSourceCatalog(new URL('../../../../', import.meta.url).pathname);
  const hosts = allSatelliteSystems().map(system => system.hostId);
  const prepared = prepareSystemIntroductions(input, hosts, new Set(catalogue.records.map(record => record.id)));
  assert.deepEqual(prepared, Object.fromEntries(hosts.map(id => [id, requireObject(systemObjectId(id)).description])));
  assert.equal(Object.keys(prepared).length, hosts.length);
});

test('system preparation rejects missing descriptions, unknown citations and overlong prose', () => {
  const block = { text: 'A planet and its moons.', sources: [{ catalogueId: 'example', url: 'https://example.org/', label: 'Example', checked: '2026-09-30' }] };
  const record = (entry: typeof block) => ({ schema: 'cssearth-system-text@1', satellites: { host: entry } });
  assert.throws(() => prepareSystemIntroductions(record(block), ['missing'], new Set(['example'])), /unavailable/);
  assert.throws(() => prepareSystemIntroductions(record(block), ['host'], new Set()), /unknown source/);
  assert.throws(() => prepareSystemIntroductions(record({ ...block, text: 'a'.repeat(181) + '.' }), ['host'], new Set(['example'])), /characters/);
});

test('default orbits leave out comets and asteroids and follow featured status for dwarf planets', () => {
  const comet = { id: 'example-comet', classification: 'comet', discovery: { featured: false } };
  assert.equal(showsDefaultContextOrbit(comet), false);
  assert.equal(showsDefaultContextOrbit({ ...comet, discovery: { featured: true } }), false);
  assert.equal(showsDefaultContextOrbit({ ...comet, id: 'bennu', classification: 'asteroid', discovery: { featured: true } }), false);
  assert.equal(showsDefaultContextOrbit({ ...comet, classification: 'dwarf-planet' }), false);
  assert.equal(showsDefaultContextOrbit({ ...comet, classification: 'dwarf-planet', discovery: { featured: true } }), true);
  assert.equal(showsDefaultContextOrbit({ ...comet, classification: 'planet' }), true);
});
