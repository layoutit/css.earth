import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';
import { parsePreparedWorldContext } from './prepared-world-context.js';
import { createWorldContextPlanner } from './world-context-planner.js';
import type { WorldContextView } from './world-context-planner.js';

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
