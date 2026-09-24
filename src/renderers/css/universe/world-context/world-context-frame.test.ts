import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';
import { parsePreparedWorldContext } from '../../prepared-data/world-context.js';
import { createWorldContextPlanner } from './world-context-planner.js';
import type { WorldContextView } from './world-context-planner.js';
import { createWorldContextFrameEncoder, createWorldContextFrameReceiver, contextFrameTransfers } from './world-context-frame.js';

const plan = parsePreparedWorldContext(JSON.parse(await readFile(new URL('../../../../objects/sun/prepared/world-context.json', import.meta.url), 'utf8')));
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

test('delta transport exactly reconstructs prepared projections across camera, hover, culling and re-entry', () => {
  const calculate = createWorldContextPlanner(plan), encode = createWorldContextFrameEncoder(), receive = createWorldContextFrameReceiver();
  const input = view(); let id = 0;
  for (const distance of [20, 20, 5, 50, 20, 5000, 1e7, 20]) {
    input.world.pose.positionM[2] = distance * 149597870700;
    input.anchorOnly = distance === 1e7;
    input.bodies[1].hovered = distance === 5;
    input.bodies[1].orbitHidden = distance === 50;
    input.bodies[1].indicatorRadius = distance === 5 ? 11 : 8;
    input.selectedId = distance === 5 ? 'saturn' : 'sun';
    const full = structuredClone(calculate(input));
    for (const body of full.projectedBodies) {
      const xs = body.segments.flatMap(segment => [segment[0], segment[2]]);
      const ys = body.segments.flatMap(segment => [segment[1], segment[3]]);
      expect(body.orbitBounds).toEqual(xs.length ? {
        left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys),
      } : null);
    }
    const packet = encode(++id, receive.committedId, full);
    const wire = structuredClone(packet, { transfer: contextFrameTransfers(packet) });
    const resolved = receive.accept(wire);
    expect(resolved.frame).toEqual(full);
    // Changed bodies are resolved by prepared index, not by list position: with only
    // the locators publishing, the placed star's index is far beyond its position.
    if (input.anchorOnly) expect(full.projectedBodies.some((body, position) => body.index !== position)).toBe(true);
    for (const body of resolved.changed) expect(resolved.frame.projectedBodies.find(candidate => candidate.index === body.index)).toBe(body);
    // Receiver publication is the only owner of the next acknowledgement.
    expect(receive.committedId).toBe(id);
  }
});

test('unchanged frames send no bodies or orbit segments and retain receiver identities', () => {
  const calculate = createWorldContextPlanner(plan), encode = createWorldContextFrameEncoder(), receive = createWorldContextFrameReceiver();
  const input = view();
  const first = receive.accept(structuredClone(encode(1, 0, calculate(input))));
  const next = structuredClone(encode(2, receive.committedId, calculate(input)));
  expect(next.updates).toEqual([]);
  const second = receive.accept(next);
  expect(second.changes.size).toBe(0);
  expect(second.frame.projectedBodies.every((body, i) => body === first.frame.projectedBodies[i])).toBe(true);
});

test('off-screen camera motion sends no unused marker state, and reveal repairs it', () => {
  const calculate = createWorldContextPlanner(plan), encode = createWorldContextFrameEncoder(), receive = createWorldContextFrameReceiver();
  const input = view(), visibleViewport = input.viewport;
  input.viewport = { ...visibleViewport, principalOffsetPixels: [1e9, 1e9] };
  const first = receive.accept(structuredClone(encode(1, 0, calculate(input))));
  expect(first.frame.projectedBodies.every(body => !body.visible && !body.annotationVisible && body.segments.length === 0)).toBe(true);
  input.world.pose.positionM[2] += 1e9;
  const packet = encode(2, receive.committedId, calculate(input));
  expect(packet.updates).toEqual([]);
  receive.accept(structuredClone(packet));
  input.viewport = visibleViewport;
  const visible = structuredClone(calculate(input));
  const revealed = receive.accept(structuredClone(encode(3, receive.committedId, visible)));
  expect(revealed.frame).toEqual(visible);
  expect(revealed.frame.projectedBodies.some(body => body.visible && body.markerOpacity > 0)).toBe(true);
  for (const body of revealed.frame.projectedBodies) {
    for (const scratch of ['depth', 'priority', 'indicatorOpacity', 'inFrame']) expect(body).not.toHaveProperty(scratch);
  }
});

