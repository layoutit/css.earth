import assert from 'node:assert/strict';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import preparedContext from '../../src/objects/observable-universe/prepared/world-context.json' with { type: 'json' };
import { bodyViewAtCamera, zoomFrameDistanceM, zoomScopeAtCamera, viewDistance, type ZoomStep } from '../zoom-scope.mts';
import { GALAXY_SCALE } from '@cssearth/renderer/labels/universe-label-policy.ts';
import { presentWorldCamera } from '@cssearth/renderer/navigation/world-camera.ts';
import { parsePreparedWorldContext, type ObjectZoom, type PreparedWorldCameraFrame } from '@cssearth/objects';
import { type WorldCameraPose } from '@cssearth/engine';
import { systemOverviewDistance, SYSTEM_FRAMING_RADII } from '../system-framing.mts';
import { OBJECTS } from '../objects.mts';
import { seedObjectDirectory } from '../object-directory.mts';
import { insideBody, zoomChain } from '../inside-view.mts';
// A page knows the objects it has read; this test holds the whole registry.
seedObjectDirectory(OBJECTS);

/** The zoom's first scope is the centre's own system, by its id. These tests name no other, so it is the plan's focus's. */
const SYSTEM = 'solar-system';
/** The objects a zoom out of `id` hands over to, nearest first (inside-view.mts). */
const stepsOf = (id: string): readonly ZoomStep[] => zoomChain(id);
const SUN_STEPS = stepsOf('sun');
/** The scope at a camera, for a zoom out of the Sun unless `chain` says otherwise. */
const overviewScopeAtCamera = (world: Parameters<typeof zoomScopeAtCamera>[0], previous?: string, plan?: Parameters<typeof zoomScopeAtCamera>[2],
  centre?: Parameters<typeof zoomScopeAtCamera>[3], chain: readonly ZoomStep[] = SUN_STEPS) => zoomScopeAtCamera(world, previous, plan, centre, chain);

// The same validated plan the application mounts; the raw JSON import is untyped.
const context = parsePreparedWorldContext(preparedContext);

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

test('body navigation retains overview through small boundary reversals for bodies with and without moons', () => {
  const frame = frameAt([0, 0, 0], 1000);
  const optics: ReturnType<ObjectWorldNavigation['optics']> = { framingRadiusPixels: 400, visibleRect: null,
    focalPixels: 1000, principalOffsetPixels: [0, 0], widthPixels: 1200, heightPixels: 800, detailHandoffDiameterPixels: 14 };
  for (const id of ['fixture', 'saturn']) {
    const radius = SYSTEM_FRAMING_RADII.get(id);
    const threshold = radius ? systemOverviewDistance(1000, radius, optics) : 1000 * Math.sqrt(1 + (2000 / 14) ** 2);
    let previous: 'detail' | 'overview' = 'detail';
    for (const factor of [1.01, .99, 1.005, .98]) {
      previous = bodyViewAtCamera(camera(threshold * factor, { focus: { ...context.focus, positionM: [0, 0, 0] } }), frame, optics, id, previous);
      assert.equal(previous, 'overview');
    }
    assert.equal(bodyViewAtCamera(camera(threshold * .85, { focus: { ...context.focus, positionM: [0, 0, 0] } }), frame, optics, id, previous), 'detail');
  }
});

test('body navigation switches at the shared camera detail threshold, independent of camera aim', () => {
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
    assert.equal(bodyViewAtCamera(world, frame, optics, "fixture"), expected);
    const turned: WorldCameraPose = { ...world, pose: { ...world.pose, orientationXyzw: [0,1,0,0] } };
    assert.equal(bodyViewAtCamera(turned, frame, optics, "fixture"), expected, 'Looking away does not change zoom mode');
  }
  assert.equal(bodyViewAtCamera(camera(0, { ...context, focus: { ...context.focus, positionM: [...frame.originM] } }), frame, optics, "fixture"), 'detail');
  assert.equal(bodyViewAtCamera(null, frame, optics, "fixture"), 'detail');
});

test('overview leaves the Solar System midway through its fade, with a lower return threshold', () => {
  const { fadeOutStartDistanceM: start, hiddenDistanceM: hidden } = context.system, middle = Math.sqrt(start * hidden);
  assert.equal(overviewScopeAtCamera(camera(middle * .99)), SYSTEM);
  assert.equal(overviewScopeAtCamera(camera(middle)), 'milky-way');
  assert.equal(overviewScopeAtCamera(camera(context.camera.maximumDistanceM)), 'observable-universe');
  const gpc = 1e9 * 3.085677581491367e16;
  assert.equal(overviewScopeAtCamera(camera(.9 * gpc)), 'nearby-universe', 'short of 1 Gpc the view is the nearby universe');
  assert.equal(overviewScopeAtCamera(camera(.9 * gpc), 'observable-universe'), 'observable-universe', 'and returns only below 800 Mpc');
  assert.equal(overviewScopeAtCamera(camera(.7 * gpc), 'observable-universe'), 'nearby-universe');
  assert.equal(overviewScopeAtCamera(camera(start * 1.01), 'milky-way'), 'milky-way');
  assert.equal(overviewScopeAtCamera(camera(start * .99), 'milky-way'), SYSTEM);
});

