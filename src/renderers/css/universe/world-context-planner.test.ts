import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';
import { parsePreparedWorldContext } from './prepared-world-context.js';
import { createWorldContextPlanner } from './world-context-planner.js';
import type { WorldContextView } from './world-context-planner.js';
import { createContextSelectionPolicy } from './context-presentation-policy.js';

const plan = parsePreparedWorldContext(JSON.parse(await readFile(
  new URL('../../../objects/sun/prepared/world-context.json', import.meta.url), 'utf8')));
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
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

test('shell occlusion excludes admitted body labels and repeated committed frames keep their placements', () => {
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
  const first = settled[0], size = current.bodies[first.index].labelSize;
  const [x, y] = first.point;
  current.labelBlockers = [{ left: x - 2, top: y - 2, right: x + size.width + 2, bottom: y + size.height + 2 }];
  const next = publish();
  for (const label of next) {
    const [lx, ly] = label.point, labelSize = current.bodies[label.index].labelSize, blocked = current.labelBlockers[0];
    expect(lx < blocked.right && lx + labelSize.width > blocked.left && ly < blocked.bottom && ly + labelSize.height > blocked.top).toBe(false);
  }
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
  expect(calculate(input).projectedBodies.map(body => body.index)).toEqual([0]);
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

test('orbit settings do not change admitted names or label placement', () => {
  const calculate = createWorldContextPlanner(plan), input = view();
  const labels = () => calculate(input).projectedBodies.filter(body => body.labelShown)
    .map(body => ({ index: body.index, position: body.labelPosition }));
  const before = structuredClone(labels());
  expect(before.length).toBeGreaterThan(0);
  input.bodies.forEach(body => { body.orbitHidden = true; });
  expect(labels()).toEqual(before);
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

test.each(['saturn', 'jupiter', 'uranus'])('%s retains projected orbit paths past the close-detail fade threshold', id => {
  const calculate = createWorldContextPlanner(plan), input = view();
  const index = [plan.focus, ...plan.bodies].findIndex(body => body.id === id);
  const selected = plan.bodies[index - 1]!;
  input.selectedId = id; input.overview = false;
  for (const discHeightShare of [.1, .2, .3, .6]) {
    const distance = Math.hypot(selected.radiusM,
      2 * input.viewport.focalPixels * selected.radiusM / (1236 * discHeightShare));
    input.world.pose.positionM = [selected.positionM[0], selected.positionM[1], selected.positionM[2] + distance];
    const frame = calculate(input);
    const orbit = frame.projectedBodies.find(body => body.index === index)!;
    expect(orbit.segments.length, `${discHeightShare} viewport height`).toBeGreaterThan(0);
    expect(orbit.orbitVisibility).toBeGreaterThan(.29);
    expect(orbit.segments.every(segment => segment.every(Number.isFinite))).toBe(true);
    if (discHeightShare >= .3) expect(orbit.orbitVisibility).toBeCloseTo(.3, 2);
  }
  input.bodies[index]!.orbitHidden = true;
  expect(calculate(input).projectedBodies.find(body => body.index === index)!.orbitVisibility).toBe(0);
});
