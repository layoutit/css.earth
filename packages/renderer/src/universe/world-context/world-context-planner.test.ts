import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';
import { decodeWorldOrbitBank, parsePreparedWorldContext, parsePreparedWorldContextSummary } from '../../prepared-data/world-context.js';
import { createSystemFade } from './context-scale.js';
import { createWorldContextPlanner } from './world-context-planner.js';
import type { WorldContextView } from './world-context-planner.js';
import { packWorldBodies, unpackWorldBodies } from './world-context-view-transport.js';
import { createContextSelectionPolicy } from '../context-presentation-policy.js';
import { labelImportance } from '../../labels/universe-label-policy.js';

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
  expect(publish()).toEqual(settled);
  expect(settled.length).toBeGreaterThan(0);
  current.labelBlockers = [{ left: -10000, top: -10000, right: 10000, bottom: 10000 }];
  expect(publish()).toEqual(settled);
});

test('viewport edges constrain captions without retiring an in-frame circle', () => {
  const current = view(), planner = createWorldContextPlanner(plan);
  const initial = planner(current);
  const targetIndex = [plan.focus, ...plan.bodies].findIndex(body => body.id === 'earth');
  const target = initial.projectedBodies.find(body => body.index === targetIndex)!;
  expect(target.labelShown).toBe(true);
  expect(target.indicatorShown).toBe(true);
  const targetX = target.x;
  for (const body of initial.projectedBodies) Object.assign(current.bodies[body.index], {
    labelShown: body.labelShown, labelPlacement: body.labelPlacement, indicatorShown: body.indicatorShown,
  });
  current.bodies.forEach((body, index) => { body.labelHidden = index !== targetIndex; });
  const width = current.viewport.widthPixels!, [offsetX, offsetY] = current.viewport.principalOffsetPixels!;
  const shifted = { ...current, viewport: { ...current.viewport,
    principalOffsetPixels: [offsetX + width / 2 - 1 - targetX, offsetY] as const } };
  const edge = planner(shifted).projectedBodies.find(body => body.index === targetIndex)!;
  expect(edge.visible).toBe(true);
  expect(edge.labelShown).toBe(true);
  expect(edge.indicatorShown).toBe(true);
  const label = current.bodies[targetIndex]!.labelSize;
  expect(edge.labelPosition![0]).toBeGreaterThanOrEqual(-width / 2 + 4);
  expect(edge.labelPosition![0] + label.width).toBeLessThanOrEqual(width / 2 - 4);
});

test('complete context frames cross a structured-clone boundary without mutating the input owner', () => {
  const calculate = createWorldContextPlanner(freeze(plan));
  const input = freeze(view());
  const savedInput = structuredClone(input);
  const first = structuredClone(calculate(input));
  const savedFirst = structuredClone(first);
  expect(first.projectedBodies.some(body => body.segments.length > 0)).toBe(true);
  for (const distance of [5, 50, 5000, 20]) {
    const next = structuredClone(input);
    Object.assign(next.world.pose, { positionM: [next.world.pose.positionM[0], next.world.pose.positionM[1], distance * 149597870700] });
    next.selectedId = 'saturn'; next.overview = false;
    next.bodies[0].hovered = true;
    const packet = structuredClone(calculate(freeze(next)));
    expect(packet.emphasizedId).toBe('saturn');
    for (const body of packet.projectedBodies) {
      expect(body).not.toHaveProperty('transforms');
      expect(body.segments.every(segment => segment.length === 5 && segment.every(Number.isFinite))).toBe(true);
    }
  }
  expect(input).toEqual(savedInput);
  expect(first).toEqual(savedFirst);
  // Replaying the same committed inputs is independent of requests that ran
  // in between: rejected/superseded frames cannot own decluttering history.
  expect(structuredClone(calculate(input))).toEqual(first);
});

test('retired and incompatible frame requests respect prepared identity and measured optics', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  input.anchorOnly = true;
  // The anchor and every placed orbitless body (Betelgeuse) remain as galactic locators.
  const locators = [plan.focus, ...plan.bodies].flatMap((body, index) => index === 0 || !('orbit' in body && body.orbit) ? [index] : []);
  expect(locators.length).toBeGreaterThan(1);
  expect(calculate(input).projectedBodies.map(body => body.index)).toEqual(locators);
  expect(() => calculate({ ...input, selectedId: 'missing' })).toThrow('unavailable');
  expect(() => calculate({ ...input, bodies: [] })).toThrow('matching frame');
  expect(() => calculate({ ...input, viewport: { ...input.viewport, widthPixels: undefined } })).toThrow('measured viewport');
  expect(() => calculate({ ...input, world: { ...input.world, epochJdTt: input.world.epochJdTt + 1 } })).toThrow('matching frame');
});

