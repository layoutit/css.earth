import { isExtendedClassification } from '@cssearth/objects';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { decodeWorldOrbitBank, parseCompleteWorldContext, parsePreparedWorldContext } from '../../prepared-data/world-context.js';
import { createSystemFade } from './context-scale.js';
import { createWorldContextPlanner } from './world-context-planner.js';
import type { WorldContextView } from './world-context-planner.js';
import { packWorldBodies, unpackWorldBodies } from './world-context-view-transport.js';
import { FEATURED_STAR_TIER, labelImportance } from '../../labels/universe-label-policy.js';
import { unpackPreparedBinary } from '@cssearth/objects/node';

const plan = parsePreparedWorldContext(JSON.parse(await readFile(
  new URL('../../../../../src/objects/sun/prepared/world-context.json', import.meta.url), 'utf8')));
const freeze = <T>(value: T): T => {
  // Typed orbit arrays cannot be frozen; the test compares their contents instead.
  if (value && typeof value === 'object' && !ArrayBuffer.isView(value)) {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
// Tests move the observer in place; the planner itself receives the readonly view.
type World = WorldContextView['world'];
type TestView = Omit<WorldContextView, 'world'> & { world: Omit<World, 'pose'> & { pose: Omit<World['pose'], 'positionM'> & { positionM: [number, number, number] } } };
function view(): TestView {
  return { world: { referenceFrame: plan.frame.referenceFrame, epochJdTt: plan.frame.epochJdTt,
    pose: { positionM: [0, 0, 20 * 149597870700], orientationXyzw: [0, 0, 0, 1] } },
    viewport: { focalPixels: 1727, widthPixels: 1995, heightPixels: 1236, principalOffsetPixels: [170, 0] },
    selectedId: plan.focus.id, overview: true, navigationInFlight: false, anchorOnly: false,
    bodies: [plan.focus, ...plan.bodies].map(body => ({ hovered: false, orbitHidden: false, labelHidden: false,
      labelSize: { width: body.name.length * 6, height: 14 }, labelShown: false, labelPlacement: 0,
      indicatorShown: false, indicatorRadius: 8, orbitAppearance: { width: 1, opacity: 1 } })) };
}

test('shell rectangles do not decide world annotation membership or placement', () => {
  const current = view(), planner = createWorldContextPlanner(plan);
  const publish = () => {
    const frame = planner(current);
    for (const body of frame.projectedBodies) Object.assign(current.bodies[body.index], {
      labelShown: body.labelShown, labelPlacement: body.labelPlacement, indicatorShown: body.indicatorShown,
    });
    return frame.projectedBodies.filter(body => body.labelShown).map(body => ({ index: body.index, placement: body.labelPlacement, point: [...body.labelPosition!] }));
  };
  publish();
  const settled = publish();
  assert.deepEqual(publish(), settled);
  assert.ok(settled.length > 0);
  current.labelBlockers = [{ left: -10000, top: -10000, right: 10000, bottom: 10000 }];
  assert.deepEqual(publish(), settled);
});

test('viewport edges constrain captions without retiring an in-frame circle', () => {
  const current = view(), planner = createWorldContextPlanner(plan);
  const initial = planner(current);
  const targetIndex = [plan.focus, ...plan.bodies].findIndex(body => body.id === 'earth');
  const target = initial.projectedBodies.find(body => body.index === targetIndex)!;
  assert.equal(target.labelShown, true);
  assert.equal(target.indicatorShown, true);
  const targetX = target.x;
  for (const body of initial.projectedBodies) Object.assign(current.bodies[body.index], {
    labelShown: body.labelShown, labelPlacement: body.labelPlacement, indicatorShown: body.indicatorShown,
  });
  current.bodies.forEach((body, index) => { body.labelHidden = index !== targetIndex; });
  const width = current.viewport.widthPixels!, [offsetX, offsetY] = current.viewport.principalOffsetPixels!;
  const shifted = { ...current, viewport: { ...current.viewport,
    principalOffsetPixels: [offsetX + width / 2 - 1 - targetX, offsetY] as const } };
  const edge = planner(shifted).projectedBodies.find(body => body.index === targetIndex)!;
  assert.equal(edge.visible, true);
  assert.equal(edge.labelShown, true);
  assert.equal(edge.indicatorShown, true);
  const label = current.bodies[targetIndex]!.labelSize;
  assert.ok(edge.labelPosition![0] >= -width / 2 + 4);
  assert.ok((edge.labelPosition![0] + label.width) <= width / 2 - 4);
});

test('complete context frames cross a structured-clone boundary without mutating the input owner', () => {
  const calculate = createWorldContextPlanner(freeze(plan));
  const input = freeze(view());
  const savedInput = structuredClone(input);
  const first = structuredClone(calculate(input));
  const savedFirst = structuredClone(first);
  assert.equal(first.projectedBodies.some(body => body.segments.length > 0), true);
  for (const distance of [5, 50, 5000, 20]) {
    const next = structuredClone(input);
    Object.assign(next.world.pose, { positionM: [next.world.pose.positionM[0], next.world.pose.positionM[1], distance * 149597870700] });
    next.selectedId = 'saturn'; next.overview = false;
    next.bodies[0].hovered = true;
    const packet = structuredClone(calculate(freeze(next)));
    assert.equal(packet.emphasizedId, 'saturn');
    for (const body of packet.projectedBodies) {
      assert.ok(!("transforms" in body));
      assert.equal(body.segments.every(segment => segment.length === 5 && segment.every(Number.isFinite)), true);
    }
  }
  assert.deepEqual(input, savedInput);
  assert.deepEqual(first, savedFirst);
  // Replaying the same committed inputs is independent of requests that ran
  // in between: rejected/superseded frames cannot own decluttering history.
  assert.deepEqual(structuredClone(calculate(input)), first);
});

test('past the galaxy scope the placed stars retire too, and the anchor alone keeps its marker', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  input.anchorOnly = true; input.systemRetired = true;
  const locatorOpacity = () => calculate(input).projectedBodies.filter(body => body.index !== 0).map(body => body.markerOpacity);
  assert.ok(locatorOpacity().some(opacity => opacity > 0), 'past the system scope the placed stars stay as galactic locators');
  input.galaxyRetired = true;
  assert.deepEqual(locatorOpacity().filter(opacity => opacity > 0), [], 'past the galaxy scope they retire');
  assert.ok(calculate(input).projectedBodies[0]!.markerOpacity > 0, 'the anchor stands for them');
});

test('retired and incompatible frame requests respect prepared identity and measured optics', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  input.anchorOnly = true;
  // The anchor and every placed orbitless body (Betelgeuse) remain as galactic locators.
  const locators = [plan.focus, ...plan.bodies].flatMap((body, index) => index === 0 || !('orbit' in body && body.orbit) ? [index] : []);
  assert.ok(locators.length > 1);
  assert.deepEqual(calculate(input).projectedBodies.map(body => body.index), locators);
  assert.throws(() => calculate({ ...input, selectedId: 'missing' }), /unavailable/);
  assert.throws(() => calculate({ ...input, bodies: [] }), /matching frame/);
  assert.throws(() => calculate({ ...input, viewport: { ...input.viewport, widthPixels: undefined } }), /measured viewport/);
  assert.throws(() => calculate({ ...input, world: { ...input.world, epochJdTt: input.world.epochJdTt + 1 } }), /matching frame/);
});

