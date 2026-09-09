import assert from 'node:assert/strict';
import test from 'node:test';
import { OBJECTS } from '../objects.mjs';
import context from '../../src/planets/sun/prepared/world-context.json' with { type: 'json' };
import { SYSTEM_FRAMING_RADII, SYSTEM_VIEWS, systemFramingRadii, systemFramingRect, systemViewTarget } from '../system-framing.mjs';
import { bodyCardViewAtCamera } from '../overview-context.mjs';
import { createPreparedWorldNavigation } from '../prepared-world-navigation.mjs';
import { createWorldSelectionTarget, presentWorldCamera, parseSharedView, savedWorldCamera } from '../../src/renderers/css/dist/navigation.js';
import { createSelectionFlight, sampleSelectionFlight } from '@cssearth/engine';

const sun = OBJECTS.find(object => object.id === 'sun').worldFrame;
const world = { referenceFrame: sun.referenceFrame, epochJdTt: sun.epochJdTt,
  pose: { positionM: [0, 0, 1e15], orientationXyzw: [0,0,0,1] } };
const optics = { focalPixels: 1100, framingRadiusPixels: 200, detailHandoffDiameterPixels: 14,
  principalOffsetPixels: [0,0], widthPixels: 1280, heightPixels: 720 };
const mount = { navigation: { frame: sun, capture: () => world, optics: () => optics } };

for (const savedValue of [
  'QMbBW5Yy0oJwQkGWi8x89zxkwiB1fzFcfJZBQsczQAAAAD-yKb9_eCDDP8E9pRg2Rba_4tHHbEHI9wABAAAAAAAAAAA',
  'QIZBtofGcgC9F8HP4wpWnzNowf_baMik3txBQsczQAAAAD_MBLEQcpJIv8vXKwLSQoM_5FKyMi9bLQABAAAAAAAAAAA',
]) test(`system flights keep the viewing angle and approach the center from ${savedValue.slice(0, 8)}`, () => {
  const saved = parseSharedView(`v=${savedValue}`);
  const from = savedWorldCamera(saved, sun, optics);
  const navigation = createPreparedWorldNavigation({ objects: OBJECTS, windowTarget: {}, documentTarget: {} });
  const cameraMount = { navigation: { frame: sun, capture: () => from, optics: () => optics } };
  for (const [id] of SYSTEM_VIEWS) {
    const frame = OBJECTS.find(object => object.id === id).worldFrame;
    const to = navigation.systemTarget({ objectId: id, fromId: 'sun', mount: cameraMount });
    const flight = createSelectionFlight({ from: from.pose, to: to.pose, focusPositionM: frame.originM, durationS: .35 });
    let previousOffset = Infinity;
    for (let step = 0; step <= 60; step++) {
      const pose = sampleSelectionFlight(flight, flight.durationS * step / 60);
      assert.ok(pose.orientationXyzw.every((value, axis) => Math.abs(value - from.pose.orientationXyzw[axis]) < 1e-14), `${id} never rolls or rotates during arrival`);
      const view = presentWorldCamera({ ...from, pose }, frame, optics);
      assert.ok(view.centerPixels, `${id} never passes behind the camera`);
      const offset = Math.hypot(...view.centerPixels);
      assert.ok(offset <= previousOffset + 1e-5, `${id} approaches the center without swinging away`);
      previousOffset = offset;
    }
    assert.ok(previousOffset < 1e-5, `${id} arrives centered`);
  }
});

test('fitting the current angle is independent of prepared box order and member names', () => {
  const view = SYSTEM_VIEWS.get('neptune');
  const frame = OBJECTS.find(object => object.id === 'neptune').worldFrame;
  const rect = systemFramingRect(optics, {});
  const target = systemViewTarget(world, frame, optics, view, rect);
  assert.deepEqual(systemViewTarget(world, frame, optics,
    { ...view, candidates: [...view.candidates].reverse(), memberIds: view.memberIds.map((_, i) => `member-${i}`) }, rect), target);
  assert.deepEqual(target.pose.orientationXyzw, world.pose.orientationXyzw);
});

