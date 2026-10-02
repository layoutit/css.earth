import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { SCENE_OBJECTS } from '../objects.mts';
import contextInput from '../../src/objects/sun/prepared/world-context.json' with { type: 'json' };
import { STELLAR_SYSTEMS, SYSTEM_FRAMING_RADII, SYSTEM_VIEWS, SYSTEM_VIEW_HOSTS, loadSystemView, systemFramingRadii, systemFramingRect, systemViewTarget } from '../system-framing.mts';
import { bodyViewAtCamera } from '../overview-context.mts';
import { createPreparedWorldNavigation } from '../prepared-world-navigation.mts';
import { createWorldSelectionTarget, presentWorldCamera, parseSharedView, savedWorldCamera, worldQuaternionFromRotation, worldRotationFromQuaternion } from '@cssearth/renderer/navigation';
import { SYSTEM_FRAMING_ANGLES } from '../runtime-policy.mts';
import { createSelectionFlight, sampleSelectionFlight } from '@cssearth/engine';

import { required, position, quaternion, navigationFixture, unusedSharedView } from './navigation-test-values.mts';
import { parsePreparedWorldContext } from '@cssearth/objects';
import type { WorldCameraPose } from '@cssearth/renderer/navigation/world-camera.ts';
import type { ObjectWorldNavigation } from '@cssearth/renderer/runtime/world-navigation-types.ts';
// System framing's candidates load after the first body mounts in the app; these tests need them loaded.
await Promise.all([...SYSTEM_VIEW_HOSTS].map(id => loadSystemView(id, async host => JSON.parse(await (await import('node:fs/promises')).readFile(new URL(`../../src/objects/sun/prepared/system-views/${host}.json`, import.meta.url), 'utf8')))));
const context = parsePreparedWorldContext(contextInput);
// Target calculation never requests native frames or queries absent shell nodes.
const windowTarget = {} as Window;
// The navigation keeps one wheel listener for its lifetime; these tests never scroll.
const documentTarget = { addEventListener() {}, removeEventListener() {} } as unknown as Document;
const sun = required(required(SCENE_OBJECTS.find(object => object.id === 'sun')).worldFrame);
const world: WorldCameraPose = { referenceFrame: sun.referenceFrame, epochJdTt: sun.epochJdTt,
  pose: { positionM: [0, 0, 1e15], orientationXyzw: [0,0,0,1] } };
const optics: ReturnType<ObjectWorldNavigation["optics"]> = { visibleRect: null, focalPixels: 1100, framingRadiusPixels: 200, detailHandoffDiameterPixels: 14,
  principalOffsetPixels: [0,0], widthPixels: 1280, heightPixels: 720 };
const mount = { sharedView: unusedSharedView, navigation: navigationFixture(sun, () => world, () => optics) };

test('fitting the current angle is independent of prepared box order', () => {
  const view = required(SYSTEM_VIEWS.get('neptune'));
  const frame = required(required(SCENE_OBJECTS.find(object => object.id === 'neptune')).worldFrame);
  const rect = systemFramingRect(optics);
  const target = systemViewTarget(world, frame, optics, view, rect);
  const reordered = { ...view, candidates: [...view.candidates].reverse() };
  assert.deepEqual(systemViewTarget(world, frame, optics, reordered, rect), target);
  assert.deepEqual(target.pose.orientationXyzw, world.pose.orientationXyzw);
});

test('another star\'s system, reached edge-on from the Sun, opens to the shallowest prepared elevation', () => {
  // Sgr A*'s S-stars make the black hole a system host too.
  assert.deepEqual([...STELLAR_SYSTEMS].sort(), SCENE_OBJECTS.filter(object => (object.classification === 'star' || object.classification === 'black-hole') && object.id !== 'sun'
    && SYSTEM_VIEWS.has(object.id)).map(object => object.id).sort());
  const navigation = createPreparedWorldNavigation({ objects: SCENE_OBJECTS, windowTarget, documentTarget });
  const minimum = Math.min(...SYSTEM_FRAMING_ANGLES.elevationsDegrees);
  for (const id of STELLAR_SYSTEMS) {
    const frame = required(required(SCENE_OBJECTS.find(object => object.id === id)).worldFrame), view = required(SYSTEM_VIEWS.get(id));
    const normal = orbitNormal(view.candidates);
    // Look from the Sun toward the star, as a flight from the Solar System arrives.
    const from = { ...world, pose: { positionM: [0, 0, 0] as const, orientationXyzw: lookingAlong(frame.originM) } };
    const cameraMount = { sharedView: unusedSharedView, navigation: navigationFixture(sun, () => from, () => optics) };
    const target = required(navigation.systemTarget({ objectId: id, fromId: 'sun', mount: cameraMount }));
    const elevation = (orientation: readonly number[]) => {
      const r = worldRotationFromQuaternion(orientation as [number, number, number, number]);
      return Math.asin(Math.abs(r[2]! * normal[0] + r[5]! * normal[1] + r[8]! * normal[2])) * 180 / Math.PI;
    };
    const arrival = elevation(from.pose.orientationXyzw), opened = elevation(target.pose.orientationXyzw);
    assert.ok(opened >= Math.max(arrival, minimum) - 1e-6, `${id} opens from ${arrival.toFixed(2)}° to ${opened.toFixed(2)}°`);
    assert.ok(opened <= Math.max(arrival, minimum) + 1e-6, `${id} turns no further than it must`);
  }
});