test('overview uses its prepared billboard even when the retained surface is large', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  input.world.pose.positionM = [0, 0, plan.focus.radiusM * 20];
  const marker = (overview: boolean) => calculate({ ...input, overview }).projectedBodies.find(body => body.index === 0)!;
  expect(marker(true).markerOpacity).toBe(1);
  expect(marker(false).markerOpacity).toBe(0);
});

test('a departed focus outside the view cannot blank the surrounding orbit field', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  input.overview = false; input.navigationInFlight = true; input.selectionPreview = 'arrokoth';
  for (const z of [0, -149597870700, 149597870]) {
    input.world.pose.positionM = [20 * 149597870700, 0, z];
    const packet = calculate(input);
    expect(packet.projectedBodies.some(body => body.orbitVisibility > 0 && body.segments.length > 0),
      `orbit field remains visible while the departed Sun crosses the eye plane at ${z}`).toBe(true);
  }
  // Preserve the close-up fade when the selected disc really fills the view:
  // context lines soften to the shared close-detail floor.
  input.world.pose.positionM = [0, 0, plan.focus.radiusM * 5];
  expect(Math.max(...calculate(input).projectedBodies.map(body => body.orbitVisibility))).toBeLessThanOrEqual(.3);
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
  expect(sample(16).labelShown).toBe(true);
  expect(sample(17.06).labelShown).toBe(false);
  for (const diameter of [16.94, 17.06, 16.94, 17.06]) expect(sample(diameter).labelShown).toBe(false);
  expect(sample(16.64).labelShown).toBe(true);
  expect(sample(16.94).labelShown).toBe(true);
  // Ring eligibility uses the same committed-state rule at the 8px boundary.
  expect(sample(7.7).indicatorShown).toBe(true);
  expect(sample(8.01).indicatorShown).toBe(false);
  for (const diameter of [7.99, 8.01, 7.99]) expect(sample(diameter).indicatorShown).toBe(false);
  expect(sample(7.7).indicatorShown).toBe(true);
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
    expect(body.labelShown, `${diameter}px destination must remain named`).toBe(true);
    expect(body.labelPlacement).toBe(0);
    expect(body.indicatorShown, `${diameter}px circle follows the preview handoff`).toBe(diameter < 20);
    if (diameter >= 20) expect(body.markerOpacity).toBe(0);
    Object.assign(input.bodies[index], { labelShown: body.labelShown, labelPlacement: body.labelPlacement,
      indicatorShown: body.indicatorShown });
  }
  input.navigationInFlight = false; input.overview = false; input.selectedId = target.id;
  expect(calculate(input).projectedBodies.find(body => body.index === index)!.labelShown).toBe(false);
  }
});

test.each(['luhman-16', 'mercury'])('selected %s keeps its locator when the separate selected caption owns its name', id => {
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
  expect(point.visible).toBe(true);
  expect(point.indicatorShown).toBe(true);
  expect(point.labelShown).toBe(false);
  expect(point.labelPosition).toBeUndefined();
  // Resolved detail owns the surface; the small locator must not sit over it.
  expect(sample(100).indicatorShown).toBe(false);
  expect(sample(.1).indicatorShown).toBe(true);
  input.selectionPreview = plan.focus.id;
  expect(sample(.1).indicatorShown).toBe(false);
  input.selectionPreview = undefined;
  input.bodies[index].labelSuppressed = false;
  const ordinary = sample(.1);
  expect(ordinary.indicatorShown).toBe(true);
  expect(ordinary.labelShown).toBe(true);
});

test('orbit settings do not change admitted names or label placement', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  const labels = () => calculate(input).projectedBodies.filter(body => body.labelShown)
    .map(body => ({ index: body.index, position: body.labelPosition }));
  const before = structuredClone(labels());
  expect(before.length).toBeGreaterThan(0);
  input.bodies.forEach(body => { body.orbitHidden = true; });
  expect(labels()).toEqual(before);
});