test('zooming out from the Sun walks the objects it is inside that are seen from inside, in their order, and nothing else', () => {
  const walked: string[] = [];
  let scope: ReturnType<typeof overviewScopeAtCamera> = SYSTEM;
  for (let distance = context.system.fadeOutStartDistanceM; distance <= context.camera.maximumDistanceM; distance *= 1.05) {
    scope = overviewScopeAtCamera(camera(distance), scope);
    if (scope !== SYSTEM && walked.at(-1) !== scope) walked.push(scope);
  }
  assert.deepEqual(walked, ['milky-way', 'local-group', 'nearby-universe', 'observable-universe']);
  assert.deepEqual(SUN_STEPS.map(step => step.id), walked);
});

test('the steps are the chain it is given: an object farther out is reached past its own threshold', async () => {
  // An object seen from inside authors its frame with its thresholds; a step reads only the thresholds.
  const zoom: ObjectZoom = { enter: { distancePc: 3e10 }, returnBelow: { distancePc: 2e10 }, frame: { distance: { distancePc: 5e10 } } };
  const beyond = { id: 'beyond-the-horizon', zoom };
  const steps = [...SUN_STEPS, beyond], gpc = 1e9 * 3.085677581491367e16;
  assert.equal(overviewScopeAtCamera(camera(40 * gpc), 'observable-universe', context, undefined, steps), 'beyond-the-horizon');
  assert.equal(overviewScopeAtCamera(camera(25 * gpc), 'observable-universe', context, undefined, steps), 'observable-universe');
  assert.equal(overviewScopeAtCamera(camera(25 * gpc), 'beyond-the-horizon', context, undefined, steps), 'beyond-the-horizon', 'it returns only below its lower threshold');
  assert.equal(zoomFrameDistanceM(beyond, context), 5e10 * 3.085677581491367e16);
  // A centre inside nothing seen from inside stays its own system.
  assert.equal(zoomScopeAtCamera(camera(40 * gpc), SYSTEM, context, undefined, []), SYSTEM);
});

test("another star's system overview is left by the distance from that star, not from the Sun", () => {
  const { hiddenDistanceM: hidden } = context.system, parsec = 3.085677581491367e16, star = [12.47 * parsec, 0, 0];
  const near = { ...camera(0), pose: { ...camera(0).pose, positionM: [star[0]! + 1.5e11, 0, 0] as const } };
  assert.equal(overviewScopeAtCamera(near, SYSTEM, context, { originM: star }), SYSTEM, 'one astronomical unit from its star');
  const far = { ...camera(0), pose: { ...camera(0).pose, positionM: [star[0]! + hidden, 0, 0] as const } };
  assert.equal(overviewScopeAtCamera(far, SYSTEM, context, { originM: star }), 'milky-way');
  // A star of the Large Magellanic Cloud keeps its overview until the camera is outside the Cloud, which then takes the view
  // as its own scene and ends the zoom out of the star. The sequence is the same whichever way the camera backs away.
  const lmc = [49.9e3 * parsec, 0, 0], at = (offsetM: number) => ({ ...camera(0), pose: { ...camera(0).pose, positionM: [lmc[0]! + offsetM, 0, 0] as const } });
  const cloudSteps = stepsOf('hv-1005');
  assert.deepEqual(cloudSteps.map(step => step.id), ['lmc']);
  assert.equal(overviewScopeAtCamera(at(1e12), SYSTEM, context, { originM: lmc }, cloudSteps), SYSTEM);
  for (const side of [1, -1]) {
    const walked: string[] = [];
    let scope = SYSTEM;
    for (let distance = hidden / 4; distance <= context.camera.maximumDistanceM; distance *= 1.05) {
      scope = overviewScopeAtCamera(at(side * distance), scope, context, { originM: lmc }, cloudSteps);
      if (scope !== SYSTEM && walked.at(-1) !== scope) walked.push(scope);
    }
    assert.deepEqual(walked, cloudSteps.map(step => step.id), side < 0 ? 'backing away toward the Sun' : 'backing away from the Sun');
  }
  // A host that authors its own orbit range (Sgr A*) keeps its overview while the world context still draws its orbits.
  const range = 1.5e16, sgr = [8.2e3 * parsec, 0, 0];
  const around = (offsetM: number) => ({ ...camera(0), pose: { ...camera(0).pose, positionM: [sgr[0]! + offsetM, 0, 0] as const } });
  assert.equal(overviewScopeAtCamera(around(range * 1.9), SYSTEM, context, { originM: sgr, orbitsWithinM: range }), SYSTEM);
  assert.equal(overviewScopeAtCamera(around(range * 2), SYSTEM, context, { originM: sgr, orbitsWithinM: range }), 'milky-way');
});