for (const [width, height, offset] of [[1524, 1237, [0, 0]], [1280, 720, [0, 0]], [390, 844, [0, 0]], [1024, 700, [40, -20]]])
test(`each system fits its complete primary orbits at ${width}x${height}, offset ${offset}`, () => {
  const viewport = { ...optics, widthPixels: width, heightPixels: height, focalPixels: width * Math.sqrt(3) / 2,
    principalOffsetPixels: offset, framingRadiusPixels: Math.min(width, height) * .28 };
  const cameraMount = { navigation: { frame: sun, capture: () => world, optics: () => viewport } };
  const rect = systemFramingRect(viewport, {});
  const navigation = createPreparedWorldNavigation({ objects: OBJECTS, windowTarget: {}, documentTarget: {} });
  for (const [id, radiusM] of SYSTEM_FRAMING_RADII) {
    const frame = OBJECTS.find(object => object.id === id)?.worldFrame;
    if (!frame) continue;
    const view = SYSTEM_VIEWS.get(id);
    assert.ok(view, `${id} has a prepared system view`);
    const target = navigation.systemTarget({ objectId: id, mount: cameraMount });
    const projection = presentWorldCamera(target, frame, viewport);
    assert.ok(projection.centerPixels.every(value => Math.abs(value) < 1e-5), `${id} stays centered`);
    const moons = context.bodies.filter(body => body.orbit?.centerBodyId === id);
    for (const moon of moons.filter(moon => view.memberIds.includes(moon.id))) {
      const bound = moon.orbit.bounds;
      assert.ok(Math.hypot(...bound.centerM.map((value, axis) => value - frame.originM[axis]))
        + bound.radiusM + moon.radiusM <= radiusM * (1 + 1e-10), `${id} includes ${moon.id}`);
      assert.ok(view.memberIds.includes(moon.id), `${id} frames ${moon.id}`);
      for (const vertex of moon.orbit.verticesM) {
        const point = presentWorldCamera(target, { ...frame, originM: vertex, bodyRadiusM: moon.radiusM }, viewport);
        const [x, y] = point.centerPixels;
        assert.ok(x >= rect.left - .001 && x <= rect.right + .001 && y >= rect.top - .001 && y <= rect.bottom + .001,
          `${id}/${moon.id} complete orbit fits`);
      }
    }
    assert.equal(bodyCardViewAtCamera(target, frame, viewport, id), 'overview', id);
    const close = createWorldSelectionTarget(target, frame, viewport);
    assert.equal(bodyCardViewAtCamera(close, frame, viewport, id), 'detail', id);
    const otherMount = { navigation: { ...cameraMount.navigation, capture: () => ({ ...world,
      pose: { positionM: [1e14, -2e14, -1e15], orientationXyzw: [0, 1, 0, 0] } }) } };
    const otherTarget = navigation.systemTarget({ objectId: id, mount: otherMount });
    assert.deepEqual(otherTarget.pose.orientationXyzw, [0, 1, 0, 0], `${id} preserves the opposite viewing direction too`);
  }
});

test('selecting the system root pulls back from a planet to all major planets, with a normal close-up on repeat', () => {
  const planets = OBJECTS.filter(object => object.classification === 'planet').map(object => object.id).sort();
  assert.deepEqual([...SYSTEM_VIEWS.get(context.focus.id).memberIds].sort(), planets);
  const parent = OBJECTS.find(object => object.id === 'uranus').worldFrame;
  const close = createWorldSelectionTarget(world, parent, optics);
  const mount = { navigation: { frame: parent, capture: () => close, optics: () => optics } };
  const navigation = createPreparedWorldNavigation({ objects: OBJECTS, windowTarget: {}, documentTarget: {} });
  const target = navigation.systemTarget({ objectId: context.focus.id, fromId: 'uranus', mount });
  const range = pose => Math.hypot(...pose.positionM.map((value, axis) => value - sun.originM[axis]));
  assert.ok(range(target.pose) > range(close.pose), 'the first click moves outward from Uranus');
  assert.equal(bodyCardViewAtCamera(target, sun, optics, context.focus.id), 'overview');
  assert.equal(bodyCardViewAtCamera(createWorldSelectionTarget(target, sun, optics), sun, optics, context.focus.id), 'detail');
});

test('system fit leaves clearance for the visible sidebar, header and footer', () => {
  const boxes = {
    '.planet-stage': { left: 0, top: 0, width: 1524, height: 1237 },
    '.planet-sidebar': { left: 12, right: 352, top: 111, bottom: 720, width: 340, height: 609 },
    '.explorer-shell-header': { left: 12, right: 352, top: 8, bottom: 103, width: 340, height: 95 },
    '.planet-view-readout': { left: 1000, right: 1524, top: 0, bottom: 32, width: 524, height: 32 },
    '.planet-attribution-footer': { left: 0, right: 1524, top: 1219, bottom: 1237, width: 1524, height: 18 },
  };
  const documentTarget = { querySelector: selector => boxes[selector] && { getBoundingClientRect: () => boxes[selector] } };
  assert.deepEqual(systemFramingRect({ ...optics, widthPixels: 1524, heightPixels: 1237 }, documentTarget),
    { left: 352 - 762 + 48, right: 762 - 48, top: 32 - 618.5 + 48, bottom: 1219 - 618.5 - 48 });
});

test('adding a small distant moon does not pull the initial camera away from the larger moons', () => {
  const parents = ['jupiter', 'saturn', 'uranus', 'neptune'];
  const mainMoons = new Set(['io', 'europa', 'ganymede', 'callisto', 'titan', 'rhea', 'iapetus', 'dione', 'tethys',
    'ariel', 'umbriel', 'titania', 'oberon', 'miranda', 'triton']);
  const mainContext = { ...context, bodies: context.bodies.filter(body =>
    !parents.includes(body.orbit?.centerBodyId) || mainMoons.has(body.id)) };
  const mainRadii = systemFramingRadii(mainContext);
  for (const id of parents) assert.equal(SYSTEM_FRAMING_RADII.get(id), mainRadii.get(id), id);
});