test('hidden planetary annotations remove labels, circles and their orbit paths', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  const points = [plan.focus, ...plan.bodies];
  const planets = new Set(['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune']);
  input.world.pose.positionM = [0, 0, 40 * 149597870700];
  input.bodies.forEach((body, index) => { body.labelHidden = planets.has(points[index]!.id); });
  const bodies = calculate(input).projectedBodies;
  const outer = bodies.filter(body => ['jupiter', 'saturn', 'uranus', 'neptune'].includes(points[body.index]!.id));
  expect(outer.every(body => !body.labelShown && !body.indicatorShown)).toBe(true);
  const onScreen = outer.filter(body => body.visible);
  expect(onScreen.length).toBeGreaterThan(0);
  expect(onScreen.every(body => body.orbitVisibility === 0 && body.segments.length === 0)).toBe(true);
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
    expect(admitted.length).toBeGreaterThan(0);
    for (const body of admitted) {
      expect(body.indicatorShown).toBe(true);
      expect(body.markerOpacity).toBeGreaterThan(.5);
      expect(body.segments).toHaveLength(0);
    }
  }
  input.bodies.forEach(body => { body.highlighted = false; });
  expect(calculate({ ...input, bodies: unpackWorldBodies(packWorldBodies(input.bodies)) })
    .projectedBodies.filter(body => moons.has(bodies[body.index].id) && body.labelShown)).toHaveLength(0);
});

test('system zoom and rotation never publish a context circle without its caption', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  let paths = 0, crowded = 0;
  for (const distance of [20, 75, 205, 75, 20]) for (const angle of [0, .3, .7, .3, 0]) {
    input.world.pose.positionM = [0, 0, distance * 149597870700];
    Object.assign(input.world.pose, { orientationXyzw: [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)] });
    const frame = calculate(input);
    for (const body of frame.projectedBodies) {
      if (body.indicatorShown) expect(body.labelShown).toBe(true);
      if (body.segments.length && body.visible) expect(body.labelShown).toBe(true);
      if (body.segments.length && body.visible && body.labelShown) paths++;
      if (!body.labelShown && body.visible) crowded++;
      Object.assign(input.bodies[body.index], { labelShown: body.labelShown, labelPlacement: body.labelPlacement,
        indicatorShown: body.indicatorShown });
    }
  }
  expect(paths).toBeGreaterThan(0);
  expect(crowded).toBeGreaterThan(0);
});

test('a body too faint for this camera to name draws no ring beside the named ones', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  const points = [plan.focus, ...plan.bodies], index = points.findIndex(body => body.id === 'ceres');
  input.world.pose.positionM = [0, 0, 205 * 149597870700];
  const far = calculate(input).projectedBodies.find(body => body.index === index)!;
  expect(far.visible, 'Ceres is on screen at whole-system range').toBe(true);
  expect(far.labelShown).toBe(false);
  expect(far.indicatorShown).toBe(false);
  expect(far.segments, 'an unnamed body on screen draws no path').toHaveLength(0);
  input.world.pose.positionM = [0, 0, 8 * 149597870700];
  const near = calculate(input).projectedBodies.find(body => body.index === index)!;
  expect(near.labelShown, 'the same body is named once the camera resolves it').toBe(true);
  expect(near.segments.length).toBeGreaterThan(0);
});

