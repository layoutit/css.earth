import assert from 'node:assert/strict';
import test from 'node:test';
import { OBSERVED_STELLAR_CATALOGUE_SCHEMA, type EmissionFieldModel } from '@cssearth/objects';
import { prepareCatalogueStars } from './observed-catalogue.ts';
const model: EmissionFieldModel = {
  schema: 'cssearth-conditional-emission-field@1', identity: 'catalogue-test', controls: { detail: 1, faint: 1, depth: 1 },
  components: [], bounds: { min: [-1, -1, -1], max: [1, 1, 1] }, skyBounds: { min: [-1, -1], max: [1, 1] }, scaffold: null,
  assumptions: { kernel: 'test', projectionUnits: 'test', depth: 'test', halo: 'test', haloRadiusArcsec: 1, equalNearFarSplit: true, velocityUncoveredComponents: 0 },
};
const catalogue = (stars: unknown[]) => ({ schema: OBSERVED_STELLAR_CATALOGUE_SCHEMA, id: 'test', frame: 'ICRS', coordinateEpochJulianYear: 2000, stars });
const color = () => [255, 255, 255] as const;
test('catalogue envelope, frame and star errors preserve admission order', () => {
  assert.throws(() => prepareCatalogueStars({}, model, [360, 0], 0, ['a'], color), /requires ICRS/);
  assert.throws(() => prepareCatalogueStars(catalogue([null]), model, [360, 0], 0, ['a'], color), /Invalid catalogue star frame/);
  assert.throws(() => prepareCatalogueStars(catalogue([null]), model, [0, 0], 0, ['a'], color), /Invalid observed stellar/u);
  const result = prepareCatalogueStars(catalogue([]), model, [0, -90], 0, ['a'], color);
  assert.deepEqual(result.stars, []);
  assert.equal(result.receipt.catalogueId, 'test');
});