test('overview does not resurrect the selected billboard over a resolved surface', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  input.world.pose.positionM = [0, 0, plan.focus.radiusM * 20];
  const marker = (overview: boolean) => calculate({ ...input, overview }).projectedBodies.find(body => body.index === 0)!;
  assert.equal(marker(true).markerOpacity, 0);
  assert.equal(marker(false).markerOpacity, 0);
});

test('a departed focus outside the view cannot blank the surrounding orbit field', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  input.overview = false; input.navigationInFlight = true; input.selectionPreview = 'arrokoth';
  for (const z of [0, -149597870700, 149597870]) {
    input.world.pose.positionM = [20 * 149597870700, 0, z];
    const packet = calculate(input);
    assert.equal(packet.projectedBodies.some(body => body.orbitVisibility > 0 && body.segments.length > 0), true, `orbit field remains visible while the departed Sun crosses the eye plane at ${z}`);
  }
  // Preserve the close-up fade when the selected disc really fills the view:
  // context lines soften to the shared close-detail floor.
  input.selectionPreview = undefined;
  input.world.pose.positionM = [0, 0, plan.focus.radiusM * 5];
  assert.ok(Math.max(...calculate(input).projectedBodies.map(body => body.orbitVisibility)) <= .3);
});

test('zoom jitter does not repeatedly reverse annotation visibility at its exit threshold', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  input.anchorOnly = true; input.overview = false;
  const sample = (diameter: number) => {
    const radius = plan.focus.radiusM;
    input.world.pose.positionM[2] = Math.hypot(radius, 2 * input.viewport.focalPixels * radius / diameter);
    const body = calculate(input).projectedBodies[0];
    Object.assign(input.bodies[0], { labelShown: body.labelShown, indicatorShown: body.indicatorShown,
      labelPlacement: body.labelPlacement });
    return body;
  };
  // The label leaves at the authored 50% billboard alpha and does not flicker
  // back on when wheel/camera samples straddle that same boundary.
  assert.equal(sample(16).labelShown, true);
  assert.equal(sample(17.06).labelShown, false);
  for (const diameter of [16.94, 17.06, 16.94, 17.06]) assert.equal(sample(diameter).labelShown, false);
  assert.equal(sample(16.64).labelShown, true);
  assert.equal(sample(16.94).labelShown, true);
  // Ring eligibility uses the same committed-state rule at the 8px boundary.
  assert.equal(sample(7.7).indicatorShown, true);
  assert.equal(sample(8.01).indicatorShown, false);
  for (const diameter of [7.99, 8.01, 7.99]) assert.equal(sample(diameter).indicatorShown, false);
  assert.equal(sample(7.7).indicatorShown, true);
});

test('a flight destination keeps its caption and its side across the preview fade', () => {
  for (const overview of [false, true]) {
  const calculate = createWorldContextPlanner(plan), input = view();
  const target = plan.bodies.find(body => body.id === 'mercury')!;
  const index = 1 + plan.bodies.indexOf(target);
  // The shell can still own the source overview while destination detail activates.
  input.selectedId = overview ? plan.focus.id : target.id;
  input.selectionPreview = target.id; input.overview = overview; input.navigationInFlight = true;
  for (const diameter of [4, 8, 13, 14, 17, 21, 50, 150, 300]) {
    input.world.pose.positionM = [target.positionM[0], target.positionM[1],
      target.positionM[2] + Math.hypot(target.radiusM, 2 * input.viewport.focalPixels * target.radiusM / diameter)];
    const body = calculate(input).projectedBodies.find(body => body.index === index)!;
    assert.equal(body.labelShown, true, `${diameter}px destination must remain named`);
    assert.equal(body.labelPlacement, 0);
    assert.equal(body.indicatorShown, diameter < 20, `${diameter}px circle follows the preview handoff`);
    if (diameter >= 20) assert.equal(body.markerOpacity, 0);
    Object.assign(input.bodies[index], { labelShown: body.labelShown, labelPlacement: body.labelPlacement,
      indicatorShown: body.indicatorShown });
  }
  input.navigationInFlight = false; input.overview = false; input.selectedId = target.id;
  assert.equal(calculate(input).projectedBodies.find(body => body.index === index)!.labelShown, false);
  }
});

for (const id of ['luhman-16', 'mercury']) test(`selected ${id} keeps its locator when the separate selected caption owns its name`, () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  const target = plan.bodies.find(body => body.id === id)!, index = 1 + plan.bodies.indexOf(target);
  input.selectedId = id; input.overview = false;
  input.bodies[index].labelSuppressed = true;
  const sample = (diameter: number) => {
    input.world.pose.positionM = [target.positionM[0], target.positionM[1],
      target.positionM[2] + Math.hypot(target.radiusM, 2 * input.viewport.focalPixels * target.radiusM / diameter)];
    return calculate(input).projectedBodies.find(body => body.index === index)!;
  };
  const point = sample(.1);
  assert.equal(point.visible, true);
  assert.equal(point.indicatorShown, true);
  assert.equal(point.labelShown, false);
  assert.equal(point.labelPosition, undefined);
  // Resolved detail owns the surface; the small locator must not sit over it.
  assert.equal(sample(100).indicatorShown, false);
  assert.equal(sample(.1).indicatorShown, true);
  input.selectionPreview = plan.focus.id;
  assert.equal(sample(.1).indicatorShown, false);
  input.selectionPreview = undefined;
  input.bodies[index].labelSuppressed = false;
  const ordinary = sample(.1);
  assert.equal(ordinary.indicatorShown, true);
  assert.equal(ordinary.labelShown, true);
});