test('turning the view identifies on-screen orbits and preserves paths crossing from off screen', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  const points = [plan.focus, ...plan.bodies];
  const captions = new Map<string, boolean>();
  let captionFlips = 0, paths = 0, offScreenPaths = 0;
  // A drag tumbles the camera around the focus. Bodies cross the viewport edge and lose
  // their annotations; paths may remain only after the body itself leaves the frame.
  for (let step = 0; step < 90; step++) {
    const angle = step * .5 * Math.PI / 180, distance = 8 * 149597870700;
    Object.assign(input.world.pose, { orientationXyzw: [Math.sin(angle / 2), 0, 0, Math.cos(angle / 2)] });
    input.world.pose.positionM = [0, -distance * Math.sin(angle), distance * Math.cos(angle)];
    for (const body of calculate(input).projectedBodies) {
      const id = points[body.index]!.id;
      if (captions.get(id) !== undefined && captions.get(id) !== body.labelShown) captionFlips++;
      if (body.segments.length) {
        paths++;
        if (body.visible) expect(body.labelShown, `${id}'s on-screen path must retain its annotation`).toBe(true);
        else if (!body.labelShown) offScreenPaths++;
      }
      captions.set(id, body.labelShown);
      Object.assign(input.bodies[body.index]!, { labelShown: body.labelShown, labelPlacement: body.labelPlacement,
        indicatorShown: body.indicatorShown });
    }
  }
  expect(captionFlips, 'captions come and go as their bodies cross the edge').toBeGreaterThan(0);
  expect(paths, 'admitted bodies still draw their paths').toBeGreaterThan(0);
  expect(offScreenPaths, 'paths keep crossing after their bodies leave the frame').toBeGreaterThan(0);
});

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
  expect([...committed.values()].some(Boolean)).toBe(true);
  input.rotationActive = true;
  for (let step = -12; step <= 12; step++) {
    const angle = step * Math.PI / 180;
    Object.assign(input.world.pose, { orientationXyzw: [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)] });
    const frame = calculate(input);
    for (const body of frame.projectedBodies) {
      const id = points[body.index]!.id;
      if (tracked.has(id)) expect(body.labelShown, `${id} keeps its drag-start admission`).toBe(committed.get(id));
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
    expect(body.labelShown, `${id} keeps its final inertial admission on settlement`).toBe(committed.get(id));
    if (body.labelShown) expect(body.labelPlacement).toBe(input.bodies[body.index]!.labelPlacement);
  }
});

test('major planets remain identified through a full active-drag rotation', () => {
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
      expect(body.labelShown, `${id} stays named at rotation step ${step}`).toBe(true);
      expect(body.indicatorShown, `${id} keeps its circle at rotation step ${step}`).toBe(true);
    }
    for (const body of frame.projectedBodies) {
      Object.assign(input.bodies[body.index], { labelShown: body.labelShown, labelPlacement: body.labelPlacement,
        indicatorShown: body.indicatorShown });
    }
  }
});

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
      expect(body.labelShown).toBe(false);
      expect(body.orbitVisibility, 'an off-screen ring keeps its own fade').toBeGreaterThan(0);
      Object.assign(input.bodies[body.index], { labelShown: body.labelShown, labelPlacement: body.labelPlacement,
        indicatorShown: body.indicatorShown });
    }
  }
  expect(offScreenPaths, 'rings stay while their bodies leave the frame').toBeGreaterThan(0);
});

test('Earth priority keeps its ordinary scale fade and leaves the Sun at outer-space distance', () => {
  const input = view(), points = [plan.focus, ...plan.bodies];
  input.bodies.forEach((body, index) => { body.bodyHidden = !['sun', 'earth'].includes(points[index].id); });
  const calculate = createWorldContextPlanner(plan, {
    sun: labelImportance('star', true, 5), earth: labelImportance('planet', true, 4),
  });
  input.world.pose.positionM = [0, 0, 5 * 149597870700];
  expect(calculate(input).projectedBodies.filter(body => body.labelShown).map(body => points[body.index].id)).toContain('earth');
  input.world.pose.positionM = [0, 0, plan.system.hiddenDistanceM * 2];
  expect(calculate(input).projectedBodies.filter(body => body.labelShown).map(body => points[body.index].id)).toEqual(['sun']);
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
    expect(earth.labelShown).toBe(true);
    expect(earth.indicatorShown).toBe(true);
    expect(earth.segments).toHaveLength(0);
  }
  for (const distanceAu of [233.27, plan.system.fadeOutStartDistanceM / 149597870700]) {
    input.world.pose.positionM = [0, 0, distanceAu * 149597870700];
    const frame = calculate(input), earth = frame.projectedBodies.find(body => points[body.index].id === 'earth')!;
    expect(earth.labelShown).toBe(true);
    expect(earth.indicatorShown).toBe(false);
    expect(earth.segments).toHaveLength(0);
    if (distanceAu === 233.27) {
      Object.assign(input.bodies[earth.index], {
        labelShown: earth.labelShown,
        labelPlacement: earth.labelPlacement,
        indicatorShown: earth.indicatorShown,
        hovered: true,
      });
      const hovered = calculate(input).projectedBodies.find(body => body.index === earth.index)!;
      expect(hovered.labelShown).toBe(true);
      expect(hovered.indicatorShown).toBe(false);
      expect(hovered.segments).toHaveLength(0);
      expect(hovered.labelPosition).toEqual(earth.labelPosition);
      input.bodies[earth.index]!.hovered = false;
    }
  }
  input.world.pose.positionM = [0, 0, plan.system.hiddenDistanceM * 2];
  const beyond = calculate(input).projectedBodies.find(body => points[body.index].id === 'earth')!;
  expect(beyond.labelShown).toBe(false);
  expect(beyond.indicatorShown).toBe(false);
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
  expect(sun.labelShown).toBe(true);
  expect(sun.indicatorShown).toBe(true);
  expect(earth.labelShown).toBe(true);
  expect(sun.labelPosition![1]).toBeLessThan(earth.labelPosition![1]);
});

