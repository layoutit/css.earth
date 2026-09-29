import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import preparedContext from '../../src/objects/sun/prepared/world-context.json' with { type: 'json' };
import { bodyCardViewAtCamera, overviewFrameDistanceM, overviewScopeAtCamera, viewDistance } from '../overview-context.mts';
import { GALAXY_SCALE } from '@cssearth/renderer/labels/universe-label-policy.ts';
import { presentWorldCamera } from '@cssearth/renderer/navigation';
import { parsePreparedWorldContext } from '@cssearth/renderer';
import { systemOverviewDistance, SYSTEM_FRAMING_RADII } from '../system-framing.mts';
import { OVERVIEWS } from '../objects.mts';

// The same validated plan the application mounts; the raw JSON import is untyped.
const context = parsePreparedWorldContext(preparedContext);

import type { WorldCameraPose, PreparedWorldCameraFrame } from '@cssearth/renderer/navigation/world-camera.ts';
import type { ObjectWorldNavigation } from '@cssearth/renderer/runtime/world-navigation-types.ts';

const camera = (distance: number, plan: Pick<typeof context, 'focus'> = context): WorldCameraPose => ({
  referenceFrame: 'world', epochJdTt: 1, pose: {
    positionM: [plan.focus.positionM[0], plan.focus.positionM[1], plan.focus.positionM[2] + distance],
    orientationXyzw: [0, 0, 0, 1],
  },
});
const frameAt = (originM: PreparedWorldCameraFrame['originM'], bodyRadiusM: number): PreparedWorldCameraFrame => ({
  originM, bodyRadiusM, referenceFrame: 'world', epochJdTt: 1,
  presentationToReference: [1, 0, 0, 0, -1, 0, 0, 0, 1], metersPerUnit: 1,
});

test('body cards retain overview through small boundary reversals for bodies with and without moons', () => {
  const frame = frameAt([0, 0, 0], 1000);
  const optics: ReturnType<ObjectWorldNavigation['optics']> = { framingRadiusPixels: 400, visibleRect: null,
    focalPixels: 1000, principalOffsetPixels: [0, 0], widthPixels: 1200, heightPixels: 800, detailHandoffDiameterPixels: 14 };
  for (const id of ['fixture', 'saturn']) {
    const radius = SYSTEM_FRAMING_RADII.get(id);
    const threshold = radius ? systemOverviewDistance(1000, radius, optics) : 1000 * Math.sqrt(1 + (2000 / 14) ** 2);
    let previous: 'detail' | 'overview' = 'detail';
    for (const factor of [1.01, .99, 1.005, .98]) {
      previous = bodyCardViewAtCamera(camera(threshold * factor, { focus: { ...context.focus, positionM: [0, 0, 0] } }), frame, optics, id, previous);
      assert.equal(previous, 'overview');
    }
    assert.equal(bodyCardViewAtCamera(camera(threshold * .85, { focus: { ...context.focus, positionM: [0, 0, 0] } }), frame, optics, id, previous), 'detail');
  }
});

test('body cards switch at the shared camera detail threshold, independent of camera aim', () => {
  const frame = frameAt([100, 200, 300], 1000);
  const optics: ReturnType<ObjectWorldNavigation["optics"]> = { framingRadiusPixels: 1, visibleRect: null, focalPixels: 1000, principalOffsetPixels: [0,0], widthPixels: 2000,
    heightPixels: 2000, detailHandoffDiameterPixels: 14 };
  const thresholdDistance = frame.bodyRadiusM * Math.sqrt(1 + (2 * optics.focalPixels / optics.detailHandoffDiameterPixels) ** 2);
  for (const [scale, expected] of [[0.99, 'detail'], [1.01, 'overview'], [1000, 'overview']] as const) {
    const world: WorldCameraPose = { referenceFrame: 'world', epochJdTt: 1, pose: {
      positionM: [frame.originM[0], frame.originM[1], frame.originM[2] + thresholdDistance * scale],
      orientationXyzw: [0,0,0,1],
    } };
    const silhouette = presentWorldCamera(world, frame, optics).silhouette;
    assert.ok(silhouette);
    const diameter = 2 * silhouette.tangentialSemiAxis;
    assert.equal(diameter <= optics.detailHandoffDiameterPixels ? 'overview' : 'detail', expected);
    assert.equal(bodyCardViewAtCamera(world, frame, optics, "fixture"), expected);
    const turned: WorldCameraPose = { ...world, pose: { ...world.pose, orientationXyzw: [0,1,0,0] } };
    assert.equal(bodyCardViewAtCamera(turned, frame, optics, "fixture"), expected, 'Looking away does not change zoom mode');
  }
  assert.equal(bodyCardViewAtCamera(camera(0, { ...context, focus: { ...context.focus, positionM: [...frame.originM] } }), frame, optics, "fixture"), 'detail');
  assert.equal(bodyCardViewAtCamera(null, frame, optics, "fixture"), 'detail');
});

