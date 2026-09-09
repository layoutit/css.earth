import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';
import { parsePreparedWorldContext } from './prepared-world-context.js';
import { createWorldContextPlanner } from './world-context-planner.js';
import type { WorldContextView } from './world-context-planner.js';

const plan = parsePreparedWorldContext(JSON.parse(await readFile(
  new URL('../../../planets/sun/prepared/world-context.json', import.meta.url), 'utf8')));
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
};
function view(): WorldContextView {
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
  expect(first.projectedBodies.some(body => body.transforms.length > 0)).toBe(true);
  for (const distance of [5, 50, 5000, 20]) {
    const next = structuredClone(input);
    next.world.pose.positionM[2] = distance * 149597870700;
    next.selectedId = 'saturn'; next.overview = false;
    next.bodies[0].hovered = true;
    const packet = structuredClone(calculate(freeze(next)));
    expect(packet.emphasizedId).toBe('saturn');
    for (const body of packet.projectedBodies) {
      expect(body.transforms).toHaveLength(body.segments.length);
      expect(body.transforms.every(transform => !/NaN|Infinity/.test(transform))).toBe(true);
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
