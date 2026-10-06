import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extendWorldContext, parsePreparedWorldContextSummary, parsePreparedWorldIndex, parsePreparedWorldSystem } from '@cssearth/objects';
import type { PreparedWorldContext } from '@cssearth/objects';
import { createWorldContextPlanner, type WorldContextView } from './world-context-planner.js';
import { createWorldContextPlannerClient, type WorldPlannerWorker } from './world-context-planner-client.js';

// What every page reads: the summary (the frame and the Sun) and the files drawn from anywhere, among them the Milky Way's,
// which has TRAPPIST-1; and one other file, the TRAPPIST-1 system's seven planets (packages/bake/src/world-context/summary.ts).
const objects = new URL('../../../../../src/objects/', import.meta.url);
const json = async (path: string): Promise<Record<string, unknown>> => JSON.parse(await readFile(new URL(path, objects), 'utf8')) as Record<string, unknown>;
// The build's index of the world: its order and every object with a file, from the root of the tree down; a page never reads it.
const index = parsePreparedWorldIndex(await json('observable-universe/prepared/world-index.json'));
const root = parsePreparedWorldContextSummary(await json('observable-universe/prepared/world.json'));
let summary: PreparedWorldContext = root;
for (const id of index.files) {
  const file = await json(`${id}/prepared/members.json`);
  if (file.anywhere === true) summary = extendWorldContext(summary, [parsePreparedWorldSystem(file, summary, id)]);
}
const trappistFile = await json('trappist-1-system/prepared/members.json');
const trappist = parsePreparedWorldSystem(trappistFile, summary, 'trappist-1-system');

const view = (count: number): WorldContextView => ({
  world: { referenceFrame: summary.frame.referenceFrame, epochJdTt: summary.frame.epochJdTt,
    pose: { positionM: [0, 0, 3e12], orientationXyzw: [0, 0, 0, 1] } },
  viewport: { focalPixels: 800, widthPixels: 800, heightPixels: 600, principalOffsetPixels: [0, 0] },
  selectedId: 'earth', overview: false, navigationInFlight: false, anchorOnly: false,
  bodies: Array.from({ length: count }, () => ({ hovered: false, orbitHidden: false, labelHidden: false, labelSize: { width: 40, height: 14 },
    labelShown: false, labelPlacement: 0, indicatorShown: false, indicatorRadius: 8, orbitAppearance: { width: 1, opacity: 1 } })),
});

test('the summary holds the Sun alone; every other body is in the file of the object it is inside', async () => {
  assert.deepEqual(root.bodies, []);
  assert.equal(root.focus.id, 'sun');
  const milkyWay = await json('milky-way/prepared/members.json') as { bodies: { id: string[] } };
  // A star with a system is drawn as its system, which is inside the Milky Way; its planets are in its system's file.
  assert.ok(milkyWay.bodies.id.includes('trappist-1'));
  assert.equal(summary.bodies.some(body => body.id === 'trappist-1b'), false);
  assert.ok(trappist.bodies.some(body => body.id === 'trappist-1b'));
  assert.equal('deferred' in summary, false, 'a body is found through the object tree, never through a list of the world');
  // The files are listed from the root of the tree down: an object's file comes after the file of the object it is inside.
  assert.ok(index.files.indexOf('milky-way') < index.files.indexOf('trappist-1-system'));
  assert.ok(index.files.indexOf('solar-system') < index.files.indexOf('earth-system'));
  assert.equal(index.order.length, root.worldBodyCount);
});

test('a file names itself and holds bodies or places', () => {
  assert.throws(() => parsePreparedWorldSystem(trappistFile, summary, 'wasp-43-system'), /names trappist-1-system/);
  const columns = trappistFile.bodies as Record<string, unknown[]>;
  const empty = { ...trappistFile, bodies: Object.fromEntries(Object.entries(columns).map(([field]) => [field, []])) };
  assert.throws(() => parsePreparedWorldSystem(empty, summary, 'trappist-1-system'), /holds no body and no places/);
});

test('a file added to a plan keeps every earlier body at its index, and its own bodies follow', () => {
  const extended = extendWorldContext(summary, [trappist]);
  assert.deepEqual(extended.bodies.slice(0, summary.bodies.length), summary.bodies);
  assert.deepEqual(extended.bodies.slice(summary.bodies.length).map(body => body.id), trappist.bodies.map(body => body.id));
  assert.equal(extendWorldContext(extended, [trappist]), extended, 'a file read twice is added once');
  // A plan being built whole puts every body at its place in the full context instead: the index's order.
  const ordered = extendWorldContext(summary, [trappist], index.order);
  const places = new Map(index.order.map((id, place) => [id, place] as const));
  const sequence = ordered.bodies.map(body => places.get(body.id)!);
  assert.deepEqual(sequence, [...sequence].sort((a, b) => a - b));
  assert.equal(ordered.bodies.length, extended.bodies.length);
});

test('the planner plans another system\'s bodies after their own indices once it is extended', () => {
  const calculate = createWorldContextPlanner(summary), before = 1 + summary.bodies.length;
  calculate(view(before));
  const extended = extendWorldContext(summary, [trappist]);
  assert.throws(() => calculate(view(1 + extended.bodies.length)), /matching frame, body state/);
  calculate.extend(extended);
  const frame = calculate(view(1 + extended.bodies.length));
  assert.ok(frame.projectedBodies.every(body => body.index < 1 + extended.bodies.length));
});

