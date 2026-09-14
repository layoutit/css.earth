import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { prepareNebulaSearch } from '../prepare-nebula-search.mts';
import { normalizeDestinationQuery } from '../destination-search.mts';

test('rendered nebulae contribute common names and catalogue aliases to search', async () => {
  const inputs = await Promise.all(['m42','helix','m2-9','m45','m1','m8'].map(id => readFile(new URL(`../../src/objects/${id}/source/nebula.json`,import.meta.url),'utf8').then(JSON.parse)));
  const rows = prepareNebulaSearch(inputs, '/sun/');
  assert.equal(rows.length, 6);
  for (const [query,id] of [['orion','m42'],['M42','m42'],['NGC 1976','m42'],['helix','helix'],['NGC 7293','helix'],['m2-9','m2-9'],['M2–9','m2-9'],['Twin Jet','m2-9'],
    ['Pleiades','m45'],['M45','m45'],['Seven Sisters','m45'],['Crab','m1'],['M1','m1'],['NGC 1952','m1'],['Lagoon','m8'],['M8','m8'],['NGC 6523','m8']]) {
    const match = rows.find(row => row.searchNames.some(name => name.includes(normalizeDestinationQuery(query!))));
    assert.equal(match?.focusId,id);
    assert.equal(match?.route,`/sun/?focus=${id}`);
  }
  assert.throws(()=>prepareNebulaSearch([inputs[0],inputs[0]],'/sun/'),/Duplicate nebula/);
  assert.throws(()=>prepareNebulaSearch([{}],'/sun/'));
});
