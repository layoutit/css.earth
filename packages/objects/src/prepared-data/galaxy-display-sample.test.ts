import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePreparedGalaxyCatalog } from './galaxy-catalog.js';
import { GALAXY_DISPLAY_SAMPLE_SCHEMA, parseGalaxyDisplaySample } from './galaxy-display-sample.js';

const catalog = parsePreparedGalaxyCatalog({ schema: 'cssearth-galaxy-catalog@1', frame: { referenceFrame: 'sun-icrf', epochJdTt: 1 },
  sources: [{ id: 'source', url: 'https://example.org', citation: 'Source', bytes: 1 }],
  objects: [{ id: 'nearby', name: 'Nearby', aliases: [], positionM: [3.085677581491367e16, 0, 0],
    skyPosition: { raDeg: 0, decDeg: 0, sourceRef: 'source' }, distance: { valuePc: 1, method: 'parallax', sourceRef: 'source' },
    membership: { group: 'local-group', subgroup: 'field', basis: 'Source' }, status: 'confirmed' }],
  exclusions: [], selection: { description: 'Source' } });

test('display samples preserve identities and historical acceptance without bake metadata', () => {
  const sample = { schema: GALAXY_DISPLAY_SAMPLE_SCHEMA, ids: ['nearby'] };
  assert.equal(parseGalaxyDisplaySample(sample, catalog), sample);
});
test('display samples enforce schema, display budget and catalogue membership', () => {
  for (const sample of [null, {}, { schema: 'other', ids: [] }, { schema: GALAXY_DISPLAY_SAMPLE_SCHEMA, ids: ['unknown'] },
    { schema: GALAXY_DISPLAY_SAMPLE_SCHEMA, ids: Array(49).fill('nearby') }]) {
    assert.throws(() => parseGalaxyDisplaySample(sample, catalog), /Invalid baked galaxy sample/);
  }
  const other = { ...catalog, objects: catalog.objects.map(row => ({ ...row, membership: { ...row.membership, group: 'local-volume' as const } })) };
  assert.throws(() => parseGalaxyDisplaySample({ schema: GALAXY_DISPLAY_SAMPLE_SCHEMA, ids: ['nearby'] }, other), /Invalid baked galaxy sample/);
});