test('orbit settings do not change admitted names or label placement', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  const labels = () => calculate(input).projectedBodies.filter(body => body.labelShown)
    .map(body => ({ index: body.index, position: body.labelPosition }));
  const before = structuredClone(labels());
  assert.ok(before.length > 0);
  input.bodies.forEach(body => { body.orbitHidden = true; });
  assert.deepEqual(labels(), before);
});

test('hidden planetary annotations remove labels, circles and their orbit paths', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  const points = [plan.focus, ...plan.bodies];
  const planets = new Set(['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
  input.world.pose.positionM = [0, 0, 40 * 149597870700];
  input.bodies.forEach((body, index) => { body.labelHidden = planets.has(points[index]!.id); });
  const bodies = calculate(input).projectedBodies;
  const outer = bodies.filter(body => ['jupiter', 'saturn', 'uranus', 'neptune'].includes(points[body.index]!.id));
  assert.equal(outer.every(body => !body.labelShown && !body.indicatorShown), true);
  const onScreen = outer.filter(body => body.visible);
  assert.ok(onScreen.length > 0);
  assert.equal(onScreen.every(body => body.orbitVisibility === 0 && body.segments.length === 0), true);
});

test('highlighted moons remain identifiable when their orbits are too small to draw', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  const bodies = [plan.focus, ...plan.bodies];
  const moons = new Set(['moon', 'phobos', 'deimos', 'io', 'europa', 'ganymede', 'callisto', 'titan', 'rhea', 'triton', 'charon']);
  input.bodies.forEach((body, index) => {
    body.highlighted = moons.has(bodies[index].id);
    body.orbitHidden = true;
  });
  for (const distance of [50, 100, 205]) {
    input.world.pose.positionM = [0, 0, distance * 149597870700];
    const frame = calculate({ ...input, bodies: unpackWorldBodies(packWorldBodies(input.bodies)) });
    const admitted = frame.projectedBodies.filter(body => moons.has(bodies[body.index].id) && body.labelShown);
    assert.ok(admitted.length > 0);
    for (const body of admitted) {
      assert.equal(body.indicatorShown, true);
      assert.ok(body.markerOpacity > .5);
      assert.equal(body.segments.length, 0);
    }
  }
  input.bodies.forEach(body => { body.highlighted = false; });
  assert.equal(calculate({ ...input, bodies: unpackWorldBodies(packWorldBodies(input.bodies)) })
    .projectedBodies.filter(body => moons.has(bodies[body.index].id) && body.labelShown).length, 0);
});

test('system zoom and rotation keep orbit paths when captions lose their slots', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  let paths = 0, crowded = 0, uncaptionedPaths = 0;
  for (const distance of [20, 75, 205, 75, 20]) for (const angle of [0, .3, .7, .3, 0]) {
    input.world.pose.positionM = [0, 0, distance * 149597870700];
    Object.assign(input.world.pose, { orientationXyzw: [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)] });
    const frame = calculate(input);
    for (const body of frame.projectedBodies) {
      if (body.indicatorShown) assert.equal(body.labelShown, true);
      if (body.segments.length && body.visible && body.labelShown) paths++;
      if (body.segments.length && body.visible && !body.labelShown) uncaptionedPaths++;
      if (!body.labelShown && body.visible) crowded++;
      Object.assign(input.bodies[body.index], { labelShown: body.labelShown, labelPlacement: body.labelPlacement,
        indicatorShown: body.indicatorShown });
    }
  }
  assert.ok(paths > 0);
  assert.ok(crowded > 0);
  assert.ok(uncaptionedPaths > 0);
});

test('a body too faint for this camera to name draws no ring beside the named ones', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  const points = [plan.focus, ...plan.bodies], index = points.findIndex(body => body.id === 'ceres');
  input.world.pose.positionM = [0, 0, 205 * 149597870700];
  const far = calculate(input).projectedBodies.find(body => body.index === index)!;
  assert.equal(far.visible, true, 'Ceres is on screen at whole-system range');
  assert.equal(far.labelShown, false);
  assert.equal(far.indicatorShown, false);
  assert.equal(far.segments.length, 0, 'an unnamed body on screen draws no path');
  input.world.pose.positionM = [0, 0, 8 * 149597870700];
  const near = calculate(input).projectedBodies.find(body => body.index === index)!;
  assert.equal(near.labelShown, true, 'the same body is named once the camera resolves it');
  assert.ok(near.segments.length > 0);
});

test('turning the view preserves projected paths through caption admission changes', { timeout: 20000 }, () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  input.rotationActive = true;
  const points = [plan.focus, ...plan.bodies];
  const captions = new Map<string, boolean>();
  let captionFlips = 0, paths = 0, offScreenPaths = 0, uncaptionedPaths = 0;
  // A drag tumbles the camera around the focus. Bodies cross the viewport edge and lose
  // their annotations; paths can remain whether their bodies are in or out of frame.
  for (let step = 0; step < 90; step++) {
    const angle = step * .5 * Math.PI / 180, distance = 8 * 149597870700;
    Object.assign(input.world.pose, { orientationXyzw: [Math.sin(angle / 2), 0, 0, Math.cos(angle / 2)] });
    input.world.pose.positionM = [0, -distance * Math.sin(angle), distance * Math.cos(angle)];
    for (const body of calculate(input).projectedBodies) {
      const id = points[body.index]!.id;
      if (captions.get(id) !== undefined && captions.get(id) !== body.labelShown) captionFlips++;
      if (body.segments.length) {
        paths++;
        if (body.visible && !body.labelShown) uncaptionedPaths++;
        else if (!body.labelShown) offScreenPaths++;
      }
      captions.set(id, body.labelShown);
      Object.assign(input.bodies[body.index]!, { labelShown: body.labelShown, labelPlacement: body.labelPlacement,
        indicatorShown: body.indicatorShown });
    }
  }
  assert.ok(captionFlips > 0, 'captions come and go as their bodies cross the edge');
  assert.ok(paths > 0, 'admitted bodies still draw their paths');
  assert.ok(uncaptionedPaths > 0, 'caption collisions do not retire on-screen paths');
  assert.ok(offScreenPaths > 0, 'paths keep crossing after their bodies leave the frame');
}); // Plans every prepared orbit through a full turn; CI measured 4.4 s at 60 points.