test.each(['ryugu', 'bennu'])('%s remains identifiable when its category is hidden, then retires on deselection', id => {
  const calculate = createWorldContextPlanner(plan), input = view();
  const points = [plan.focus, ...plan.bodies], index = points.findIndex(body => body.id === id);
  const selected = points[index]!;
  input.selectedId = id; input.overview = false;
  input.world.pose.positionM = [selected.positionM[0], selected.positionM[1], selected.positionM[2] + 3.8e10];
  // The shell leaves the selected asteroid's orbit enabled. Hidden bodies,
  // circles and captions still carry the user's category preferences.
  input.bodies.forEach(body => Object.assign(body, { bodyHidden: true, indicatorHidden: true, labelHidden: true }));
  const shown = calculate(input).projectedBodies.find(body => body.index === index)!;
  expect(shown.visible).toBe(true);
  expect(shown.indicatorShown).toBe(true);
  expect(shown.labelShown).toBe(true);
  expect(shown.orbitVisibility).toBeGreaterThan(0);
  expect(shown.segments.length).toBeGreaterThan(0);
  expect(calculate(input).projectedBodies.filter(body => body.visible)).toHaveLength(1);
  input.selectedId = plan.focus.id; input.overview = true;
  const hidden = calculate(input).projectedBodies.find(body => body.index === index)!;
  expect(hidden.visible).toBe(false);
  expect(hidden.indicatorShown).toBe(false);
  expect(hidden.labelShown).toBe(false);
  expect(hidden.segments).toHaveLength(0);
});

test('planet views label their own moon family, with a bounded total', () => {
  const points = [plan.focus, ...plan.bodies];
  const calculate = createWorldContextPlanner(plan), input = view();
  const saturn = points.find(body => body.id === 'saturn')!;
  input.selectedId = 'saturn'; input.overview = false;
  input.world.pose.positionM = [saturn.positionM[0], saturn.positionM[1], saturn.positionM[2] + 4e10];
  const names = calculate(input).projectedBodies.filter(body => body.labelShown).map(body => points[body.index]!);
  expect(names.length).toBeLessThanOrEqual(24);
  expect(names.some(body => body.id === 'saturn')).toBe(true);
  expect(names.filter(body => 'orbit' in body && body.orbit && body.orbit.centerBodyId !== plan.focus.id)
    .every(body => 'orbit' in body && body.orbit?.centerBodyId === 'saturn')).toBe(true);
});

test.each(['ryugu', 'saturn'])('%s selection dimming relaxes at system scale, independently of camera angle', id => {
  const policy = createContextSelectionPolicy(plan), selected = plan.bodies.find(body => body.id === id)!;
  const scale = selected.orbit!.lod!.bounds.radiusM;
  for (const axis of [0, 1, 2]) {
    const values = [.25, .5, 1, 2, 4].map(factor => {
      const position: [number, number, number] = [...selected.positionM];
      position[axis] += scale * factor;
      const strength = policy.strengthAt(id, position);
      expect(policy.opacity(id, id, false, strength)).toBe(1);
      expect(policy.opacity('earth', id, true, strength)).toBe(1);
      if (id === 'saturn') {
        expect(policy.strengthAt('titan', position)).toBe(strength);
        expect(policy.opacity('titan', id, false, strength)).toBe(1);
      }
      return policy.opacity('earth', id, false, strength);
    });
    expect(values).toEqual([.25, .25, .625, 1, 1]);
  }
});