test('inside a placed star\'s system the bodies of every other system dim, as they do inside the Sun\'s', () => {
  const extended = extendWorldContext(summary, [trappist]), points = [extended.focus, ...extended.bodies];
  const at = (id: string) => points.findIndex(point => point.id === id), star = points[at('trappist-1')]!;
  const other = points.find(point => point.id !== 'sun' && point.id !== 'trappist-1' && !('orbit' in point && point.orbit))!.id;
  const calculate = createWorldContextPlanner(summary);
  calculate.extend(extended);
  // The planner retains its outputs, so each frame's values are read before the next is planned.
  const emphasis = (distanceM: number) => {
    const frame = calculate({ ...view(points.length), selectedId: 'trappist-1', world: { referenceFrame: summary.frame.referenceFrame, epochJdTt: summary.frame.epochJdTt,
      pose: { positionM: [star.positionM[0], star.positionM[1], star.positionM[2] + distanceM], orientationXyzw: [0, 0, 0, 1] } } });
    return ['trappist-1', 'trappist-1b', 'sun', other].map(id => frame.projectedBodies.find(body => body.index === at(id))!.emphasis);
  };
  // Among the planets; then where the stars around the system fill the view, as around the Sun's.
  const fullM = extended.system.fadeOutStartDistanceM, rising = emphasis(fullM / 4);
  assert.deepEqual(emphasis(4e11), [1, 1, .3, .3]);
  assert.deepEqual(rising.slice(0, 2), [1, 1]);
  assert.ok(rising[2]! > .3 && rising[2]! < 1 && rising[3] === rising[2], `rising: ${rising[2]}`);
  assert.deepEqual(emphasis(fullM), [1, 1, 1, 1]);
});

test('the planner client sends a system just before the first view that holds its bodies', async () => {
  const posted: unknown[] = [];
  const worker: WorldPlannerWorker = { onmessage: null, onerror: null, postMessage: value => { posted.push(value); }, terminate() {} };
  const client = createWorldContextPlannerClient(summary, () => worker, {}, { orbitBanksUrl: '/world/orbits/' });
  worker.onmessage!({ data: { ready: true } } as MessageEvent);
  const extended = extendWorldContext(summary, [trappist]);
  client.extend(extended);
  const columns = (count: number) => ({ ...view(0), bodies: undefined, bodyColumns: new Float64Array(count * 15) });
  // A view captured before the system arrived goes alone; the next, holding its bodies, follows the extension.
  void client.plan(columns(1 + summary.bodies.length));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(posted.some(message => typeof message === 'object' && message !== null && 'validatedExtension' in message), false);
  worker.onmessage!({ data: { id: 1, frame: {} } } as MessageEvent);
  await new Promise(resolve => setTimeout(resolve, 0));
  const second = client.plan(columns(1 + extended.bodies.length)).catch(() => undefined);
  await new Promise(resolve => setTimeout(resolve, 0));
  const at = posted.findIndex(message => typeof message === 'object' && message !== null && 'validatedExtension' in message);
  assert.ok(at > 0 && posted.length === at + 2, 'the extension precedes the view that needs it');
  client.destroy();
  await second;
});

test('an extension carries the added bodies\' annotation tiers to the worker, and a hosted planet is a reference at its tier', async () => {
  const posted: unknown[] = [];
  const worker: WorldPlannerWorker = { onmessage: null, onerror: null, postMessage: value => { posted.push(value); }, terminate() {} };
  const client = createWorldContextPlannerClient(summary, () => worker, {}, { orbitBanksUrl: '/world/orbits/' });
  worker.onmessage!({ data: { ready: true } } as MessageEvent);
  const extended = extendWorldContext(summary, [trappist]);
  client.extend(extended, { 'trappist-1b': 3 });
  const columns = (count: number) => ({ ...view(0), bodies: undefined, bodyColumns: new Float64Array(count * 15) });
  const planned = client.plan(columns(1 + extended.bodies.length)).catch(() => undefined);
  await new Promise(resolve => setTimeout(resolve, 0));
  const extension = posted.find(message => typeof message === 'object' && message !== null && 'validatedExtension' in message) as { annotationPriorities: Record<string, number> } | undefined;
  assert.deepEqual(extension?.annotationPriorities, { 'trappist-1b': 3 });
  client.destroy();
  await planned;
  // The planner reads the tier it was extended with: seen from inside its system, a planet of tier 3 keeps its marker as
  // a reference where one of no tier fades with its orbit.
  const star = extended.bodies.find(body => body.id === 'trappist-1')!, index = 1 + extended.bodies.findIndex(body => body.id === 'trappist-1b');
  const near = (count: number): WorldContextView => ({ ...view(count), selectedId: 'trappist-1', overview: false,
    world: { referenceFrame: summary.frame.referenceFrame, epochJdTt: summary.frame.epochJdTt,
      pose: { positionM: [star.positionM[0], star.positionM[1], star.positionM[2] + 4e11], orientationXyzw: [0, 0, 0, 1] } } });
  const planet = (priorities: Record<string, number>) => {
    const calculate = createWorldContextPlanner(summary);
    calculate.extend(extended, priorities);
    return calculate(near(1 + extended.bodies.length)).projectedBodies.find(body => body.index === index);
  };
  const tiered = planet({ 'trappist-1b': 3 }), plain = planet({});
  assert.ok(tiered && plain, 'the planet projects');
  assert.ok(tiered.markerOpacity > plain.markerOpacity, `tier 3 keeps the marker (${tiered.markerOpacity} over ${plain.markerOpacity})`);
});