test('an active camera drag preserves the committed inner-system annotations', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  const points = [plan.focus, ...plan.bodies];
  const tracked = new Set(['venus', 'earth', 'mars', 'ceres']);
  input.overview = false;
  input.world.pose.positionM = [0, 0, 27.5 * 149597870700];
  const initial = calculate(input);
  const committed = new Map(initial.projectedBodies
    .filter(body => tracked.has(points[body.index]!.id))
    .map(body => [points[body.index]!.id, body.labelShown]));
  for (const body of initial.projectedBodies) Object.assign(input.bodies[body.index], {
    labelShown: body.labelShown, labelPlacement: body.labelPlacement, indicatorShown: body.indicatorShown,
  });
  assert.equal([...committed.values()].some(Boolean), true);
  input.rotationActive = true;
  for (let step = -12; step <= 12; step++) {
    const angle = step * Math.PI / 180;
    Object.assign(input.world.pose, { orientationXyzw: [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)] });
    const frame = calculate(input);
    for (const body of frame.projectedBodies) {
      const id = points[body.index]!.id;
      if (tracked.has(id)) assert.equal(body.labelShown, committed.get(id), `${id} keeps its drag-start admission`);
      Object.assign(input.bodies[body.index], {
        labelShown: body.labelShown, labelPlacement: body.labelPlacement, indicatorShown: body.indicatorShown,
      });
    }
  }
  input.rotationActive = false;
  input.preserveCommittedAnnotations = true;
  const settled = calculate(input);
  for (const body of settled.projectedBodies) {
    const id = points[body.index]!.id;
    if (!tracked.has(id)) continue;
    assert.equal(body.labelShown, committed.get(id), `${id} keeps its final inertial admission on settlement`);
    if (body.labelShown) assert.equal(body.labelPlacement, input.bodies[body.index]!.labelPlacement);
  }
});

