import assert from 'node:assert/strict';
import { readSystemViewFile } from './system-view-file.test-support.mts';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { OBJECTS, SCENE_OBJECTS } from '../../directory/objects.mts';
import { seedObjectDirectory } from '../../directory/object-directory.mts';
// A page knows the objects it has read; this test holds the whole registry.
seedObjectDirectory(OBJECTS);
import contextInput from '../../../src/objects/observable-universe/prepared/world-context.json' with { type: 'json' };
import { STELLAR_SYSTEMS, SYSTEM_FRAMING_RADII, SYSTEM_VIEWS, SYSTEM_VIEW_HOSTS, loadSystemView, systemFramingRadii, systemFramingRect, systemViewTarget } from './system-framing.mts';
import { bodyViewAtCamera } from './zoom-scope.mts';
import { createPreparedWorldNavigation } from '../../navigation/prepared-world-navigation.mts';
import { createWorldSelectionTarget, parseSharedView, savedWorldCamera } from '@cssearth/renderer/navigation';
import { worldQuaternionFromRotation, worldRotationFromQuaternion, createSelectionFlight, sampleSelectionFlight, type WorldCameraPose } from '@cssearth/engine';
import { presentWorldCamera } from '@cssearth/renderer/navigation/world-camera.ts';
import { SYSTEM_FRAMING_ANGLES } from '../../browser/runtime-policy.mts';

import { required, position, quaternion, navigationFixture, unusedSharedView } from '../../navigation/navigation-test-values.test-support.mts';
import { parsePreparedWorldContext } from '@cssearth/objects';
import type { ObjectWorldNavigation } from '@cssearth/renderer/runtime/world-navigation-types.ts';
// System framing's candidates load after the first body mounts in the app; these tests need them loaded.
await Promise.all([...SYSTEM_VIEW_HOSTS].map(id => loadSystemView(id, readSystemViewFile)));
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
/** The Milky Way's volume: the frame its page's galactic breadcrumb fits. */
async function galacticVolume() {
  const { parseDensityVolumeFrame } = await import('@cssearth/objects');
  return parseDensityVolumeFrame((await import('../../../src/objects/milky-way-volume/object.json', { with: { type: 'json' } })).default.properties.volume);
}

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

test('a dataset volume is fitted through the normal projection, whatever magnification the view arrived with', () => {
  const navigation = createPreparedWorldNavigation({ objects: SCENE_OBJECTS, windowTarget, documentTarget });
  const frame = required(required(SCENE_OBJECTS.find(object => object.id === 'm31')).worldFrame);
  const phone = { ...optics, focalPixels: 337.75, widthPixels: 390, heightPixels: 844 };
  // An arrival rests at a fixed distance and magnifies its projection instead: 3.76 times on a phone.
  const magnification = 3.76, magnified = { ...phone, focalPixels: phone.focalPixels * magnification, projectionScale: magnification };
  const at = (radii: number, projectionScale?: number): WorldCameraPose => ({ referenceFrame: frame.referenceFrame, epochJdTt: frame.epochJdTt,
    ...(projectionScale === undefined ? {} : { projectionScale }),
    pose: { positionM: [frame.originM[0], frame.originM[1], frame.originM[2] + radii * frame.bodyRadiusM], orientationXyzw: [0, 0, 0, 1] } });
  const fit = (camera: WorldCameraPose, viewport: typeof optics) => navigation.datasetVolumeTarget({ objectId: 'm31', volumeId: 'm31-layers',
    mount: { sharedView: unusedSharedView, navigation: navigationFixture(frame, () => camera, () => viewport) } });
  const range = (camera: WorldCameraPose) => Math.hypot(...camera.pose.positionM.map((value, axis) => value - frame.originM[axis])) / frame.bodyRadiusM;
  const cold = required(fit(at(1), phone)), arrived = required(fit(at(1, magnification), magnified));
  assert.deepEqual(arrived.world.pose, cold.world.pose, 'the arrival is fitted where the page opens');
  assert.equal(arrived.world.projectionScale, undefined, 'the fitted camera carries no magnification');
  const fitted = range(cold.world);
  // What a view holds is its apparent size: magnified, a camera twice as far out as the fit still shows less than the volume.
  assert.equal(fit(at(fitted * 2), phone), null, 'a view already beyond the fit stays');
  assert.deepEqual(required(fit(at(fitted * 2, magnification), magnified)).world.pose.orientationXyzw, [0, 0, 0, 1]);
  assert.equal(fit(at(fitted * 2 * magnification, magnification), magnified), null, 'so does a magnified view that shows as little');
});

