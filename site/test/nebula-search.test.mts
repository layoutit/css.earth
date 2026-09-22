import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { OBJECTS } from '../objects.mts';
import { defineObjects } from '../object-schema.mts';
import { definePreparedFocus } from '../prepared-focus-object.mts';
import type { PreparedFocusObject } from '../prepared-focus-object.mts';
import { normalizeDestinationQuery } from '../destination-search.mts';

test('rendered nebulae contribute common names and catalogue aliases to search', async () => {
  const rows = OBJECTS.filter((object): object is PreparedFocusObject => object.kind === 'prepared-focus' && object.classification === 'nebula');
  assert.equal(rows.length, 6);
  for (const [query,id] of [['orion','m42'],['M42','m42'],['NGC 1976','m42'],['helix','helix'],['NGC 7293','helix'],['m2-9','m2-9'],['M2–9','m2-9'],['Twin Jet','m2-9'],
    ['Pleiades','m45'],['M45','m45'],['Seven Sisters','m45'],['Crab','m1'],['M1','m1'],['NGC 1952','m1'],['Lagoon','m8'],['M8','m8'],['NGC 6523','m8']]) {
    const match = rows.find(row => row.searchNames.some(name => name.includes(normalizeDestinationQuery(query!))));
    assert.equal(match?.focusId,id);
    assert.equal(match?.route,`/sun/?focus=${id}`);
  }
  assert.throws(()=>defineObjects([rows[0]!,rows[0]!]),/Duplicate object/);
  assert.throws(()=>definePreparedFocus({}));
});