test('major planets remain identified through a full active-drag rotation', { timeout: 20000 }, () => {
  const points = [plan.focus, ...plan.bodies], input = view();
  const majorIds = new Set(['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
  const priorities = Object.fromEntries(points.map(body => [body.id,
    body.id === 'sun' ? 5 : majorIds.has(body.id) ? 3 : 0]));
  const calculate = createWorldContextPlanner(plan, priorities);
  input.world.pose.positionM = [0, 0, 37.31 * 149597870700];
  input.rotationActive = true;
  for (let step = 0; step <= 72; step++) {
    const angle = step * 5 * Math.PI / 180, distance = 37.31 * 149597870700;
    Object.assign(input.world.pose, {
      positionM: [distance * Math.sin(angle), 0, distance * Math.cos(angle)],
      orientationXyzw: [0, Math.sin(angle / 2), 0, Math.cos(angle / 2)],
    });
    const frame = calculate(input);
    for (const id of ['mars', 'uranus', 'neptune']) {
      const body = frame.projectedBodies.find(body => points[body.index]!.id === id)!;
      assert.equal(body.labelShown, true, `${id} stays named at rotation step ${step}`);
      assert.equal(body.indicatorShown, true, `${id} keeps its circle at rotation step ${step}`);
    }
    for (const body of frame.projectedBodies) {
      Object.assign(input.bodies[body.index], { labelShown: body.labelShown, labelPlacement: body.labelPlacement,
        indicatorShown: body.indicatorShown });
    }
  }
}); // Plans every prepared orbit through a full drag rotation; CI measured 4.0 s at 60 points.

test('an off-screen body keeps an orbit path that crosses the viewport', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  // Closing in on the Sun takes body after body out of the frame while their rings
  // still sweep the viewport. Those paths remain even though no annotation can fit.
  let offScreenPaths = 0;
  for (const distance of [1.2, 1.6, 2.2, 3, 4.5]) {
    input.world.pose.positionM = [0, 0, distance * 149597870700];
    for (const body of calculate(input).projectedBodies) {
      if (body.visible || !body.segments.length) continue;
      offScreenPaths++;
      assert.equal(body.labelShown, false);
      assert.ok(body.orbitVisibility > 0, 'an off-screen ring keeps its own fade');
      Object.assign(input.bodies[body.index], { labelShown: body.labelShown, labelPlacement: body.labelPlacement,
        indicatorShown: body.indicatorShown });
    }
  }
  assert.ok(offScreenPaths > 0, 'rings stay while their bodies leave the frame');
});

test('Earth priority keeps its ordinary scale fade and leaves the Sun at outer-space distance', () => {
  const input = view(), points = [plan.focus, ...plan.bodies];
  input.bodies.forEach((body, index) => { body.bodyHidden = !['sun', 'earth'].includes(points[index].id); });
  const calculate = createWorldContextPlanner(plan, {
    sun: labelImportance('star', true, 5), earth: labelImportance('planet', true, 4),
  });
  input.world.pose.positionM = [0, 0, 5 * 149597870700];
  assert.ok(calculate(input).projectedBodies.filter(body => body.labelShown).map(body => points[body.index].id).includes('earth'));
  input.world.pose.positionM = [0, 0, plan.system.hiddenDistanceM * 2];
  assert.deepEqual(calculate(input).projectedBodies.filter(body => body.labelShown).map(body => points[body.index].id), ['sun']);
});

test('Earth remains a circle-and-label reference through the framed outer Solar System, then retires normally', () => {
  const input = view(), points = [plan.focus, ...plan.bodies];
  input.viewport = { focalPixels: 1100, widthPixels: 1445, heightPixels: 720, principalOffsetPixels: [0, 0] };
  const calculate = createWorldContextPlanner(plan, {
    sun: labelImportance('star', true, 5), earth: labelImportance('planet', true, 4),
  });
  for (const distanceAu of [50]) {
    input.world.pose.positionM = [0, 0, distanceAu * 149597870700];
    const frame = calculate(input), earth = frame.projectedBodies.find(body => points[body.index].id === 'earth')!;
    assert.equal(earth.labelShown, true);
    assert.equal(earth.indicatorShown, true);
    assert.equal(earth.segments.length, 0);
  }
  for (const distanceAu of [233.27, plan.system.fadeOutStartDistanceM / 149597870700]) {
    input.world.pose.positionM = [0, 0, distanceAu * 149597870700];
    const frame = calculate(input), earth = frame.projectedBodies.find(body => points[body.index].id === 'earth')!;
    assert.equal(earth.labelShown, true);
    assert.equal(earth.indicatorShown, false);
    assert.equal(earth.segments.length, 0);
    if (distanceAu === 233.27) {
      Object.assign(input.bodies[earth.index], {
        labelShown: earth.labelShown,
        labelPlacement: earth.labelPlacement,
        indicatorShown: earth.indicatorShown,
        hovered: true,
      });
      const hovered = calculate(input).projectedBodies.find(body => body.index === earth.index)!;
      assert.equal(hovered.labelShown, true);
      assert.equal(hovered.indicatorShown, false);
      assert.equal(hovered.segments.length, 0);
      assert.deepEqual(hovered.labelPosition, earth.labelPosition);
      input.bodies[earth.index]!.hovered = false;
    }
  }
  input.world.pose.positionM = [0, 0, plan.system.hiddenDistanceM * 2];
  const beyond = calculate(input).projectedBodies.find(body => points[body.index].id === 'earth')!;
  assert.equal(beyond.labelShown, false);
  assert.equal(beyond.indicatorShown, false);
});

test('the Sun and Earth remain distinct landmarks in the distant Solar System', () => {
  const input = view(), points = [plan.focus, ...plan.bodies];
  input.viewport = { focalPixels: 1108.5, widthPixels: 1280, heightPixels: 720, principalOffsetPixels: [0, 0] };
  input.world.pose.positionM = [0, 0, 357.27 * 149597870700];
  input.bodies.forEach((body, index) => { body.bodyHidden = !['sun', 'earth'].includes(points[index]!.id); });
  const frame = createWorldContextPlanner(plan, {
    sun: labelImportance('star', true, 5), earth: labelImportance('planet', true, 4),
  })(input);
  const sun = frame.projectedBodies.find(body => points[body.index]!.id === 'sun')!;
  const earth = frame.projectedBodies.find(body => points[body.index]!.id === 'earth')!;
  assert.equal(sun.labelShown, true);
  assert.equal(sun.indicatorShown, true);
  assert.equal(earth.labelShown, true);
  assert.ok(sun.labelPosition![1] < earth.labelPosition![1]);
});

for (const id of ['ryugu', 'bennu']) test(`${id} remains identifiable when its category is hidden, then retires on deselection`, () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  const points = [plan.focus, ...plan.bodies], index = points.findIndex(body => body.id === id);
  const selected = points[index]!;
  input.selectedId = id; input.overview = false;
  input.world.pose.positionM = [selected.positionM[0], selected.positionM[1], selected.positionM[2] + 3.8e10];
  // The shell leaves the selected asteroid's orbit enabled. Hidden bodies,
  // circles and captions still carry the user's category preferences.
  input.bodies.forEach(body => Object.assign(body, { bodyHidden: true, indicatorHidden: true, labelHidden: true }));
  const shown = calculate(input).projectedBodies.find(body => body.index === index)!;
  assert.equal(shown.visible, true);
  assert.equal(shown.indicatorShown, true);
  assert.equal(shown.labelShown, true);
  assert.ok(shown.orbitVisibility > 0);
  assert.ok(shown.segments.length > 0);
  assert.equal(calculate(input).projectedBodies.filter(body => body.visible).length, 1);
  input.selectedId = plan.focus.id; input.overview = true;
  const hidden = calculate(input).projectedBodies.find(body => body.index === index)!;
  assert.equal(hidden.visible, false);
  assert.equal(hidden.indicatorShown, false);
  assert.equal(hidden.labelShown, false);
  assert.equal(hidden.segments.length, 0);
});

test('planet views label their own moon family, with a bounded total', () => {
  const points = [plan.focus, ...plan.bodies];
  const calculate = createWorldContextPlanner(plan), input = view();
  const saturn = points.find(body => body.id === 'saturn')!;
  input.selectedId = 'saturn'; input.overview = false;
  input.world.pose.positionM = [saturn.positionM[0], saturn.positionM[1], saturn.positionM[2] + 4e10];
  const names = calculate(input).projectedBodies.filter(body => body.labelShown).map(body => points[body.index]!);
  assert.ok(names.length <= 24);
  assert.equal(names.some(body => body.id === 'saturn'), true);
  assert.equal(names.filter(body => 'orbit' in body && body.orbit && body.orbit.centerBodyId !== plan.focus.id)
    .every(body => 'orbit' in body && body.orbit?.centerBodyId === 'saturn'), true);
});

