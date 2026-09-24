import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
import { alternativeForLens, alternativeLensIds } from './alternative-lenses.mts';
import { radialTerrainForLens } from './alternative-lenses.mts';
const test = sourceTest();

test('an alternative mesh serves its own lens and the lenses it names as sharing its frame', () => {
  const adam = { lensId: 'zimpol', additionalLensIds: ['thermal-inertia', 'dielectric-constant'], path: 'shape/adam.obj' };
  const other = { lensId: 'osiris', path: 'shape/other.obj' };
  assert.deepEqual(alternativeLensIds(adam), ['zimpol', 'thermal-inertia', 'dielectric-constant']);
  assert.deepEqual(alternativeLensIds(other), ['osiris']);
  assert.equal(alternativeForLens([other, adam], 'dielectric-constant'), adam);
  assert.equal(alternativeForLens([other, adam], 'shape'), undefined);
  const config = { namespace: 'psyche', geometry: { radius: 1, radiusKm: 1, radialTerrain: { path: 'shape/mpcd.obj' }, radialTerrainAlternatives: [other, adam] },
    presentation: { defaultLens: 'shape' }, raster: {} };
  assert.deepEqual(radialTerrainForLens(config, 'thermal-inertia'), { path: 'shape/adam.obj' }, 'the lens fields are not part of the mesh profile');
  assert.deepEqual(radialTerrainForLens(config, 'shape'), { path: 'shape/mpcd.obj' });
  assert.throws(() => alternativeLensIds({ lensId: 'zimpol', additionalLensIds: 'thermal-inertia' }), /Invalid alternative/);
});