test('overview leaves the Solar System when its bodies fade and restores correctly at maximum zoom', () => {
  const { fadeOutStartDistanceM: start, hiddenDistanceM: hidden } = context.system, middle = Math.sqrt(start * hidden);
  assert.equal(overviewScopeAtCamera(camera(hidden * .99)), 'system');
  assert.equal(overviewScopeAtCamera(camera(hidden)), 'milky-way');
  assert.equal(overviewScopeAtCamera(camera(context.camera.maximumDistanceM)), 'observable-universe');
  const gpc = 1e9 * 3.085677581491367e16;
  assert.equal(overviewScopeAtCamera(camera(.9 * gpc)), 'nearby-universe', 'short of 1 Gpc the view is the nearby universe');
  assert.equal(overviewScopeAtCamera(camera(.9 * gpc), 'observable-universe'), 'observable-universe', 'and returns only below 800 Mpc');
  assert.equal(overviewScopeAtCamera(camera(.7 * gpc), 'observable-universe'), 'nearby-universe');
  assert.equal(overviewScopeAtCamera(camera(middle * 1.01), 'milky-way'), 'milky-way');
  assert.equal(overviewScopeAtCamera(camera(middle * .99), 'milky-way'), 'system');
});

test('zooming out from the Sun walks the registry overviews in their order, and nothing else', () => {
  const walked: string[] = [];
  let scope: ReturnType<typeof overviewScopeAtCamera> = 'system';
  for (let distance = context.system.fadeOutStartDistanceM; distance <= context.camera.maximumDistanceM; distance *= 1.05) {
    scope = overviewScopeAtCamera(camera(distance), scope);
    if (scope !== 'system' && walked.at(-1) !== scope) walked.push(scope);
  }
  assert.deepEqual(walked, OVERVIEWS.map(overview => overview.id));
});

test('the ladder is the overview entries: an authored fifth level is reached past its own threshold', async () => {
  const { defineOverview } = await import('@cssearth/objects');
  const beyond = defineOverview({ kind: 'overview', id: 'beyond-the-horizon', name: 'Beyond', description: 'A test level.', order: 5,
    zoom: { enter: { distancePc: 3e10 }, returnBelow: { distancePc: 2e10 }, frame: { distance: { distancePc: 5e10 } } },
    holds: [], packages: [], route: '/beyond-the-horizon/', sceneHostId: 'sun' });
  const levels = [...OVERVIEWS, beyond], gpc = 1e9 * 3.085677581491367e16;
  assert.equal(overviewScopeAtCamera(camera(40 * gpc), 'observable-universe', context, undefined, levels), 'beyond-the-horizon');
  assert.equal(overviewScopeAtCamera(camera(25 * gpc), 'observable-universe', context, undefined, levels), 'observable-universe');
  assert.equal(overviewScopeAtCamera(camera(25 * gpc), 'beyond-the-horizon', context, undefined, levels), 'beyond-the-horizon', 'it returns only below its lower threshold');
  assert.equal(overviewFrameDistanceM(beyond, context), 5e10 * 3.085677581491367e16);
});

