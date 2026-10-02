import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parsePreparedWorldContext } from '@cssearth/objects';
import { createWorldContextPlanner } from './world-context-planner.js';
import type { WorldContextView } from './world-context-planner.js';
import { createWorldContextFrameEncoder, createWorldContextFrameReceiver, contextFrameTransfers } from './world-context-frame.js';

// A received frame omits keys the full frame holds as undefined; compare the defined values.
const defined = (value: unknown): unknown => Array.isArray(value) ? value.map(defined)
  : value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype
    ? Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, defined(item)])) : value;

const plan = parsePreparedWorldContext(JSON.parse(await readFile(new URL('../../../../../src/objects/sun/prepared/world-context.json', import.meta.url), 'utf8')));
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
      assert.deepEqual(body.orbitBounds, xs.length ? {
        left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys),
      } : null);
    }
    const packet = encode(++id, receive.committedId, full);
    const wire = structuredClone(packet, { transfer: contextFrameTransfers(packet) });
    const resolved = receive.accept(wire);
    assert.deepEqual(defined(resolved.frame), defined(full));
    // Changed bodies are resolved by prepared index, not by list position: with only
    // the locators publishing, the placed star's index is far beyond its position.
    if (input.anchorOnly) assert.equal(full.projectedBodies.some((body, position) => body.index !== position), true);
    for (const body of resolved.changed) assert.equal(resolved.frame.projectedBodies.find(candidate => candidate.index === body.index), body);
    // Receiver publication is the only owner of the next acknowledgement.
    assert.equal(receive.committedId, id);
  }
});

test('unchanged frames send no bodies or orbit segments and retain receiver identities', () => {
  const calculate = createWorldContextPlanner(plan), encode = createWorldContextFrameEncoder(), receive = createWorldContextFrameReceiver();
  const input = view();
  const first = receive.accept(structuredClone(encode(1, 0, calculate(input))));
  const next = structuredClone(encode(2, receive.committedId, calculate(input)));
  assert.deepEqual(next.updates, []);
  const second = receive.accept(next);
  assert.equal(second.changes.size, 0);
  assert.equal(second.frame.projectedBodies.every((body, i) => body === first.frame.projectedBodies[i]), true);
});

test('off-screen camera motion sends no unused marker state, and reveal repairs it', () => {
  const calculate = createWorldContextPlanner(plan), encode = createWorldContextFrameEncoder(), receive = createWorldContextFrameReceiver();
  const input = view(), visibleViewport = input.viewport;
  input.viewport = { ...visibleViewport, principalOffsetPixels: [1e9, 1e9] };
  const first = receive.accept(structuredClone(encode(1, 0, calculate(input))));
  assert.equal(first.frame.projectedBodies.every(body => !body.visible && !body.annotationVisible && body.segments.length === 0), true);
  input.world.pose.positionM[2] += 1e9;
  const packet = encode(2, receive.committedId, calculate(input));
  assert.deepEqual(packet.updates, []);
  receive.accept(structuredClone(packet));
  input.viewport = visibleViewport;
  const visible = structuredClone(calculate(input));
  const revealed = receive.accept(structuredClone(encode(3, receive.committedId, visible)));
  assert.deepEqual(defined(revealed.frame), defined(visible));
  assert.equal(revealed.frame.projectedBodies.some(body => body.visible && body.markerOpacity > 0), true);
  for (const body of revealed.frame.projectedBodies) {
    for (const scratch of ['depth', 'priority', 'indicatorOpacity', 'inFrame']) assert.ok(!(scratch in body));
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
  assert.deepEqual(defined(second.frame), defined(expected));
  assert.equal(next.segments, bank);
  assert.equal(next.segments[0], slot);
  assert.notDeepEqual(next.segments[0], before);
  assert.ok(!("transforms" in next));
  assert.ok(!("strokePaths" in next));
  assert.ok(!("orbitClip" in next));
});

test('hidden bodies send retirement once, then no camera-only body patches', () => {
  const calculate = createWorldContextPlanner(plan), encode = createWorldContextFrameEncoder(), receive = createWorldContextFrameReceiver();
  const input = view();
  input.bodies[1].bodyHidden = true;
  receive.accept(structuredClone(encode(1, 0, calculate(input))));
  input.world.pose.positionM[0] += 1e10;
  const next = encode(2, receive.committedId, calculate(input));
  assert.equal(next.updates.find(update => update.index === 1), undefined);
  receive.accept(structuredClone(next));
  input.bodies[1].bodyHidden = false;
  const visible = structuredClone(calculate(input));
  assert.deepEqual(defined(receive.accept(encode(3, receive.committedId, visible)).frame), defined(visible));
});

test('an incomplete growth patch cannot resize the retained chord bank', () => {
  const calculate = createWorldContextPlanner(plan), encode = createWorldContextFrameEncoder(), receive = createWorldContextFrameReceiver();
  const input = view(), first = receive.accept(structuredClone(encode(1, 0, calculate(input))));
  const body = first.frame.projectedBodies.find(body => body.segments.length > 3)!;
  const before = structuredClone(body.segments);
  input.world.pose.positionM[0] += 1e9;
  const malformed = structuredClone(encode(2, 1, calculate(input)));
  malformed.updates.find(update => update.index === body.index)!.orbit!.count += 1;
  assert.throws(() => receive.accept(malformed), /omitted a new slot/);
  assert.deepEqual(body.segments, before);
  assert.equal(receive.committedId, 1);
});

test('a discarded worker result cannot become a publication baseline, and costs no full repair', () => {
  const calculate = createWorldContextPlanner(plan), encode = createWorldContextFrameEncoder(), receive = createWorldContextFrameReceiver();
  const input = view(); receive.accept(structuredClone(encode(1, 0, calculate(input))));
  input.world.pose.positionM[2] *= 2;
  const dropped = structuredClone(encode(2, receive.committedId, calculate(input)));
  assert.equal(dropped.baseId, 1);
  input.world.pose.positionM[2] *= 2;
  const full = structuredClone(calculate(input));
  // The baseline is the frame the client acknowledged, so the repair is an
  // ordinary delta against it; the discarded frame's state is never promoted,
  // which the resolved frame below proves by matching the full plan exactly.
  const repair = structuredClone(encode(3, receive.committedId, full));
  assert.equal(repair.baseId, 1); assert.deepEqual(defined(receive.accept(repair).frame), defined(full));
  assert.throws(() => receive.accept(dropped), /baseline is stale/);
  assert.equal(receive.committedId, 3);
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
  assert.deepEqual(([...packet.updates.find(update => update.index === body.index)!.orbit!.indices]), [1]);
  assert.deepEqual(defined(receive.accept(packet).frame), defined(changed));
  next.segments = next.segments.slice(0, 1);
  const shrink = encode(3, 2, changed);
  assert.equal(shrink.updates.find(update => update.index === body.index)!.orbit!.indices.length, 0);
  assert.deepEqual(defined(receive.accept(shrink).frame), defined(changed));
  assert.deepEqual(defined(receive.accept(encode(4, 3, full)).frame), defined(full));
});