function orbitNormal(candidates: readonly { readonly cameraToReference: readonly number[] }[]) {
  const right = (m: readonly number[]) => [m[0]!, m[3]!, m[6]!];
  const [a, b] = [right(candidates[0]!.cameraToReference), right(candidates[1]!.cameraToReference)];
  const n = [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
  const length = Math.hypot(...n);
  return n.map(value => value / length);
}

/** A camera at the origin whose view runs along `direction`, with +z toward the eye. */
function lookingAlong(direction: readonly number[]): [number, number, number, number] {
  const length = Math.hypot(...direction), back = direction.map(value => -value / length);
  const helper = Math.abs(back[2]!) < .9 ? [0, 0, 1] : [1, 0, 0];
  const cross = (a: readonly number[], b: readonly number[]) => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
  const x = cross(helper, back), xl = Math.hypot(...x), right = x.map(value => value / xl), up = cross(back, right);
  return [...worldQuaternionFromRotation([right[0]!, up[0]!, back[0]!, right[1]!, up[1]!, back[1]!, right[2]!, up[2]!, back[2]!])] as [number, number, number, number];
}

test('selecting the system root pulls back from a planet to all major planets, with a normal close-up on repeat', () => {
  const planets = SCENE_OBJECTS.filter(object => object.classification === 'planet').map(object => object.id).sort();
  assert.deepEqual([...required(context.focus.systemView).memberIds].sort(), planets);
  const parent = required(required(SCENE_OBJECTS.find(object => object.id === 'uranus')).worldFrame);
  const close = createWorldSelectionTarget(world, parent, optics);
  const mount = { sharedView: unusedSharedView, navigation: navigationFixture(parent, () => close, () => optics) };
  const navigation = createPreparedWorldNavigation({ objects: SCENE_OBJECTS, windowTarget, documentTarget });
  const target = required(navigation.systemTarget({ objectId: context.focus.id, fromId: 'uranus', mount }));
  const range = (pose: WorldCameraPose["pose"]) => Math.hypot(...pose.positionM.map((value, axis) => value - sun.originM[axis]));
  assert.ok(range(target.pose) > range(close.pose), 'the first click moves outward from Uranus');
  assert.equal(bodyViewAtCamera(target, sun, optics, context.focus.id), 'overview');
  assert.equal(bodyViewAtCamera(createWorldSelectionTarget(target, sun, optics), sun, optics, context.focus.id), 'detail');
});

test('system fit leaves clearance for the visible sidebar, header and footer', () => {
  const boxes: Record<string, Pick<DOMRect, "left" | "top" | "right" | "bottom" | "width" | "height">> = {
    '.object-stage': { left: 0, top: 0, right: 1524, bottom: 1237, width: 1524, height: 1237 },
    '.object-sidebar': { left: 12, right: 352, top: 60, bottom: 720, width: 340, height: 660 },
    '.explorer-shell-header': { left: 12, right: 1512, top: 8, bottom: 52, width: 1500, height: 44 },
    '.object-footer': { left: 0, right: 1524, top: 1219, bottom: 1237, width: 1524, height: 18 },
  };
  const documentTarget = { querySelector: (selector: string) => boxes[selector] && { getBoundingClientRect: () => boxes[selector] } };
  assert.deepEqual(systemFramingRect({ ...optics, widthPixels: 1524, heightPixels: 1237 }, documentTarget as unknown as Document),
    { left: 352 - 762 + 48, right: 762 - 48, top: 52 - 618.5 + 48, bottom: 1219 - 618.5 - 48 });
});

test('adding a small distant moon does not pull the initial camera away from the larger moons', () => {
  const parents = ['jupiter', 'saturn', 'uranus', 'neptune'];
  const mainMoons = new Set(['io', 'europa', 'ganymede', 'callisto', 'titan', 'rhea', 'iapetus', 'dione', 'tethys',
    'ariel', 'umbriel', 'titania', 'oberon', 'miranda', 'triton']);
  const mainContext = { ...context, bodies: context.bodies.filter(body =>
    !parents.includes(body.orbit?.centerBodyId ?? "") || mainMoons.has(body.id)) };
  const mainRadii = systemFramingRadii(mainContext), allRadii = systemFramingRadii(context);
  for (const id of parents) assert.equal(allRadii.get(id), mainRadii.get(id), id);
  // The app frames from the summary, whose culling spheres are rounded outward by at most 2.8 millionths of their radius.
  for (const id of parents) assert.ok(Math.abs(SYSTEM_FRAMING_RADII.get(id)! / allRadii.get(id)! - 1) <= 3e-6, id);
});

test('clicking the already selected body in close-up does not zoom back out to its moons', () => {
  const navigation = createPreparedWorldNavigation({ objects: SCENE_OBJECTS, windowTarget, documentTarget });
  const frame = required(required(SCENE_OBJECTS.find(object => object.id === 'saturn')).worldFrame);
  const close = createWorldSelectionTarget(world, frame, optics);
  const closeMount = { sharedView: unusedSharedView, navigation: navigationFixture(frame, () => close, () => optics) };
  assert.equal(navigation.systemTarget({ objectId: 'saturn', fromId: 'saturn', mount: closeMount }), null);
});

test('selecting the Milky Way from Local Group zooms in to the galaxy while keeping the viewing direction', async () => {
  const { overviewScopeAtCamera } = await import('../overview-context.mts');
  const navigation = createPreparedWorldNavigation({ objects: SCENE_OBJECTS, windowTarget, documentTarget });
  const far: WorldCameraPose = { ...world, pose: { positionM: [0, 0, 3.085677581491367e22], orientationXyzw: [0, 0, 0, 1] } };
  const distantMount = { sharedView: unusedSharedView, navigation: navigationFixture(sun, () => far, () => optics) };
  const target = required(navigation.overviewTarget({ objectId: 'sun', fromId: 'sun', mount: distantMount, scope: 'milky-way' }));
  assert.ok(Math.hypot(...target.world.pose.positionM) < Math.hypot(...far.pose.positionM) / 5,
    'The arrival must leave Local Group range instead of preserving its departure distance');
  assert.deepEqual(target.world.pose.orientationXyzw, far.pose.orientationXyzw);
  assert.equal(overviewScopeAtCamera(target.world, 'milky-way'), 'milky-way');
});

test('galactic breadcrumbs zoom straight out from the current view without panning or turning', async () => {
  const { GALACTIC_VOLUME, volumeZoomTarget } = await import('../system-framing.mts');
  const { rotateWorldPosition, worldRotationFromQuaternion } = await import('@cssearth/renderer/navigation');
  for (const orientationXyzw of [[0, 0, 0, 1], [.5, -.5, .5, .5]] as const) {
    const from: WorldCameraPose = { ...world, pose: { positionM: [2e12, -3e12, 1e13], orientationXyzw } };
    const viewport = { ...optics, principalOffsetPixels: [40, -20] as const };
    const rect = systemFramingRect(viewport);
    const { world: target, focusPositionM } = volumeZoomTarget(from, GALACTIC_VOLUME, viewport, rect, sun.originM);
    assert.deepEqual(target.pose.orientationXyzw, orientationXyzw);
    const reverse = worldRotationFromQuaternion(quaternion(orientationXyzw.map((value, axis) => axis < 3 ? -value : value)));
    const displacement = rotateWorldPosition(reverse, position(target.pose.positionM.map((value, axis) => value - from.pose.positionM[axis])));
    assert.ok(displacement[2] > 0, 'Zoom moves outward');
    assert.ok(Math.abs(displacement[0] / displacement[2] - 40 / viewport.focalPixels) < 1e-12);
    // The principal offset is in CSS pixels (+y down); the pose's camera axes have +y up.
    assert.ok(Math.abs(displacement[1] / displacement[2] - 20 / viewport.focalPixels) < 1e-12);
    const flight = createSelectionFlight({ from: from.pose, to: target.pose, focusPositionM, durationS: .35 });
    for (const progress of [.1, .3, .5, .8, 1]) {
      const pose = sampleSelectionFlight(flight, flight.durationS * progress);
      const shift = rotateWorldPosition(reverse, position(pose.positionM.map((value, axis) => value - focusPositionM[axis])));
      assert.ok(Math.abs(shift[0] / shift[2] - 40 / viewport.focalPixels) < 1e-12, 'Flight stays on the zoom ray');
      assert.ok(pose.orientationXyzw.every((value, axis) => Math.abs(value - orientationXyzw[axis]) < 1e-12));
    }
    for (const x of [GALACTIC_VOLUME.boundsUnits.min[0], GALACTIC_VOLUME.boundsUnits.max[0]])
      for (const y of [GALACTIC_VOLUME.boundsUnits.min[1], GALACTIC_VOLUME.boundsUnits.max[1]])
        for (const z of [GALACTIC_VOLUME.boundsUnits.min[2], GALACTIC_VOLUME.boundsUnits.max[2]]) {
          const offset = rotateWorldPosition(worldRotationFromQuaternion(GALACTIC_VOLUME.localToReferenceXyzw),
            position([x, y, z].map(value => value * GALACTIC_VOLUME.metersPerUnit)));
          const point = position(GALACTIC_VOLUME.originM.map((value, axis) => value + offset[axis]));
          const projected = presentWorldCamera(target, { ...sun, originM: point, bodyRadiusM: 1 }, viewport);
          assert.ok(projected.centerPixels, 'The complete prepared volume is in front of the camera');
          const [px, py] = projected.centerPixels;
          assert.ok(px >= rect.left - .001 && px <= rect.right + .001 && py >= rect.top - .001 && py <= rect.bottom + .001);
        }
  }
});

test('a Solar System breadcrumb always restores the system framing from a Sun close-up', () => {
  const navigation = createPreparedWorldNavigation({ objects: SCENE_OBJECTS, windowTarget, documentTarget });
  const closeup = createWorldSelectionTarget(world, sun, optics);
  const camera = { sharedView: unusedSharedView, navigation: { ...mount.navigation, capture: () => closeup } };
  assert.equal(navigation.systemTarget({ objectId: 'sun', fromId: 'sun', mount: camera }), null);
  const target = required(navigation.overviewTarget({ scope: 'system', objectId: 'sun', fromId: 'sun', mount: camera }));
  assert.ok(target.world);
  assert.equal(bodyViewAtCamera(target.world, sun, optics, 'sun'), 'overview');
});

test('the Local Group overview frames the Milky Way and every drawn member galaxy from any angle', async () => {
  const { GALACTIC_VOLUME, drawnGalaxiesZoomTarget } = await import('../system-framing.mts');
  const members = (await import('../prepared-local-group-galaxies.json', { with: { type: 'json' } })).default as Record<string, { originM: number[] }>;
  const { cssViewFromOrientation, rotateWorldPosition } = await import('@cssearth/renderer/navigation');
  // The catalogue's Local Group members with a drawn object: M81, NGC 253, M83 and NGC 300 are drawn but belong elsewhere.
  // The association comes from the restored prepared catalogue (prepare-catalog.mts); without it only distance applies.
  const { existsSync } = await import('node:fs');
  const associated = existsSync(new URL('../../src/objects/local-group-galaxies/prepared/catalogue.json', import.meta.url));
  if (associated) assert.deepEqual(Object.keys(members).sort(), ['lmc', 'm31', 'm33', 'smc']);
  const { overviewScopeAtCamera } = await import('../overview-context.mts');
  for (const orientationXyzw of [[0, 0, 0, 1], [.5, -.5, .5, .5], [0, .7071067811865476, 0, .7071067811865476]] as const) {
    const from: WorldCameraPose = { ...world, pose: { ...world.pose, orientationXyzw } };
    const { world: target } = drawnGalaxiesZoomTarget(from, optics, systemFramingRect(optics));
    assert.deepEqual(target.pose.orientationXyzw, orientationXyzw, 'the view keeps its angle');
    if (associated) assert.equal(overviewScopeAtCamera(target, 'local-group'), 'local-group', 'the Local Group frame is a Local Group view');
    const view = cssViewFromOrientation(orientationXyzw);
    for (const [id, originM] of [['milky-way', GALACTIC_VOLUME.originM], ...Object.entries(members).map(([id, frame]) => [id, frame.originM] as const)] as const) {
      const [x, y, z] = rotateWorldPosition(view, position(originM.map((value, axis) => value - target.pose.positionM[axis]!)));
      assert.ok(z < 0, `${id} is in front of the camera`);
      assert.ok(Math.abs(x / z) * optics.focalPixels <= optics.widthPixels! / 2 && Math.abs(y / z) * optics.focalPixels <= optics.heightPixels! / 2, `${id} is on screen`);
    }
  }
});
