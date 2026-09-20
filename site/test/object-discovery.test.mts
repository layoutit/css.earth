import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SCENE_OBJECTS, requireSceneObject } from '../objects.mts';
import { deriveObjectDiscovery, prepareObjectDiscovery } from '../../tools/prepare-object-discovery.mts';
import { discoveryVisibility, parseObjectDiscovery } from '../object-discovery.mts';
import { parseArrivalView } from '../arrival-view.mts';
import { record } from '../browser-types.mts';
import { searchObjects } from '../object-search.mts';
import { objectClassificationLabel } from '../planet-search-objects.mts';

const controls = (...ids: string[]) => ({ lenses: { controls: ids.map(id => ({ id })) } });
const policy = { illustrationLenses: ['model'] };
const model = { id: 'model', metadata: { modeled: true } };
const defaults = { illustrations: false };

test('all four type searches and scene highlights contain the same eligible registered objects', () => {
  const labels = SCENE_OBJECTS.map(object => ({ id: object.id, name: object.name.toLowerCase(), names: [],
    classification: object.classification, classificationName: objectClassificationLabel(object.classification).toLowerCase(),
    systemName: object.systemName.toLowerCase(), illustration: object.discovery.illustration }));
  for (const illustrations of [false, true]) for (const [query, classification] of [
    ['Planets', 'planet'], ['Moons', 'satellite'], ['Comets', 'comet'], ['Asteroids', 'asteroid'],
  ]) {
    const result = searchObjects(labels, query, 'all', { illustrations });
    const scene = discoveryVisibility(SCENE_OBJECTS, { ...defaults, illustrations, highlighted: classification });
    assert.deepEqual(result.matches.map(object => object.id).sort(), scene.highlightedBodies.toSorted(), query);
    assert.ok(scene.highlightedBodies.every(id => !scene.hiddenBodies.includes(id) && !scene.hiddenLabels.includes(id)));
    if (classification === 'planet') for (const id of ['earth', 'ceres', 'pluto']) assert.ok(scene.highlightedBodies.includes(id));
  }
  assert.ok(searchObjects(labels, 'Hale–Bopp').matches.some(object => object.id === 'comet-c1995-o1'), 'a name search still finds illustrations');
});

test('an authored orientation reference passes through discovery as a validated tier', () => {
  assert.equal(deriveObjectDiscovery({ ...policy, orientationReference: 5 }, controls('model'), []).orientationReference, 5);
  assert.equal(deriveObjectDiscovery(policy, controls('model'), []).orientationReference, undefined);
  assert.throws(() => deriveObjectDiscovery({ ...policy, orientationReference: 0 }, controls('model'), []), /orientation reference/);
  assert.equal(parseObjectDiscovery({ featured: false, imagery: false, illustration: false, orientationReference: 4 }).orientationReference, 4);
  assert.throws(() => parseObjectDiscovery({ featured: false, imagery: false, illustration: false, orientationReference: 1.5 }), /orientation reference/);
  // The prepared catalogue carries the Sun and Earth tiers; shared label code never names an object id.
  assert.equal(requireSceneObject('sun').discovery.orientationReference, 5);
  assert.equal(requireSceneObject('earth').discovery.orientationReference, 4);
});

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
  // A neutral-gray shape surface is measured geometry with no imagery: "Shape only", never an illustration.
  const shape = [{ surfaces: [{ id: 'shape', science: { kind: 'neutral-shape' } }] }];
  assert.deepEqual(deriveObjectDiscovery({}, controls('shape'), shape), { featured: false, imagery: false, illustration: false });
  // A whole-disc measured colour is photometry of an unresolved body, not surface imagery.
  const color = [{ surfaces: [{ id: 'color', science: { kind: 'disc-integrated-color' } }] }];
  assert.deepEqual(deriveObjectDiscovery({}, controls('color'), color), { featured: false, imagery: false, illustration: false });
  // A measured colour beside an illustrative model texture: the body stays "Shape only", and the illustration is not imagery.
  const both = [{ surfaces: [{ id: 'color', science: { kind: 'disc-integrated-color' } }, { id: 'illustration', science: { kind: 'glb-base-color' } }] }];
  assert.deepEqual(deriveObjectDiscovery({ illustrationLenses: ['illustration'] }, controls('color', 'illustration'), both),
    { featured: false, imagery: false, illustration: false });
  assert.deepEqual(deriveObjectDiscovery({ illustrationLenses: ['illustration'] }, controls('illustration'), both),
    { featured: false, imagery: false, illustration: true });
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