test.each(['saturn', 'jupiter', 'uranus'])('%s: close detail retires its own and unrelated solar orbits', id => {
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
      expect(own.segments.length, `${discHeightShare} viewport height`).toBeGreaterThan(0);
      expect(own.orbitVisibility).toBeGreaterThan(0);
      expect(own.segments.every(segment => segment.every(Number.isFinite))).toBe(true);
    } else expect(own.orbitVisibility, `${discHeightShare} viewport height`).toBe(0);
    // Other planets' paths are irrelevant at close detail. The selected planet's nearby moons retain their own policy.
    const otherSolarOrbits = frame.projectedBodies.filter(body => {
      const point = points[body.index]!;
      return body.index !== index && 'orbit' in point && point.orbit?.centerBodyId === plan.focus.id;
    });
    if (discHeightShare >= .3) expect(otherSolarOrbits.every(body => body.orbitVisibility === 0)).toBe(true);
  }
  input.bodies[index]!.orbitHidden = true;
  expect(calculate(input).projectedBodies.find(body => body.index === index)!.orbitVisibility).toBe(0);
});

test('a placed orbitless body keeps its marker beyond the system fade, like the anchor', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  const star = plan.bodies.findIndex(body => !body.orbit) + 1;
  expect(star).toBeGreaterThan(0);
  // 300 pc above the Sun-Betelgeuse midpoint, looking down -z: both locators are in frame and the
  // system fade has run its course (opacity 0), so only locators publish.
  const placedM = plan.bodies[star - 1]!.positionM;
  // Only the anchor and the placed body compete for captions: the catalogue's other stars would otherwise spend the shared
  // label limit, and which of them are in frame here depends on how many stars the catalogue holds, not on this behaviour.
  input.bodies.forEach((body, index) => { body.labelHidden = index !== 0 && index !== star; });
  input.anchorOnly = true; input.world.pose.positionM = [placedM[0] / 2, placedM[1] / 2, placedM[2] / 2 + 300 * 3.085677581491367e16];
  const packet = calculate(input);
  const anchor = packet.projectedBodies.find(body => body.index === 0)!, placed = packet.projectedBodies.find(body => body.index === star)!;
  expect(placed.markerOpacity).toBe(1);
  expect(placed.lineWidth).toBe(anchor.lineWidth);
  expect(placed.indicatorShown).toBe(true);
  expect(placed.labelShown).toBe(true);
});

test('each planetary system fades with the camera distance from its own star', () => {
  const fade = createSystemFade(plan);
  const index = (id: string) => [plan.focus, ...plan.bodies].findIndex(point => point.id === id);
  const wasp = plan.bodies.find(body => body.id === 'wasp-43')!;
  expect(fade.isSystemStar('sun')).toBe(true);
  expect(fade.isSystemStar('wasp-43')).toBe(true);
  expect(fade.isSystemStar('jupiter')).toBe(false);
  expect(fade.isSystemStar('betelgeuse')).toBe(false);
  // Beside WASP-43, 87 pc from the Sun: its planet's orbit shows while the Solar System has retired.
  expect(fade.update([wasp.positionM[0], wasp.positionM[1], wasp.positionM[2] + 1e11])).toBe(1);
  expect(fade.of(index('wasp-43b'))).toBe(1);
  expect(fade.of(index('earth'))).toBe(0);
  expect(fade.of(index('moon'))).toBe(0);
  expect(fade.of(index('betelgeuse')), 'a star outside every system is never faded').toBe(1);
  expect(fade.update([0, 0, 1e11])).toBe(1);
  expect(fade.of(index('earth'))).toBe(1);
  expect(fade.of(index('wasp-43b'))).toBe(0);
  expect(fade.update([0, 0, 1e18]), 'between the stars every system has retired').toBe(0);
});

test('the Solar System begins revealing context as the distance readout hands from light-years to AU', () => {
  const lightYearM = 299792458 * 31557600;
  expect(plan.system.hiddenDistanceM).toBe(lightYearM);
  const fade = createSystemFade(plan);
  expect(fade.update([0, 0, lightYearM])).toBe(0);
  expect(fade.update([0, 0, lightYearM / 2])).toBeGreaterThan(0);
});

