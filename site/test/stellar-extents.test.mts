import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { M_PER_PC } from '@cssearth/astronomy';
import { STELLAR_EXTENTS, parseStellarExtents } from '../stellar-extents.mts';

const root = new URL('../../', import.meta.url);
const json = async (path: string) => JSON.parse(await readFile(new URL(path, root), 'utf8')) as Record<string, unknown>;

test('each ringed galaxy carries a published stellar extent bound to a catalogued paper', async () => {
  assert.deepEqual(Object.keys(STELLAR_EXTENTS).sort(), ['lmc', 'milky-way', 'smc']);
  for (const [id, radiusM] of Object.entries(STELLAR_EXTENTS)) {
    const record = await json(`src/objects/${id}/source/stellar-extent.json`);
    assert.equal(record.schema, 'cssearth-stellar-extent@1'); assert.equal(record.objectId, id);
    assert.equal(radiusM, (record.radiusPc as number) * M_PER_PC, `${id}: the prepared radius is the record's, in metres`);
    const source = await json(`src/sources/${String(record.source)}.json`);
    assert.equal(source.kind, 'publication');
    // The quoted measurement names the same radius the record states, in kpc.
    assert.match(String(record.quote), new RegExp(String((record.radiusPc as number) / 1000).replace('.', '\\.')));
  }
});

test('prepared stellar extents refuse a radius that is not a positive length', () => {
  assert.throws(() => parseStellarExtents({ lmc: 0 }), /lmc needs a positive radius/);
  assert.throws(() => parseStellarExtents([]), /object of radii/);
});