test('default discovery admits every non-illustrative asteroid without changing context-label policy', () => {
  const initial = discoveryVisibility(SCENE_OBJECTS, defaults);
  for (const id of ['itokawa', 'ryugu', 'bennu', 'vesta', 'eros', 'arrokoth', 'comet-67p']) {
    assert.equal(initial.hiddenBodies.includes(id), false, id);
    assert.equal(initial.hiddenLabels.includes(id), false, id);
    assert.equal(requireSceneObject(id).discovery.imagery, true, id);
  }
  for (const id of ['pallas', 'psyche', 'squannit', 'kleopatra', 'asteroid-2001-sn263']) {
    assert.equal(initial.hiddenBodies.includes(id), false, `${id}: asteroid bodies are always on`);
  }
  for (const id of ['comet-c1995-o1', 'deedee', 'oumuamua', 'aegaeon', 'annefrank']) {
    assert.equal(initial.hiddenBodies.includes(id), true, id);
    assert.equal(discoveryVisibility(SCENE_OBJECTS, { ...defaults, illustrations: true }).hiddenBodies.includes(id), false, id);
  }
  // Occultation-measured shapes in neutral gray are "Shape only", like reconstructed asteroid meshes.
  for (const id of ['pallas', 'psyche', 'squannit', 'kleopatra', 'eris', 'haumea', 'makemake']) assert.equal(requireSceneObject(id).discovery.illustration, false, id);
});

test('a star with only its shape stays off the map, whatever the settings', () => {
  for (const options of [defaults, { illustrations: true, highlighted: 'star' }]) {
    const scene = discoveryVisibility(SCENE_OBJECTS, options);
    for (const id of ['antares', 'polaris']) {
      assert.equal(requireSceneObject(id).discovery.imagery, false, id);
      assert.ok(scene.hiddenBodies.includes(id) && scene.hiddenLabels.includes(id) && !scene.highlightedBodies.includes(id), id);
    }
    for (const id of ['sun', 'betelgeuse', 'pi1-gruis', 'ce-tauri']) assert.equal(scene.hiddenBodies.includes(id), false, id);
  }
});

test('a shape-only star that a body with imagery orbits stays on the map with its planet', () => {
  assert.equal(requireSceneObject('wasp-43').discovery.imagery, false);
  assert.equal(requireSceneObject('wasp-43').discovery.hostsImagery, true);
  assert.equal(requireSceneObject('wasp-43b').discovery.imagery, true);
  for (const id of ['antares', 'polaris']) assert.equal(requireSceneObject(id).discovery.hostsImagery, undefined, id);
  for (const options of [defaults, { illustrations: true, highlighted: 'star' }]) {
    const scene = discoveryVisibility(SCENE_OBJECTS, options);
    for (const id of ['wasp-43', 'wasp-43b']) assert.equal(scene.hiddenBodies.includes(id), false, id);
    for (const id of ['wasp-43', 'wasp-43b']) assert.equal(scene.hiddenLabels.includes(id), false, id);
  }
  assert.throws(() => parseObjectDiscovery({ featured: true, imagery: true, illustration: false, hostsImagery: true }), /without imagery of its own/u);
});

test('a star whose colour comes from its own measurements stays on the map', () => {
  // HD 189733 B hosts no planet; its colour lens is its Gaia XP spectrum.
  assert.equal(requireSceneObject('hd-189733-companion').discovery.imagery, false);
  assert.equal(requireSceneObject('hd-189733-companion').discovery.hostsImagery, undefined);
  assert.equal(requireSceneObject('hd-189733-companion').discovery.sourceColor, true);
  for (const id of ['antares', 'polaris']) assert.equal(requireSceneObject(id).discovery.sourceColor, undefined, id);
  for (const options of [defaults, { illustrations: true, highlighted: 'star' }]) {
    const scene = discoveryVisibility(SCENE_OBJECTS, options);
    for (const id of ['hd-189733', 'hd-189733b', 'hd-189733-companion']) assert.equal(scene.hiddenBodies.includes(id), false, id);
    for (const id of ['hd-189733', 'hd-189733b', 'hd-189733-companion']) assert.equal(scene.hiddenLabels.includes(id), false, id);
    for (const id of ['antares', 'polaris']) assert.ok(scene.hiddenBodies.includes(id), id);
  }
  assert.throws(() => parseObjectDiscovery({ featured: true, imagery: true, illustration: false, sourceColor: true }), /source colour/u);
});

