import assert from 'node:assert/strict';
import test from 'node:test';
import { SCENE_OBJECTS, requireSceneObject } from '../objects.mts';
import { deriveObjectDiscovery } from '../../tools/prepare-object-discovery.mts';
import { discoveryVisibility, parseObjectDiscovery } from '../object-discovery.mts';

const controls = (...ids: string[]) => ({ lenses: { controls: ids.map(id => ({ id })) } });
const policy = { illustrationLenses: ['model'] };
const model = { id: 'model', metadata: { modeled: true } };
const defaults = { illustrations: false, asteroids: false, asteroidLabels: false };

test('only a prepared observation promotes an illustration, without a second flag change', () => {
  const recipes = [{ raster: { observations: [model], surfaceObservations: [{ id: 'camera' }] } }];
  assert.deepEqual(deriveObjectDiscovery(policy, controls('model'), recipes), { featured: false, imagery: false, illustration: true });
  assert.deepEqual(deriveObjectDiscovery(policy, controls('model', 'camera'), recipes), { featured: true, imagery: true, illustration: false });
  // A registered observation may also replace the stand-in under the same lens id.
  assert.equal(deriveObjectDiscovery(policy, controls('model'), [{ raster: { surfaceObservations: [{ id: 'model' }] } }]).illustration, false);
  // Removing its delivered imagery demotes the destination again.
  assert.equal(deriveObjectDiscovery(policy, controls('model'), recipes).illustration, true);
});

test('model textures, shape-derived elevation and featured overrides cannot promote an illustration', () => {
  const recipes = [{ raster: { observations: [model], scientific: [{ id: 'elevation' }], shapeViews: [{ id: 'shape' }] } }];
  assert.deepEqual(deriveObjectDiscovery({ ...policy, featured: true }, controls('model', 'shape', 'elevation'), recipes),
    { featured: false, imagery: false, illustration: true });
  const art = [{ surfaces: [{ id: 'art', science: { kind: 'glb-base-color' } }] }];
  assert.equal(deriveObjectDiscovery({ illustrationLenses: ['art'] }, controls('art'), art).imagery, false);
});

test('partial photographic coverage still counts; source and lens counts do not', () => {
  const partial = { lenses: { controls: [{ id: 'photo', noData: true }] } };
  assert.equal(deriveObjectDiscovery({}, partial, [{ raster: { observations: [{ id: 'photo' }] } }]).imagery, true);
  assert.equal(deriveObjectDiscovery({}, controls('shape', 'elevation'), []).imagery, false);
  assert.deepEqual(deriveObjectDiscovery({ featured: true }, controls('shape', 'elevation'), []),
    { featured: true, imagery: false, illustration: false });
  assert.throws(() => deriveObjectDiscovery({ illustrationLenses: [3] }, controls('model'), []));
  assert.throws(() => parseObjectDiscovery({ featured: true, imagery: false, illustration: true }));
});

test('default discovery admits photographed asteroids and hides illustrations across classifications', () => {
  const initial = discoveryVisibility(SCENE_OBJECTS, defaults);
  for (const id of ['itokawa', 'ryugu', 'bennu', 'vesta', 'eros', 'arrokoth', 'comet-67p']) {
    assert.equal(initial.hiddenBodies.includes(id), false, id);
    assert.equal(initial.hiddenLabels.includes(id), false, id);
    assert.equal(requireSceneObject(id).discovery.imagery, true, id);
  }
  for (const id of ['eris', 'haumea', 'comet-c1995-o1', 'deedee', 'oumuamua', 'aegaeon', 'annefrank']) {
    assert.equal(initial.hiddenBodies.includes(id), true, id);
    assert.equal(discoveryVisibility(SCENE_OBJECTS, { ...defaults, illustrations: true }).hiddenBodies.includes(id), false, id);
  }
  for (const id of ['pallas', 'psyche', 'squannit', 'kleopatra']) assert.equal(requireSceneObject(id).discovery.illustration, false, id);
});

test('category browsing and asteroid settings cannot bypass Illustration models', () => {
  const browse = discoveryVisibility(SCENE_OBJECTS, { illustrations: false, asteroids: true, asteroidLabels: true, highlighted: 'asteroid' });
  assert.equal(browse.hiddenBodies.includes('annefrank'), true);
  for (const id of ['pallas', 'psyche', 'squannit', 'kleopatra', 'asteroid-2001-sn263']) {
    assert.equal(browse.hiddenBodies.includes(id), false, `${id}: reconstructed mesh remains available without imagery`);
    assert.equal(requireSceneObject(id).discovery.imagery, false, id);
  }
  const explicit = discoveryVisibility(SCENE_OBJECTS, { ...defaults, highlighted: 'comet' });
  assert.equal(explicit.hiddenLabels.includes('comet-67p'), false);
  assert.equal(explicit.hiddenBodies.includes('comet-c1995-o1'), true);
});