for (const id of ['saturn', 'jupiter', 'uranus']) test(`${id}: close detail retires its own and unrelated solar orbits`, () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  const points = [plan.focus, ...plan.bodies], index = points.findIndex(body => body.id === id);
  const selected = plan.bodies[index - 1]!;
  input.selectedId = id; input.overview = false;
  for (const discHeightShare of [.1, .2, .3, .6]) {
    const distance = Math.hypot(selected.radiusM,
      2 * input.viewport.focalPixels * selected.radiusM / (1236 * discHeightShare));
    input.world.pose.positionM = [selected.positionM[0], selected.positionM[1], selected.positionM[2] + distance];
    const frame = calculate(input);
    const own = frame.projectedBodies.find(body => body.index === index)!;
    // Below the fade the path is drawn; from the fade's end (30% of the viewport height) it is gone.
    if (discHeightShare < .3) {
      assert.ok(own.segments.length > 0, `${discHeightShare} viewport height`);
      assert.ok(own.orbitVisibility > 0);
      assert.equal(own.segments.every(segment => segment.every(Number.isFinite)), true);
    } else assert.equal(own.orbitVisibility, 0, `${discHeightShare} viewport height`);
    // Other planets' paths are irrelevant at close detail. The selected planet's nearby moons retain their own policy.
    const otherSolarOrbits = frame.projectedBodies.filter(body => {
      const point = points[body.index]!;
      return body.index !== index && 'orbit' in point && point.orbit?.centerBodyId === plan.focus.id;
    });
    if (discHeightShare >= .3) assert.equal(otherSolarOrbits.every(body => body.orbitVisibility === 0), true);
  }
  input.bodies[index]!.orbitHidden = true;
  assert.equal(calculate(input).projectedBodies.find(body => body.index === index)!.orbitVisibility, 0);
});

test('a featured orbitless star keeps its marker beyond the system fade, like the anchor; another gives way to the galaxy', () => {
  const star = plan.bodies.findIndex(body => !body.orbit) + 1;
  assert.ok(star > 0);
  const calculate = createWorldContextPlanner(plan, { [plan.bodies[star - 1]!.id]: FEATURED_STAR_TIER }), input = view();
  // 300 pc above the Sun-Betelgeuse midpoint, looking down -z: both locators are in frame and the
  // system fade has run its course (opacity 0), so only locators publish.
  const placedM = plan.bodies[star - 1]!.positionM;
  // Only the anchor and the placed body compete for captions: the catalogue's other stars would otherwise spend the shared
  // label limit, and which of them are in frame here depends on how many stars the catalogue holds, not on this behaviour.
  input.bodies.forEach((body, index) => { body.labelHidden = index !== 0 && index !== star; });
  input.anchorOnly = true; input.world.pose.positionM = [placedM[0] / 2, placedM[1] / 2, placedM[2] / 2 + 300 * 3.085677581491367e16];
  const packet = calculate(input);
  const anchor = packet.projectedBodies.find(body => body.index === 0)!, placed = packet.projectedBodies.find(body => body.index === star)!;
  assert.equal(placed.markerOpacity, 1);
  assert.equal(placed.lineWidth, anchor.lineWidth);
  assert.equal(placed.indicatorShown, true);
  assert.equal(placed.labelShown, true);
  const unfeatured = createWorldContextPlanner(plan)(input).projectedBodies.find(body => body.index === star);
  assert.equal((unfeatured?.markerOpacity ?? 0), 0, 'a star that is not featured gives its place to the catalogue dots');
});

test('each planetary system fades with the camera distance from its own star', () => {
  const fade = createSystemFade(plan);
  const index = (id: string) => [plan.focus, ...plan.bodies].findIndex(point => point.id === id);
  const wasp = plan.bodies.find(body => body.id === 'wasp-43')!;
  assert.equal(fade.isSystemStar('sun'), true);
  assert.equal(fade.isSystemStar('wasp-43'), true);
  assert.equal(fade.isSystemStar('jupiter'), false);
  assert.equal(fade.isSystemStar('betelgeuse'), false);
  // Beside WASP-43, 87 pc from the Sun: its planet's orbit shows while the Solar System has retired.
  assert.equal(fade.update([wasp.positionM[0], wasp.positionM[1], wasp.positionM[2] + 1e11]), 1);
  assert.equal(fade.of(index('wasp-43b')), 1);
  assert.equal(fade.of(index('earth')), 0);
  assert.equal(fade.of(index('moon')), 0);
  assert.equal(fade.of(index('betelgeuse')), 1, 'a star outside every system is never faded');
  assert.equal(fade.update([0, 0, 1e11]), 1);
  assert.equal(fade.of(index('earth')), 1);
  assert.equal(fade.of(index('wasp-43b')), 0);
  assert.equal(fade.update([0, 0, 1e18]), 0, 'between the stars every system has retired');
});

test('the Solar System begins revealing context as the distance readout hands from light-years to AU', () => {
  const lightYearM = 299792458 * 31557600;
  assert.equal(plan.system.hiddenDistanceM, lightYearM);
  const fade = createSystemFade(plan);
  assert.equal(fade.update([0, 0, lightYearM]), 0);
  assert.ok(fade.update([0, 0, lightYearM / 2]) > 0);
});

test('inside its authored range a system draws every member orbit, named or not, and retires beyond it', () => {
  const recorded = plan.bodies.filter(body => body.unpackaged === true);
  { const values = recorded.map(body => body.id); assert.ok(['s29', 's301', 's1'].every(item => values.includes(item))); }
  // The application gives a recorded body the tier of a planet of its host's system.
  const calculate = createWorldContextPlanner(plan, Object.fromEntries(recorded.map(body => [body.id, labelImportance('planet')]))), input = view();
  const host = plan.bodies.find(body => body.id === 'sgr-a-star')!;
  assert.ok((host.orbitsWithinM ?? 0) > 0);
  const members = recorded.filter(body => body.orbit?.centerBodyId === host.id).map(body => [plan.focus, ...plan.bodies].indexOf(body));
  input.overview = false; input.selectedId = host.id;
  const at = (rangeShare: number) => {
    // Above the black hole, looking down -z at it, at a share of the authored range.
    input.world.pose.positionM = [host.positionM[0], host.positionM[1], host.positionM[2] + host.orbitsWithinM! * rangeShare];
    let packet = calculate(input);
    for (let frame = 0; frame < 4; frame++) {
      for (const body of packet.projectedBodies) input.bodies[body.index]!.labelShown = body.labelShown;
      packet = calculate(input);
    }
    return members.map(index => packet.projectedBodies.find(entry => entry.index === index)!);
  };
  // Captions collide in the crowded core; the paths do not follow them.
  const inside = at(.07);
  const framed = inside.filter(body => body.visible);
  assert.equal(framed.some(body => !body.labelShown), true, 'some framed captions lose the collision');
  for (const body of framed) assert.ok(body.orbitVisibility > 0, plan.bodies[body.index - 1]!.id);
  for (const body of at(2.5)) assert.equal(body.orbitVisibility, 0, plan.bodies[body.index - 1]!.id);
});