test('inside its authored range a system draws every member orbit, named or not, and retires beyond it', () => {
  const recorded = plan.bodies.filter(body => body.unpackaged === true);
  expect(recorded.map(body => body.id)).toEqual(expect.arrayContaining(['s2', 's301', 's1']));
  // The application gives a recorded body the tier of a planet of its host's system.
  const calculate = createWorldContextPlanner(plan, Object.fromEntries(recorded.map(body => [body.id, labelImportance('planet')]))), input = view();
  const host = plan.bodies.find(body => body.id === 'sgr-a-star')!;
  expect(host.orbitsWithinM).toBeGreaterThan(0);
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
  expect(framed.some(body => !body.labelShown), 'some framed captions lose the collision').toBe(true);
  for (const body of framed) expect(body.orbitVisibility, plan.bodies[body.index - 1]!.id).toBeGreaterThan(0);
  for (const body of at(2.5)) expect(body.orbitVisibility, plan.bodies[body.index - 1]!.id).toBe(0);
});

test('the planner plans from the summary alone, names the paths it lacked, and draws them once their bank arrives', async () => {
  const prepared = new URL('../../../../../src/objects/sun/prepared/', import.meta.url);
  const summary = parsePreparedWorldContextSummary(JSON.parse(await readFile(new URL('world-context-summary.json', prepared), 'utf8')));
  const bank = async (id: string) => { const bytes = await readFile(new URL(`world-orbits/${id}.bin`, prepared)); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); };
  const planner = createWorldContextPlanner(summary), current = view();
  const before = planner(current), wanted = planner.takeWantedOrbits();
  // From 20 au over the Sun the planets' orbits would be drawn; without their banks none is, and each is named once.
  expect(wanted).toContain('earth');
  expect(before.projectedBodies.every(body => body.segments.length === 0)).toBe(true);
  expect(planner.takeWantedOrbits()).toEqual([]);
  // Each wanted path is its own bank; the frame requested exactly the paths it would draw.
  for (const id of wanted) planner.attachOrbits(decodeWorldOrbitBank(summary, id, await bank(id)));
  const after = planner(current), full = createWorldContextPlanner(plan)(view());
  // With the bank attached, the Sun's orbits draw as the planner given every full-precision path draws them: the Int32
  // vertices move no projected point by a thousandth of a pixel.
  const earth = (frame: typeof after) => frame.projectedBodies.find(body => [plan.focus, ...plan.bodies][body.index]!.id === 'earth')!.segments;
  expect(earth(after).length).toBeGreaterThan(0);
  expect(earth(after).length).toBe(earth(full).length);
  const numbers = (value: unknown): number[] => typeof value === 'number' ? [value] : Array.isArray(value) ? value.flatMap(numbers)
    : value && typeof value === 'object' ? Object.values(value).flatMap(numbers) : [];
  const drawn = numbers(earth(after)), exact = numbers(earth(full));
  expect(drawn.length).toBe(exact.length);
  drawn.forEach((value, index) => expect(Math.abs(value - exact[index]!)).toBeLessThan(1e-3));
});

test('a minor path that cannot show is never requested; highlighting it requests its bank', async () => {
  const prepared = new URL('../../../../../src/objects/sun/prepared/', import.meta.url);
  const summary = parsePreparedWorldContextSummary(JSON.parse(await readFile(new URL('world-context-summary.json', prepared), 'utf8')));
  const points = [summary.focus, ...summary.bodies], dots = new Set(summary.bodies.filter(body => body.plainDot).map(body => body.id));
  expect(dots.size).toBeGreaterThan(0);
  // Asteroids have no caption tier of their own (tier 0); the app hides a plain dot's caption.
  const priorities = Object.fromEntries([...dots].map(id => [id, 0]));
  const planner = createWorldContextPlanner(summary, priorities), current = view();
  current.bodies.forEach((body, index) => { body.labelHidden = dots.has(points[index]!.id); });
  planner(current);
  const wanted = planner.takeWantedOrbits();
  expect(wanted).toContain('earth');
  expect(wanted.filter(id => dots.has(id))).toEqual([]);
  // Highlighting the asteroids names them, so their paths can show and their banks are read.
  current.bodies.forEach((body, index) => { body.highlighted = dots.has(points[index]!.id); });
  planner(current);
  expect(planner.takeWantedOrbits().some(id => dots.has(id))).toBe(true);
});