test('camera updates reuse numeric chord slots and carry no formatted CSS or SVG strings', () => {
  const calculate = createWorldContextPlanner(plan), encode = createWorldContextFrameEncoder(), receive = createWorldContextFrameReceiver();
  const input = view();
  const first = receive.accept(structuredClone(encode(1, 0, calculate(input))));
  const body = first.frame.projectedBodies.find(body => body.segments.length > 3)!;
  const bank = body.segments, slot = bank[0], before = [...slot];
  input.world.pose.positionM[0] += 1e9;
  const expected = structuredClone(calculate(input));
  const packet = encode(2, receive.committedId, expected);
  const second = receive.accept(structuredClone(packet, { transfer: contextFrameTransfers(packet) }));
  const next = second.frame.projectedBodies[body.index];
  expect(second.frame).toEqual(expected);
  expect(next.segments).toBe(bank);
  expect(next.segments[0]).toBe(slot);
  expect(next.segments[0]).not.toEqual(before);
  expect(next).not.toHaveProperty('transforms');
  expect(next).not.toHaveProperty('strokePaths');
  expect(next).not.toHaveProperty('orbitClip');
});

test('hidden bodies send retirement once, then no camera-only body patches', () => {
  const calculate = createWorldContextPlanner(plan), encode = createWorldContextFrameEncoder(), receive = createWorldContextFrameReceiver();
  const input = view();
  input.bodies[1].bodyHidden = true;
  receive.accept(structuredClone(encode(1, 0, calculate(input))));
  input.world.pose.positionM[0] += 1e10;
  const next = encode(2, receive.committedId, calculate(input));
  expect(next.updates.find(update => update.index === 1)).toBeUndefined();
  receive.accept(structuredClone(next));
  input.bodies[1].bodyHidden = false;
  const visible = structuredClone(calculate(input));
  expect(receive.accept(encode(3, receive.committedId, visible)).frame).toEqual(visible);
});

test('an incomplete growth patch cannot resize the retained chord bank', () => {
  const calculate = createWorldContextPlanner(plan), encode = createWorldContextFrameEncoder(), receive = createWorldContextFrameReceiver();
  const input = view(), first = receive.accept(structuredClone(encode(1, 0, calculate(input))));
  const body = first.frame.projectedBodies.find(body => body.segments.length > 3)!;
  const before = structuredClone(body.segments);
  input.world.pose.positionM[0] += 1e9;
  const malformed = structuredClone(encode(2, 1, calculate(input)));
  malformed.updates.find(update => update.index === body.index)!.orbit!.count += 1;
  expect(() => receive.accept(malformed)).toThrow('omitted a new slot');
  expect(body.segments).toEqual(before);
  expect(receive.committedId).toBe(1);
});

test('a discarded worker result cannot become a publication baseline, and costs no full repair', () => {
  const calculate = createWorldContextPlanner(plan), encode = createWorldContextFrameEncoder(), receive = createWorldContextFrameReceiver();
  const input = view(); receive.accept(structuredClone(encode(1, 0, calculate(input))));
  input.world.pose.positionM[2] *= 2;
  const dropped = structuredClone(encode(2, receive.committedId, calculate(input)));
  expect(dropped.baseId).toBe(1);
  input.world.pose.positionM[2] *= 2;
  const full = structuredClone(calculate(input));
  // The baseline is the frame the client acknowledged, so the repair is an
  // ordinary delta against it; the discarded frame's state is never promoted,
  // which the resolved frame below proves by matching the full plan exactly.
  const repair = structuredClone(encode(3, receive.committedId, full));
  expect(repair.baseId).toBe(1); expect(receive.accept(repair).frame).toEqual(full);
  expect(() => receive.accept(dropped)).toThrow('baseline is stale');
  expect(receive.committedId).toBe(3);
});

test('one edited chord sends one slot; shrinking and regrowing restores every leaf', () => {
  const bars = { ...plan, bodies: plan.bodies.map(body => ({ ...body, ...(body.orbit ? {
    orbit: { ...body.orbit, strokes: undefined },
  } : {}) })) };
  const full = structuredClone(createWorldContextPlanner(bars)(view())), encode = createWorldContextFrameEncoder(), receive = createWorldContextFrameReceiver();
  receive.accept(encode(1, 0, full));
  const body = full.projectedBodies.find(body => body.segments.length > 3)!;
  const changed = structuredClone(full), next = changed.projectedBodies[body.index];
  next.segments = next.segments.map((segment, i) => i === 1 ? [segment[0] + 1, ...segment.slice(1)] as typeof segment : segment);
  const packet = encode(2, 1, changed);
  expect([...packet.updates.find(update => update.index === body.index)!.orbit!.indices]).toEqual([1]);
  expect(receive.accept(packet).frame).toEqual(changed);
  next.segments = next.segments.slice(0, 1);
  const shrink = encode(3, 2, changed);
  expect(shrink.updates.find(update => update.index === body.index)!.orbit!.indices.length).toBe(0);
  expect(receive.accept(shrink).frame).toEqual(changed);
  expect(receive.accept(encode(4, 3, full)).frame).toEqual(full);
});