test('category browsing cannot bypass Illustration models', () => {
  const browse = discoveryVisibility(SCENE_OBJECTS, { illustrations: false, highlighted: 'asteroid' });
  assert.equal(browse.hiddenBodies.includes('annefrank'), true);
  for (const id of ['pallas', 'psyche', 'squannit', 'kleopatra', 'asteroid-2001-sn263', 'eris', 'haumea', 'makemake']) {
    assert.equal(browse.hiddenBodies.includes(id), false, `${id}: reconstructed shape remains available`);
  }
  for (const id of ['pallas', 'squannit', 'asteroid-2001-sn263', 'eris', 'haumea', 'makemake']) {
    assert.equal(requireSceneObject(id).discovery.imagery, false, id);
  }
  const explicit = discoveryVisibility(SCENE_OBJECTS, { ...defaults, highlighted: 'comet' });
  assert.equal(explicit.hiddenLabels.includes('comet-67p'), false);
  assert.equal(explicit.hiddenBodies.includes('comet-c1995-o1'), true);
});

test('photographic arrivals use the prepared package camera, excluding modeled and unexposed datasets', async () => {
  const runtime: unknown = JSON.parse(await readFile(new URL('../../src/objects/arrokoth/prepared/runtime.json', import.meta.url), 'utf8'));
  assert.ok(record(runtime) && record(runtime.camera));
  const preparedControls = { lenses: { defaultLens: 'photo', controls: [{ id: 'photo' }, { id: 'model' }] } };
  const recipes = [{ raster: { observations: [model], surfaceObservations: [{ id: 'photo' }, { id: 'unprepared' }] } }];
  const camera = { ...runtime.camera, initialScenePitchDegrees: 0, defaultControlYawDegrees: 90 };
  const discovery = deriveObjectDiscovery(policy, preparedControls, recipes, camera);
  assert.deepEqual(discovery.arrival?.lensIds, ['photo']);
  const rotation = discovery.arrival!.rotation;
  [0,0,1,0,1,0,-1,0,0].forEach((value, index) => assert.ok(Math.abs(rotation[index] - value) < 1e-12));
  assert.equal(deriveObjectDiscovery(policy, preparedControls, [{ raster: { observations: [model] } }], camera).arrival, undefined);
  assert.equal(deriveObjectDiscovery({}, preparedControls, [{ raster: { mosaics: [{ id: 'photo' }] } }], camera).arrival, undefined);
  assert.throws(() => deriveObjectDiscovery(policy, preparedControls, recipes, { ...camera, defaultControlYawDegrees: NaN }));
  assert.throws(() => parseArrivalView({ defaultLens: 'photo', lensIds: ['photo'], rotation: [1,0,0,0,1,0,0,0,-1] }));
  assert.ok(requireSceneObject('arrokoth').discovery.arrival?.lensIds.includes('lorri'));
});

test('a package that was never prepared is discoverable as shape only instead of failing the catalogue', async () => {
  const folder = await mkdtemp(join(tmpdir(), 'discovery-unprepared-'));
  try {
    await mkdir(join(folder, 'source/preparation'), { recursive: true });
    await writeFile(join(folder, 'source/preparation/raster.json'), JSON.stringify({ surfaces: [{ id: 'photo', science: { kind: 'surface-observation' } }] }));
    const descriptor = { properties: { catalog: {}, recipe: { sources: [{ id: 'raster', path: 'source/preparation/raster.json' }] } } };
    assert.deepEqual(await prepareObjectDiscovery(descriptor, folder), { imagery: false, illustration: false, featured: false });
  } finally { await rm(folder, { recursive: true, force: true }); }
});