test("another star's system overview is left by the distance from that star, not from the Sun", () => {
  const { hiddenDistanceM: hidden } = context.system, parsec = 3.085677581491367e16, star = [12.47 * parsec, 0, 0];
  const near = { ...camera(0), pose: { ...camera(0).pose, positionM: [star[0]! + 1.5e11, 0, 0] as const } };
  assert.equal(overviewScopeAtCamera(near, 'system', context, { originM: star }), 'system', 'one astronomical unit from its star');
  const far = { ...camera(0), pose: { ...camera(0).pose, positionM: [star[0]! + hidden, 0, 0] as const } };
  assert.equal(overviewScopeAtCamera(far, 'system', context, { originM: star }), 'milky-way');
  // A binary in the Large Magellanic Cloud keeps its overview, then has no Milky Way step: it lies past the galaxy's own
  // boundary. Zooming out of it gives the same sequence whichever way the camera backs away, even toward the Sun.
  const lmc = [49.9e3 * parsec, 0, 0], at = (offsetM: number) => ({ ...camera(0), pose: { ...camera(0).pose, positionM: [lmc[0]! + offsetM, 0, 0] as const } });
  assert.equal(overviewScopeAtCamera(at(1e12), 'system', context, { originM: lmc }), 'system');
  for (const side of [1, -1]) {
    assert.equal(overviewScopeAtCamera(at(side * hidden), 'system', context, { originM: lmc }), 'local-group');
    assert.equal(overviewScopeAtCamera(at(side * 38e3 * parsec), 'local-group', context, { originM: lmc }), 'local-group',
      side < 0 ? '12 kpc from the Sun, 38 kpc from its star' : '88 kpc from the Sun');
    assert.equal(overviewScopeAtCamera(at(side * 6e6 * parsec), 'local-group', context, { originM: lmc }), 'nearby-universe');
  }
  // A host that authors its own orbit range (Sgr A*) keeps its overview while the world context still draws its orbits.
  const range = 1.5e16, sgr = [8.2e3 * parsec, 0, 0];
  const around = (offsetM: number) => ({ ...camera(0), pose: { ...camera(0).pose, positionM: [sgr[0]! + offsetM, 0, 0] as const } });
  assert.equal(overviewScopeAtCamera(around(range * 1.9), 'system', context, { originM: sgr, orbitsWithinM: range }), 'system');
  assert.equal(overviewScopeAtCamera(around(range * 2), 'system', context, { originM: sgr, orbitsWithinM: range }), 'milky-way');
});

test('galactic distance is measured from the Sun, independent of selected body and surface radius', () => {
  const plan = { ...context, focus: { ...context.focus, positionM: [100, 200, 300] as const } };
  const world = camera(500, plan), frame = frameAt([100, 200, 400], 20);
  const galactic = viewDistance(world, frame, 'milky-way', plan);
  assert.equal(galactic.label, 'Distance from Sun:');
  assert.equal(galactic.meters, 500);
  const surface = viewDistance(world, frame, 'system', plan);
  assert.equal(surface.label, 'Altitude:');
  assert.equal(surface.meters, 380);
});

test('prepared focus distance follows its catalogue position independently of the selected detail and overview scope', () => {
  const focus = { name: 'Prepared galaxy', positionM: [1e20, 2e20, -3e20] as const };
  const world = camera(1e18, { ...context, focus: { ...context.focus, positionM: [1e20, 2e20, -3e20] } });
  const frame = frameAt([100,200,300], 20);
  const value = viewDistance(world, frame, 'milky-way', undefined, focus);
  assert.equal(value.label, 'Distance to Prepared galaxy:');
  assert.ok(Math.abs(value.meters / 1e18 - 1) < 1e-12);
  assert.equal(viewDistance(world, frame, 'system', undefined, focus).meters, value.meters);
  assert.equal(viewDistance(world, frame, 'milky-way').label, 'Distance from Sun:');
});


test('extragalactic overview cards follow zoom with hysteresis and preserve distance meaning', () => {
  const pc = 3.085677581491367e16;
  const { fadeStartDistanceM: fadeStart, fullDistanceM: fadeEnd } = context.volume, middle = Math.sqrt(fadeStart * fadeEnd);
  assert.equal(overviewScopeAtCamera(camera(middle)), 'local-group');
  assert.equal(overviewScopeAtCamera(camera(middle * .99)), 'milky-way');
  assert.equal(overviewScopeAtCamera(camera(fadeStart * 1.01), 'local-group'), 'local-group');
  assert.equal(overviewScopeAtCamera(camera(fadeStart * .99), 'local-group'), 'milky-way');
  assert.equal(overviewScopeAtCamera(camera(6e6 * pc)), 'nearby-universe');
  assert.equal(overviewScopeAtCamera(camera(4.5e6 * pc), 'nearby-universe'), 'nearby-universe');
  assert.equal(overviewScopeAtCamera(camera(3.9e6 * pc), 'nearby-universe'), 'local-group');
  assert.equal(viewDistance(camera(6e6 * pc), frameAt([0,0,0], 1), 'nearby-universe').label, 'Distance from Sun:');
});
