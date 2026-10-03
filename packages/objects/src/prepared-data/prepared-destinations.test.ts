import assert from 'node:assert/strict';
import test from 'node:test';
import { PREPARED_DESTINATIONS_SCHEMA, parsePreparedDestinations } from './prepared-destinations.js';

const pin = { objectId: 'earth', count: 1 };
const place = { id: 123, name: 'City', context: 'Region', searchContext: 'region', names: ['city'] };
const catalog = { schema: PREPARED_DESTINATIONS_SCHEMA, places: [place] };

test('destination search admission preserves minimal records, numeric ids and exact diagnostics', () => {
  assert.equal(PREPARED_DESTINATIONS_SCHEMA, 'cssearth-prepared-destinations@1');
  assert.deepEqual(parsePreparedDestinations(catalog, pin), [{ ...place, id: '123' }]);
  assert.throws(() => parsePreparedDestinations({ ...catalog, schema: 'wrong' }, pin), /^TypeError: earth: places catalogue differs from its pin\.$/u);
  assert.throws(() => parsePreparedDestinations(catalog, { ...pin, count: 2 }), /differs from its pin/u);
  assert.throws(() => parsePreparedDestinations({ ...catalog, places: [{ ...place, names: [1] }] }, pin), /^TypeError: earth: place record is invalid\.$/u);
  assert.throws(() => parsePreparedDestinations({ ...catalog, places: [{ ...place, id: 'bad' }] }, pin), /^TypeError: earth: place id is invalid\.$/u);
});
