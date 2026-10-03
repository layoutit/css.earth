import assert from 'node:assert/strict';
import { test } from 'node:test';
import { catalogueObject } from './object-catalog.js';
import { systemHostId, systemObjectId } from './system-address.js';

const frame = { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [1, 0, 0], presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], metersPerUnit: 1, bodyRadiusM: 1 };
const entry = (id: string, catalog: Record<string, unknown>, system?: unknown) => ({ descriptor: { schema: 'cssearth-object@2', id, type: system ? 'system' : 'layered-body',
  properties: { catalog: { name: id, systemName: 'Solar System', color: '#aabbcc', distanceAu: 1, description: 'A body.', ...catalog }, worldFrame: frame, ...(system ? { system } : {}) } },
  distance: { meters: 3.085677581491367e16, value: 1, unit: 'pc', quantity: 'catalogue', referencePoint: 'observer', epochJdTt: null }, discovery: { featured: false, imagery: false, illustration: false } });
const load = () => async () => null;

test('a system is named after its host, and only a system is', () => {
  assert.equal(systemObjectId('jupiter'), 'jupiter-system');
  assert.equal(systemObjectId('sun'), 'solar-system');
  assert.equal(systemHostId('solar-system'), 'sun');
  assert.equal(systemHostId('jupiter'), null);
  assert.equal(catalogueObject(entry('jupiter-system', { classification: 'satellite-system' }, { host: 'jupiter', members: 'moons' }), load).system?.host, 'jupiter');
  // A system named otherwise would have no address; an object named like a system would be read as one.
  assert.throws(() => catalogueObject(entry('jovian-system', { classification: 'satellite-system' }, { host: 'jupiter', members: 'moons' }), load), /the system of jupiter is jupiter-system, not jovian-system/u);
  assert.throws(() => catalogueObject(entry('ring-system', { classification: 'nebula' }), load), /ring-system reads as the system of ring/u);
  // The classification says what its members are.
  assert.throws(() => catalogueObject(entry('jupiter-system', { classification: 'planetary-system' }, { host: 'jupiter', members: 'moons' }), load), /satellite-system/u);
});
