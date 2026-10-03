import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { APPLICATION_WORLD_CONTEXT as context } from '../world-context-plan.mts';
import { OBJECTS, SCENE_OBJECTS } from '../objects.mts';
import { allSatelliteSystems, satelliteSystemByHost, satelliteSystemOfMember, satelliteSystems } from '../satellite-systems.mts';
import { satelliteSelectionAtCamera, watchSatelliteSelection } from '../satellite-selection.mts';
import { selectionTargetFromUrl, createSceneSelection, moonSystem, starSystem, type SceneContext } from '../scene/scene-selection.mts';
import { SYSTEM_FRAMING_RADII, systemOverviewDistance } from '../system-framing.mts';
import type { WorldCameraPose } from '@cssearth/engine';
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
  const system = selectionTargetFromUrl(new URL('https://css.earth/earth-system/'), 'earth');
  // A system is selected as its own object; the body, as itself.
  assert.deepEqual(system, { objectId: 'earth-system' });
  assert.deepEqual(selectionTargetFromUrl(new URL('https://css.earth/earth/'), 'earth'),
    { objectId: 'earth' });
  assert.deepEqual(selectionTargetFromUrl(new URL('https://css.earth/solar-system/'), 'sun'),
    { objectId: 'solar-system' });
  // The registry's rule alone says what an address names: the build serves a system's address only for a system object.
  assert.equal(OBJECTS.some(object => object.id === 'mercury-system'), false);
  // What kind of system it is is what its host is: a star's (or a black hole's), or a planet's or small body's moons.
  assert.deepEqual(['earth-system', 'pluto-system', 'solar-system', 'trappist-1-system', 'gj-820-a-system', 'sgr-a-star-system', 'earth']
    .map(objectId => [starSystem({ objectId }), moonSystem({ objectId })]),
  [[false, true], [false, true], [true, false], [true, false], [true, false], [true, false], [false, false]]);
  assert.throws(() => starSystem({ objectId: 'nowhere-system' }), /nowhere-system: its host nowhere is neither an object this page has read nor a body of the world it holds/);
  const selection = createSceneSelection({ initial: system, objectId: 'earth', onChange() {} });
  assert.equal(new URL(selection.url('https://css.earth/earth/')).pathname, '/earth-system/');
  selection.commit({ objectId: 'earth' }, 'earth');
  assert.equal(new URL(selection.url('https://css.earth/earth-system/')).pathname, '/earth/');
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
  assert.deepEqual(satelliteSelectionAtCamera(camera(earth.worldFrame.originM, threshold * .8), optics, SCENE_OBJECTS,
    { objectId: 'earth-system' }), { objectId: 'earth' });
  assert.deepEqual(satelliteSelectionAtCamera(camera(earth.worldFrame.originM, threshold * 1.3), optics, SCENE_OBJECTS,
    { objectId: 'earth' }), { objectId: 'earth-system' });
  assert.equal(satelliteSelectionAtCamera(camera(moon.worldFrame.originM, 20e6), optics, SCENE_OBJECTS,
    { objectId: 'moon' }), null);
  assert.deepEqual(satelliteSelectionAtCamera(camera(moon.worldFrame.originM, 400e6), optics, SCENE_OBJECTS,
    { objectId: 'moon' }), { objectId: 'earth-system' });
});

test("a moon's crossing into its planet's system is reported once, and so is the camera coming back", () => {
  const moon = SCENE_OBJECTS.find(object => object.id === 'moon')!;
  const optics: ReturnType<ObjectWorldNavigation['optics']> = { focalPixels: 1000, framingRadiusPixels: 300,
    detailHandoffDiameterPixels: 14, principalOffsetPixels: [0, 0], visibleRect: null, widthPixels: 1200, heightPixels: 800 };
  const camera = (range: number): WorldCameraPose => ({ referenceFrame: 'world', epochJdTt: 1,
    pose: { positionM: [moon.worldFrame.originM[0], moon.worldFrame.originM[1], moon.worldFrame.originM[2] + range], orientationXyzw: [0, 0, 0, 1] } });
  let listener: ((world: WorldCameraPose) => void) | null = null;
  const timers = new Map<number, () => void>(), changes: SceneContext[] = [];
  let serial = 0, returns = 0;
  // The moon's scene stays mounted after the report (its planet's waits for the camera to rest): the selection is the moon's still.
  const watch = watchSatelliteSelection({ objects: SCENE_OBJECTS, getSelection: () => ({ objectId: 'moon' }), isAvailable: () => true,
    onChange: next => changes.push(next), onReturn: () => { returns++; },
    navigation: { optics: () => optics, subscribe(value: (world: WorldCameraPose) => void) { listener = value; return () => {}; } } as unknown as ObjectWorldNavigation,
    documentTarget: new EventTarget() as unknown as Document,
    windowTarget: { setTimeout(callback: () => void) { timers.set(++serial, callback); return serial; }, clearTimeout(id: number) { timers.delete(id); } } as unknown as Window });
  const at = (range: number) => listener!(camera(range));
  const settle = () => { const pending = [...timers.values()]; timers.clear(); for (const run of pending) run(); };
  at(400e6); settle();
  assert.deepEqual(changes, [{ objectId: 'earth-system' }]);
  at(500e6); at(900e6);
  assert.deepEqual([changes.length, timers.size, returns], [1, 0, 0], 'not again while the camera stays out there');
  at(20e6);
  assert.equal(returns, 1, 'back at the moon');
  at(400e6); settle();
  assert.equal(changes.length, 2, 'the next crossing is reported again');
  watch.refresh(); settle();
  assert.equal(changes.length, 3, 'asked again, the camera says where it is');
  watch();
});