/** The summary with every system's file read, as Node reads it (site/world-context-plan.mts). */
const readWholeSummary = (prepared: URL) => readFile(new URL('world-context-summary.json', prepared), 'utf8').then(text => parseCompleteWorldContext(JSON.parse(text),
  async id => JSON.parse(await readFile(new URL(`world-systems/${id}.json`, prepared), 'utf8'))));

test('the planner plans from the summary alone, names the paths it lacked, and draws them once their bank arrives', async () => {
  const prepared = new URL('../../../../../src/objects/sun/prepared/', import.meta.url);
  const summary = await readWholeSummary(prepared);
  const bank = async (id: string) => unpackPreparedBinary(await readFile(new URL(`world-orbits/${id}.bin`, prepared)), `world-orbits/${id}.bin`);
  const planner = createWorldContextPlanner(summary), current = view();
  const before = planner(current), wanted = planner.takeWantedOrbits();
  // From 20 au over the Sun the planets' orbits would be drawn; without their banks none is, and each is named once.
  assert.ok(wanted.includes('earth'));
  assert.equal(before.projectedBodies.every(body => body.segments.length === 0), true);
  assert.deepEqual(planner.takeWantedOrbits(), []);
  // Each wanted path is its own bank; the frame requested exactly the paths it would draw.
  for (const id of wanted) planner.attachOrbits(decodeWorldOrbitBank(summary, id, await bank(id)));
  const after = planner(current), full = createWorldContextPlanner(plan)(view());
  // With the bank attached, the Sun's orbits draw as the planner given every full-precision path draws them: the Int32
  // vertices move no projected point by a thousandth of a pixel.
  const earth = (frame: typeof after) => frame.projectedBodies.find(body => [plan.focus, ...plan.bodies][body.index]!.id === 'earth')!.segments;
  assert.ok(earth(after).length > 0);
  assert.equal(earth(after).length, earth(full).length);
  const numbers = (value: unknown): number[] => typeof value === 'number' ? [value] : Array.isArray(value) ? value.flatMap(numbers)
    : value && typeof value === 'object' ? Object.values(value).flatMap(numbers) : [];
  const drawn = numbers(earth(after)), exact = numbers(earth(full));
  assert.equal(drawn.length, exact.length);
  drawn.forEach((value, index) => assert.ok(Math.abs(value - exact[index]!) < 1e-3));
});

test('host detail defers satellite paths until each planetary system is opened', async () => {
  const prepared = new URL('../../../../../src/objects/sun/prepared/', import.meta.url);
  const summary = await readWholeSummary(prepared);
  for (const [hostId, satelliteId] of [['earth', 'moon'], ['jupiter', 'europa'], ['saturn', 'titan']]) {
    const host = summary.bodies.find(body => body.id === hostId)!;
    const planner = createWorldContextPlanner(summary), current = view();
    current.selectedId = hostId; current.overview = false;
    current.viewport = { focalPixels: 900, widthPixels: 820, heightPixels: 1094, principalOffsetPixels: [0, 0] };
    current.world.pose.positionM = [host.positionM[0], host.positionM[1], host.positionM[2] + Math.max(host.radiusM * 6, 4e7)];
    planner(current);
    assert.ok(!planner.takeWantedOrbits().includes(satelliteId), `${hostId} detail`);
    current.overview = true;
    current.world.pose.positionM = [host.positionM[0], host.positionM[1], host.positionM[2] + 5e9];
    planner(current);
    assert.ok(planner.takeWantedOrbits().includes(satelliteId), `${hostId} system`);
  }
});

test('a minor path that cannot show is never requested; highlighting it requests its bank', async () => {
  const prepared = new URL('../../../../../src/objects/sun/prepared/', import.meta.url);
  const summary = await readWholeSummary(prepared);
  const points = [summary.focus, ...summary.bodies], dots = new Set(summary.bodies.filter(body => body.plainDot).map(body => body.id));
  assert.ok(dots.size > 0);
  // Asteroids have no caption tier of their own (tier 0); the app hides a plain dot's caption.
  const priorities = Object.fromEntries([...dots].map(id => [id, 0]));
  const planner = createWorldContextPlanner(summary, priorities), current = view();
  current.bodies.forEach((body, index) => { body.labelHidden = dots.has(points[index]!.id); });
  planner(current);
  const wanted = planner.takeWantedOrbits();
  assert.ok(wanted.includes('earth'));
  assert.deepEqual(wanted.filter(id => dots.has(id)), []);
  // Highlighting the asteroids names them, so their paths can show and their banks are read.
  current.bodies.forEach((body, index) => { body.highlighted = dots.has(points[index]!.id); });
  planner(current);
  assert.equal(planner.takeWantedOrbits().some(id => dots.has(id)), true);
});

test('destination orbit fading completes during approach, before the detail selection changes', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  const target = plan.bodies.find(body => body.id === 'lutetia')!;
  input.selectedId = 'earth'; input.selectionPreview = target.id;
  input.overview = false; input.navigationInFlight = true;
  const sample = (share: number) => {
    const diameter = share * input.viewport.heightPixels!;
    input.world.pose.positionM = [target.positionM[0], target.positionM[1], target.positionM[2] +
      Math.hypot(target.radiusM, 2 * input.viewport.focalPixels * target.radiusM / diameter)];
    return structuredClone(calculate(input).projectedBodies.map(body => ({ index: body.index,
      opacity: body.orbitVisibility, segments: body.segments })));
  };
  const wide = sample(.1), nearing = sample(.2), arrived = sample(.35);
  const fading = wide.filter(body => body.opacity > 0 && body.segments.length > 0);
  assert.ok(fading.length > 0);
  assert.equal(nearing.some(body => body.opacity > 0 && body.opacity < wide.find(before => before.index === body.index)!.opacity), true);
  assert.equal(arrived.every(body => body.opacity === 0), true);
  input.selectedId = target.id; input.selectionPreview = undefined; input.navigationInFlight = false;
  assert.deepEqual(sample(.35), arrived);
});