test('a centre walks the objects it is inside, and one with a scene of its own ends the walk', () => {
  const at = (id: string) => stepsOf(id).map(step => step.id);
  assert.deepEqual(at('sgr-a-star'), ['milky-way', 'local-group', 'nearby-universe', 'observable-universe']);
  assert.deepEqual(at('lmc'), ['milky-way', 'local-group', 'nearby-universe', 'observable-universe']);
  assert.deepEqual(at('abell-2744'), ['observable-universe']);
  // A star of the Cloud, M33 in M31's subgroup and M87* are each inside an object with a scene: that object takes the view.
  assert.deepEqual(at('hv-1005'), ['lmc']);
  assert.deepEqual(at('m33'), ['m31']);
  assert.deepEqual(at('m87-star'), ['m87']);
  assert.deepEqual(at('m87'), ['virgo-cluster']);
  // A system the centre's own is inside is such an object: Epsilon Indi B zooms out into Epsilon Indi A's system, whose
  // own zoom goes on to the Milky Way.
  assert.deepEqual(at('eps-indi-ba'), ['eps-indi-a-system']);
  assert.equal(stepsOf('eps-indi-ba')[0]!.body, true);
  assert.deepEqual(at('eps-indi-a'), ['milky-way', 'local-group', 'nearby-universe', 'observable-universe']);
  // It is entered once the camera is outside it: as far from the star as the object's centre and its radius.
  const frameOf = (id: string) => OBJECTS.find(object => object.id === id)!.worldFrame!, parsec = 3.085677581491367e16;
  const cloud = frameOf('lmc'), star = frameOf('hv-1005'), step = stepsOf('hv-1005')[0]!;
  const outside = Math.hypot(...star.originM.map((value, axis) => value - cloud.originM[axis]!)) + cloud.bodyRadiusM;
  assert.equal(step.body, true);
  assert.deepEqual(step.zoom, { enter: { distancePc: outside / parsec }, returnBelow: { distancePc: outside / parsec * .8 } });
  const from = (rangeM: number) => ({ ...camera(0), pose: { ...camera(0).pose, positionM: [star.originM[0]! + rangeM, star.originM[1]!, star.originM[2]!] as const } });
  const scopeAt = (rangeM: number, previous?: string) => zoomScopeAtCamera(from(rangeM), previous, context, { originM: star.originM }, stepsOf('hv-1005'));
  assert.equal(scopeAt(outside * .99, SYSTEM), SYSTEM, 'inside the Cloud the star keeps the view, past where its system fades');
  assert.equal(scopeAt(outside * 1.01, SYSTEM), 'lmc');
  assert.equal(scopeAt(outside * .9, 'lmc'), 'lmc', 'the Cloud keeps the view down to its lower return distance');
  assert.equal(scopeAt(outside * .79, 'lmc'), SYSTEM);
  // The same object is what a body with no system hands the view to (overview-selection.mts); none inside a system or
  // inside an object seen from inside.
  assert.equal(insideBody('hv-1005')?.id, 'lmc');
  assert.equal(insideBody('m87-star')?.id, 'm87');
  assert.equal(insideBody('earth'), null);
  assert.equal(insideBody('lmc'), null);
  // Every object with something inside it is reached this way or seen from inside.
  const entered = new Set(OBJECTS.flatMap(object => { const parent = insideBody(object.id); return parent ? [parent.id] : []; }));
  const parents = new Set(OBJECTS.flatMap(object => object.parent && !OBJECTS.find(other => other.id === object.parent)?.system ? [object.parent] : []));
  assert.deepEqual([...parents].filter(id => !entered.has(id) && OBJECTS.find(object => object.id === id)?.zoom === undefined), []);
});

test('galactic distance is measured from the Sun, independent of selected body and surface radius', () => {
  const plan = { ...context, focus: { ...context.focus, positionM: [100, 200, 300] as const } };
  const world = camera(500, plan), frame = frameAt([100, 200, 400], 20);
  const galactic = viewDistance(world, frame, 'milky-way', plan);
  assert.equal(galactic.label, 'Distance from Sun:');
  assert.equal(galactic.meters, 500);
  const surface = viewDistance(world, frame, SYSTEM, plan);
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
  assert.equal(viewDistance(world, frame, SYSTEM, undefined, focus).meters, value.meters);
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