test('a body without moons uses its normal close-up target on first selection', () => {
  const navigation = createPreparedWorldNavigation({ objects: OBJECTS, windowTarget: {}, documentTarget: {} });
  for (const id of ['mercury', 'venus', 'titan']) {
    const frame = OBJECTS.find(object => object.id === id).worldFrame;
    const target = navigation.systemTarget({ objectId: id, mount });
    assert.deepEqual(target, createWorldSelectionTarget(world, frame, optics));
    assert.equal(bodyCardViewAtCamera(target, frame, optics, id), 'detail');
  }
});

test('clicking the already selected body in close-up does not zoom back out to its moons', () => {
  const navigation = createPreparedWorldNavigation({ objects: OBJECTS, windowTarget: {}, documentTarget: {} });
  const frame = OBJECTS.find(object => object.id === 'saturn').worldFrame;
  const close = createWorldSelectionTarget(world, frame, optics);
  const closeMount = { navigation: { frame, capture: () => close, optics: () => optics } };
  assert.equal(navigation.systemTarget({ objectId: 'saturn', fromId: 'saturn', mount: closeMount }), null);
});

test('galactic breadcrumbs zoom straight out from the current view without panning or turning', async () => {
  const { GALACTIC_VOLUME, volumeZoomTarget } = await import('../system-framing.mjs');
  const { rotateWorldPosition, worldRotationFromQuaternion } = await import('../../src/renderers/css/dist/navigation.js');
  for (const orientationXyzw of [[0, 0, 0, 1], [.5, -.5, .5, .5]]) {
    const from = { ...world, pose: { positionM: [2e12, -3e12, 1e13], orientationXyzw } };
    const viewport = { ...optics, principalOffsetPixels: [40, -20] };
    const rect = systemFramingRect(viewport, {});
    const { world: target, focusPositionM } = volumeZoomTarget(from, GALACTIC_VOLUME, viewport, rect, sun.originM);
    assert.deepEqual(target.pose.orientationXyzw, orientationXyzw);
    const reverse = worldRotationFromQuaternion(orientationXyzw.map((value, axis) => axis < 3 ? -value : value));
    const displacement = rotateWorldPosition(reverse, target.pose.positionM.map((value, axis) => value - from.pose.positionM[axis]));
    assert.ok(displacement[2] > 0, 'Zoom moves outward');
    assert.ok(Math.abs(displacement[0] / displacement[2] - 40 / viewport.focalPixels) < 1e-12);
    assert.ok(Math.abs(displacement[1] / displacement[2] + 20 / viewport.focalPixels) < 1e-12);
    const flight = createSelectionFlight({ from: from.pose, to: target.pose, focusPositionM, durationS: .35 });
    for (const progress of [.1, .3, .5, .8, 1]) {
      const pose = sampleSelectionFlight(flight, flight.durationS * progress);
      const shift = rotateWorldPosition(reverse, pose.positionM.map((value, axis) => value - focusPositionM[axis]));
      assert.ok(Math.abs(shift[0] / shift[2] - 40 / viewport.focalPixels) < 1e-12, 'Flight stays on the zoom ray');
      assert.ok(pose.orientationXyzw.every((value, axis) => Math.abs(value - orientationXyzw[axis]) < 1e-12));
    }
    for (const x of [GALACTIC_VOLUME.boundsUnits.min[0], GALACTIC_VOLUME.boundsUnits.max[0]])
      for (const y of [GALACTIC_VOLUME.boundsUnits.min[1], GALACTIC_VOLUME.boundsUnits.max[1]])
        for (const z of [GALACTIC_VOLUME.boundsUnits.min[2], GALACTIC_VOLUME.boundsUnits.max[2]]) {
          const offset = rotateWorldPosition(worldRotationFromQuaternion(GALACTIC_VOLUME.localToReferenceXyzw),
            [x, y, z].map(value => value * GALACTIC_VOLUME.metersPerUnit));
          const point = GALACTIC_VOLUME.originM.map((value, axis) => value + offset[axis]);
          const projected = presentWorldCamera(target, { ...sun, originM: point, bodyRadiusM: 1 }, viewport);
          assert.ok(projected.centerPixels, 'The complete prepared volume is in front of the camera');
          const [px, py] = projected.centerPixels;
          assert.ok(px >= rect.left - .001 && px <= rect.right + .001 && py >= rect.top - .001 && py <= rect.bottom + .001);
        }
  }
});

test('a Solar System breadcrumb always restores the system framing from a Sun close-up', () => {
  const navigation = createPreparedWorldNavigation({ objects: OBJECTS, windowTarget: {}, documentTarget: {} });
  const closeup = createWorldSelectionTarget(world, sun, optics);
  const camera = { navigation: { ...mount.navigation, capture: () => closeup } };
  assert.equal(navigation.systemTarget({ objectId: 'sun', fromId: 'sun', mount: camera }), null);
  const target = navigation.overviewTarget({ scope: 'solar-system', objectId: 'sun', fromId: 'sun', mount: camera });
  assert.ok(target.world);
  assert.equal(bodyCardViewAtCamera(target.world, sun, optics, 'sun'), 'overview');
});