// The app's own tiers from each body's classification, and the app's naming rule: of the stars beyond the Sun only one is named.
async function namedAlphaCentauri() {
  const kinds = new Map(plan.bodies.map(body => [body.id, body.classification]));
  const points = [plan.focus, ...plan.bodies];
  const priorities = Object.fromEntries(points.map(body => [body.id, labelImportance(kinds.get(body.id) ?? 'star')]));
  const input = view();
  for (const [index, body] of points.entries()) input.bodies[index]!.labelHidden = kinds.get(body.id) === 'star' && body.id !== 'alpha-centauri-a' && body.id !== plan.focus.id;
  return { calculate: createWorldContextPlanner(plan, priorities), input, index: points.findIndex(body => body.id === 'alpha-centauri-a') };
}

test('a notable star beyond the Solar System is named before the Solar System comets once the label cap is full', async () => {
  const { calculate, input, index } = await namedAlphaCentauri();
  const frame = calculate(input), star = frame.projectedBodies.find(body => body.index === index)!;
  assert.equal(frame.projectedBodies.filter(body => body.labelShown).length, 24, 'the cap is full');
  assert.equal(star.labelShown, true, 'Alpha Centauri A outranks the comets that filled the cap');
});

test('past the Local Group scale the stars give their names to the galaxies', async () => {
  const { calculate, input } = await namedAlphaCentauri();
  const labelled = (parsecs: number) => {
    input.world.pose.positionM = [0, 0, parsecs * 3.085677581491367e16];
    return calculate(input).projectedBodies.filter(body => body.labelShown).map(body => [plan.focus, ...plan.bodies][body.index]!);
  };
  const named = (parsecs: number) => labelled(parsecs).filter(body => !('classification' in body && isExtendedClassification(body.classification))).map(body => body.id);
  { const values = named(200e3); assert.ok(['sun', 'sgr-a-star'].every(item => values.includes(item)), 'from 200 kpc, short of the Local Group scale, the Sun and Sgr A* keep their names'); }
  assert.deepEqual(named(1e6), [], 'from 1 Mpc no star or planet is named');
  { const values = labelled(1e6).map(body => body.id); assert.ok(['lmc', 'smc'].every(item => values.includes(item)), 'from 1 Mpc the galaxies are'); }
});

test('past the Solar System only the featured stars and the references keep a dot; past the Local Group no body does', () => {
  const featured = 'betelgeuse';
  assert.equal(plan.bodies.some(body => body.id === featured && !body.orbit), true);
  const calculate = createWorldContextPlanner(plan, { [featured]: FEATURED_STAR_TIER }), input = view();
  const dotted = (parsecs: number) => {
    input.world.pose.positionM = [0, 0, parsecs * 3.085677581491367e16];
    // The galaxies, clusters and nebulae are bodies too, and keep their own dots: this is about the stars and their planets.
    return calculate(input).projectedBodies.filter(body => body.markerOpacity > 0).map(body => [plan.focus, ...plan.bodies][body.index]!)
      .filter(body => !('classification' in body && isExtendedClassification(body.classification))).map(body => body.id);
  };
  const nearby = dotted(3e3);
  { const values = nearby; assert.ok(['sun', featured].every(item => values.includes(item)), 'from 3 kpc above the Sun the Sun and the featured star stay (Sgr A* is out of frame)'); }
  assert.ok(nearby.length < 10, 'from 3 kpc the other stars have given way');
  { const values = dotted(200e3); assert.ok(['sgr-a-star', 'sun'].every(item => values.includes(item)), 'from 200 kpc the references keep a dot'); }
  assert.deepEqual(dotted(1e6), [], 'from 1 Mpc, in the overview, no star or planet keeps a dot');
});

test('a body beyond the Local Group keeps its dot at the scale of its cluster, and loses it from the Milky Way', () => {
  const far = plan.bodies.find(body => body.id === 'm87-star')!, calculate = createWorldContextPlanner(plan), input = view();
  const dotted = (parsecs: number) => {
    // Looking down -z at M87*, from `parsecs` above it.
    input.world.pose.positionM = [far.positionM[0], far.positionM[1], far.positionM[2] + parsecs * 3.085677581491367e16];
    return calculate(input).projectedBodies.some(body => [plan.focus, ...plan.bodies][body.index]!.id === far.id && body.markerOpacity > 0);
  };
  assert.equal(dotted(3e6), true, 'from 3 Mpc, framing the Virgo Cluster, M87* keeps a dot');
  assert.equal(dotted(12e6), false, 'past 10 Mpc it has gone, as from the Milky Way');
});

test('the moons of a framed planet keep their names before stars beyond the Solar System', async () => {
  const kinds = new Map(plan.bodies.map(body => [body.id, body.classification]));
  const points = [plan.focus, ...plan.bodies], jupiter = plan.bodies.find(body => body.id === 'jupiter')!;
  // Plain tiers: a moon ranks with the comets (1) and every star is named (3), so the 24-label cap is contested.
  const calculate = createWorldContextPlanner(plan, Object.fromEntries(points.map(body => [body.id, labelImportance(kinds.get(body.id) ?? 'star')])));
  const input = view();
  input.viewport = { ...input.viewport, widthPixels: 900, heightPixels: 900, principalOffsetPixels: [0, 0] };
  input.selectedId = 'jupiter';
  // Looking past Jupiter toward the Kepler field (RA 290.7°, Dec +44.5°), where dozens of catalogued giants sit behind its moons.
  const ra = 290.7 * Math.PI / 180, dec = 44.5 * Math.PI / 180, toward = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
  // The rotation that turns the camera's forward axis (-z) onto that direction.
  const axis = [toward[1]!, -toward[0]!, 0], w = 1 - toward[2]!, norm = Math.hypot(...axis, w);
  input.world = { ...input.world, pose: { orientationXyzw: [axis[0]! / norm, axis[1]! / norm, axis[2]! / norm, w / norm],
    positionM: [0, 1, 2].map(index => jupiter.positionM[index]! - toward[index]! * .08 * 149597870700) as [number, number, number] } };
  const named = new Set(calculate(input).projectedBodies.filter(body => body.labelShown).map(body => points[body.index]!.id));
  for (const moon of ['io', 'europa', 'ganymede', 'callisto']) assert.equal(named.has(moon), true, `${moon} is named`);
});
