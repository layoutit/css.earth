import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { APPLICATION_WORLD_CONTEXT as context } from '../world-context-plan.mts';
import { SCENE_OBJECTS } from '../objects.mts';
import { allSatelliteSystems, satelliteSystemByHost, satelliteSystemOfMember, satelliteSystems } from '../satellite-systems.mts';
import { satelliteSelectionAtCamera } from '../satellite-selection.mts';
import { selectionTargetFromUrl, createSceneSelection } from '../scene/scene-selection.mts';
import { SYSTEM_FRAMING_RADII, systemOverviewDistance } from '../system-framing.mts';
import type { WorldCameraPose } from '@cssearth/renderer/navigation/world-camera.ts';
import type { ObjectWorldNavigation } from '@cssearth/renderer/runtime/world-navigation-types.ts';

test('every prepared satellite family derives from orbit parents and has a prepared view', () => {
  const systems = allSatelliteSystems();
  const bodies = new Map([context.focus, ...context.bodies].map(body => [body.id, body]));
  const preparedSatellites = context.bodies.filter(body => body.classification === 'satellite' && body.orbit
    && bodies.get(body.orbit.centerBodyId)?.classification !== 'star'
    && bodies.get(body.orbit.centerBodyId)?.classification !== 'black-hole');
  assert.equal(systems.length, new Set(preparedSatellites.map(body => body.orbit!.centerBodyId)).size);
  assert.equal(systems.reduce((count, system) => count + system.memberIds.length, 0), preparedSatellites.length);
  for (const system of systems) {
    const host = bodies.get(system.hostId);
    assert.ok(host?.systemView, system.hostId);
    assert.deepEqual(system.framedIds, host.systemView.memberIds);
    for (const id of system.memberIds) {
      const moon = context.bodies.find(body => body.id === id);
      assert.equal(moon?.classification, 'satellite');
      assert.equal(moon?.orbit?.centerBodyId, system.hostId);
      assert.equal(satelliteSystemOfMember(id), system);
    }
  }
  assert.equal(satelliteSystemByHost('earth')?.name, 'Earth–Moon system');
  assert.equal(satelliteSystemByHost('didymos')?.name, 'Didymos–Dimorphos system');
  assert.equal(satelliteSystemByHost('jupiter')?.name, 'Jupiter system');
  assert.equal(satelliteSystemByHost('mercury'), null);
  const broken = structuredClone(context);
  const earth = broken.bodies.find(body => body.id === 'earth');
  assert.ok(earth);
  Reflect.deleteProperty(earth, 'systemView');
  assert.throws(() => satelliteSystems(broken), /earth has prepared satellites but no system view/);
});

test('system URL and body URL keep distinct selection identities', () => {
  const system = selectionTargetFromUrl(new URL('https://css.earth/earth/?view=satellites'), 'earth', SCENE_OBJECTS);
  assert.deepEqual(system, { kind: 'satellite-system', hostId: 'earth' });
  assert.deepEqual(selectionTargetFromUrl(new URL('https://css.earth/earth/'), 'earth', SCENE_OBJECTS),
    { kind: 'object', objectId: 'earth' });
  assert.deepEqual(selectionTargetFromUrl(new URL('https://css.earth/sun/?overview=system'), 'sun', SCENE_OBJECTS),
    { kind: 'overview', overview: { scope: 'system', systemId: 'sun' } });
  assert.deepEqual(selectionTargetFromUrl(new URL('https://css.earth/mercury/?view=satellites'), 'mercury', SCENE_OBJECTS),
    { kind: 'object', objectId: 'mercury' });
  const selection = createSceneSelection({ initial: system, objectId: 'earth', onChange() {} });
  assert.equal(new URL(selection.url('https://css.earth/earth/')).searchParams.get('view'), 'satellites');
  selection.commit({ kind: 'object', objectId: 'earth' }, 'earth');
  assert.equal(new URL(selection.url('https://css.earth/earth/?view=satellites')).searchParams.has('view'), false);
});

test('camera crosses the system and body cards at the selected body, including a moon', () => {
  const earth = SCENE_OBJECTS.find(object => object.id === 'earth')!;
  const moon = SCENE_OBJECTS.find(object => object.id === 'moon')!;
  const optics: ReturnType<ObjectWorldNavigation['optics']> = { focalPixels: 1000, framingRadiusPixels: 300,
    detailHandoffDiameterPixels: 14, principalOffsetPixels: [0, 0], visibleRect: null,
    widthPixels: 1200, heightPixels: 800 };
  const camera = (origin: readonly number[], range: number): WorldCameraPose => ({
    referenceFrame: 'world', epochJdTt: 1, pose: {
      positionM: [origin[0]!, origin[1]!, origin[2]! + range], orientationXyzw: [0, 0, 0, 1],
    },
  });
  const radius = SYSTEM_FRAMING_RADII.get('earth')!;
  const threshold = systemOverviewDistance(earth.worldFrame.bodyRadiusM, radius, optics);
  assert.equal(satelliteSelectionAtCamera(camera(earth.worldFrame.originM, threshold * .8), optics, SCENE_OBJECTS,
    { kind: 'satellite-system', hostId: 'earth' })?.kind, 'object');
  assert.equal(satelliteSelectionAtCamera(camera(earth.worldFrame.originM, threshold * 1.3), optics, SCENE_OBJECTS,
    { kind: 'object', objectId: 'earth' })?.kind, 'satellite-system');
  assert.equal(satelliteSelectionAtCamera(camera(moon.worldFrame.originM, 20e6), optics, SCENE_OBJECTS,
    { kind: 'object', objectId: 'moon' }), null);
  assert.deepEqual(satelliteSelectionAtCamera(camera(moon.worldFrame.originM, 400e6), optics, SCENE_OBJECTS,
    { kind: 'object', objectId: 'moon' }), { kind: 'satellite-system', hostId: 'earth' });
});