test('selecting the Milky Way from Local Group zooms in to the galaxy while keeping the viewing direction', async () => {
  const { zoomScopeAtCamera } = await import('./zoom-scope.mts');
  const { ancestorsOf } = await import('../../directory/objects.mts');
  const steps = ancestorsOf('sun').flatMap(object => object.zoom ? [{ id: object.id, zoom: object.zoom }] : []);
  const navigation = createPreparedWorldNavigation({ objects: SCENE_OBJECTS, windowTarget, documentTarget });
  const far: WorldCameraPose = { ...world, pose: { positionM: [0, 0, 3.085677581491367e22], orientationXyzw: [0, 0, 0, 1] } };
  const distantMount = { sharedView: unusedSharedView, navigation: navigationFixture(sun, () => far, () => optics) };
  const target = required(navigation.overviewTarget({ objectId: 'sun', fromId: 'sun', mount: distantMount, scope: 'milky-way' }));
  assert.ok(Math.hypot(...target.world.pose.positionM) < Math.hypot(...far.pose.positionM) / 5,
    'The arrival must leave Local Group range instead of preserving its departure distance');
  // Kept to rounding: the Sun's frame is derived, and a turn through it and back leaves 1e-16 where an authored frame left 0.
  assert.ok(target.world.pose.orientationXyzw.every((value, axis) => Math.abs(value - far.pose.orientationXyzw[axis]!) < 1e-12), `orientation ${target.world.pose.orientationXyzw.join(', ')}`);
  assert.equal(zoomScopeAtCamera(target.world, 'milky-way', undefined, undefined, steps), 'milky-way');
});

test('galactic breadcrumbs zoom straight out from the current view without panning or turning', async () => {
  const { volumeZoomTarget } = await import('./system-framing.mts');
  const GALACTIC_VOLUME = await galacticVolume();
  const { rotateWorldPosition, worldRotationFromQuaternion } = await import('@cssearth/engine');
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
  const target = required(navigation.overviewTarget({ scope: 'solar-system', objectId: 'sun', fromId: 'sun', mount: camera }));
  assert.ok(target.world);
  assert.equal(bodyViewAtCamera(target.world, sun, optics, 'sun'), 'overview');
});

test('the Local Group overview frames the Milky Way and every drawn member galaxy from any angle', async () => {
  const { drawnGalaxiesZoomTarget } = await import('./system-framing.mts');
  const { cssViewFromOrientation, rotateWorldPosition } = await import('@cssearth/engine');
  const { existsSync } = await import('node:fs');
  const associated = existsSync(new URL('../../../src/objects/local-group-galaxies/prepared/catalogue.json', import.meta.url));
  const { zoomScopeAtCamera } = await import('./zoom-scope.mts');
  const { ancestorsOf, requireObject } = await import('../../directory/objects.mts');
  // The galaxies inside the Local Group in the object tree: M81, NGC 253, M83 and NGC 300 are drawn by the same catalogue
  // but are inside the Nearby Universe (prepare-catalog.mts prepareFitBoxes).
  const members = OBJECTS.filter(object => object.classification === 'galaxy' && ancestorsOf(object.id).some(ancestor => ancestor.id === 'local-group')).map(object => object.id).sort();
  // Catalogue batches add galaxies (M32 and M110 with the Messier objects), so the list is held to its rule, not pinned.
  for (const id of ['lmc', 'm31', 'm33', 'milky-way', 'smc']) assert.ok(members.includes(id), id);
  for (const id of ['m81', 'ngc-253', 'm83', 'ngc-300']) assert.ok(!members.includes(id), id);
  assert.throws(() => drawnGalaxiesZoomTarget('milky-way', world, optics, systemFramingRect(optics)), /no box for milky-way/u);
  const steps = ancestorsOf('sun').flatMap(object => object.zoom ? [{ id: object.id, zoom: object.zoom }] : []);
  for (const orientationXyzw of [[0, 0, 0, 1], [.5, -.5, .5, .5], [0, .7071067811865476, 0, .7071067811865476]] as const) {
    const from: WorldCameraPose = { ...world, pose: { ...world.pose, orientationXyzw } };
    const { world: target } = drawnGalaxiesZoomTarget('local-group', from, optics, systemFramingRect(optics));
    assert.deepEqual(target.pose.orientationXyzw, orientationXyzw, 'the view keeps its angle');
    if (associated) assert.equal(zoomScopeAtCamera(target, 'local-group', undefined, undefined, steps), 'local-group', 'the Local Group frame is a Local Group view');
    const view = cssViewFromOrientation(orientationXyzw);
    for (const id of members) {
      const originM = required(requireObject(id).worldFrame).originM;
      const [x, y, z] = rotateWorldPosition(view, position(originM.map((value, axis) => value - target.pose.positionM[axis]!)));
      assert.ok(z < 0, `${id} is in front of the camera`);
      assert.ok(Math.abs(x / z) * optics.focalPixels <= optics.widthPixels! / 2 && Math.abs(y / z) * optics.focalPixels <= optics.heightPixels! / 2, `${id} is on screen`);
    }
  }
});
