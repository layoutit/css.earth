import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parsePreparedSurfaceFeatureCatalog } from './surface-feature-catalog.js';
import { PREPARED_SURFACE_FEATURES_SCHEMA } from './surface-feature-types.js';
import type { PreparedSurfaceFeaturePlan } from '../presentation/runtime-presentation-types.js';

const plan: PreparedSurfaceFeaturePlan = { catalog: { url: '/features.json', bytes: 1, count: 1 }, target: 0, datasetIds: [], meshRadiusUnits: 1,
  policy: { minimumZoomShare: 0, minimumDiameterPixels: 1, alwaysVisibleCount: 0, maximumVisible: 1, limbCosine: 0 }, outline: { pieces: 4 } };
const fixture = () => ({ schema: PREPARED_SURFACE_FEATURES_SCHEMA, objectId: 'body', source: 'source', snapshotDate: 'date', sourcePage: 'page', license: 'license', qualification: 'qualified',
  features: [{ id: '1', name: 'Name', kind: 'point', type: 'Type', code: 'AA', diameterKm: 1, longitudeDeg: 0, latitudeDeg: 0,
    anchorUnits: [1, 0, 0], normal: [1, 0, 0], radiusUnits: 0, outline: { kind: 'circle', center: [1, 0, 0], east: [0, 0, 0], north: [0, 0, 0] },
    searchNames: ['name'], searchContext: 'type', origin: '', approved: '', quad: '', link: 'https://example.org', credit: '' }] });

test('surface features retain reader defaults without changing the wire records', () => {
  const input = fixture(), row = parsePreparedSurfaceFeatureCatalog(input, plan, 'body').features[0]!;
  assert.equal(row.note, null); assert.equal(row.facilityId, null); assert.equal(row.searchOnly, false); assert.equal(row.minimumZoomShare, 0);
  assert.equal('note' in input.features[0]!, false);
});
test('surface feature compatibility, count and prepared body geometry remain enforced', () => {
  const wrongSchema = { ...fixture(), schema: 'other' };
  assert.throws(() => parsePreparedSurfaceFeatureCatalog(wrongSchema, plan, 'body'), /incompatible/);
  assert.throws(() => parsePreparedSurfaceFeatureCatalog(fixture(), plan, 'other'), /incompatible/);
  assert.throws(() => parsePreparedSurfaceFeatureCatalog({ ...fixture(), features: [] }, plan, 'body'), /count differs/);
  const input = fixture(); input.features[0]!.anchorUnits = [2, 0, 0];
  assert.throws(() => parsePreparedSurfaceFeatureCatalog(input, plan, 'body'), /geometry is not on/);
});
