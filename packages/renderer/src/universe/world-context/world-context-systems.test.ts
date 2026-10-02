import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extendWorldContext, parsePreparedWorldContextSummary, parsePreparedWorldIndex, parsePreparedWorldSystem } from '@cssearth/objects';
import { createWorldContextPlanner, type WorldContextView } from './world-context-planner.js';
import { createWorldContextPlannerClient, type WorldPlannerWorker } from './world-context-planner-client.js';

// The summary every page reads, and one other system's file: TRAPPIST-1's seven planets (packages/bake/src/world-context/summary.ts).
const prepared = new URL('../../../../../src/objects/sun/prepared/', import.meta.url);
const summary = parsePreparedWorldContextSummary(JSON.parse(await readFile(new URL('world-context-summary.json', prepared), 'utf8')));
const trappistFile = JSON.parse(await readFile(new URL('world-systems/trappist-1.json', prepared), 'utf8')) as Record<string, unknown>;
const trappist = parsePreparedWorldSystem(trappistFile, summary, 'trappist-1');
// The build's index of which holder has each body (world-index.json); a page never reads it.
const index = parsePreparedWorldIndex(JSON.parse(await readFile(new URL('world-index.json', prepared), 'utf8')));

const view = (count: number): WorldContextView => ({
  world: { referenceFrame: summary.frame.referenceFrame, epochJdTt: summary.frame.epochJdTt,
    pose: { positionM: [0, 0, 3e12], orientationXyzw: [0, 0, 0, 1] } },
  viewport: { focalPixels: 800, widthPixels: 800, heightPixels: 600, principalOffsetPixels: [0, 0] },
  selectedId: 'earth', overview: false, navigationInFlight: false, anchorOnly: false,
  bodies: Array.from({ length: count }, () => ({ hovered: false, orbitHidden: false, labelHidden: false, labelSize: { width: 40, height: 14 },
    labelShown: false, labelPlacement: 0, indicatorShown: false, indicatorRadius: 8, orbitAppearance: { width: 1, opacity: 1 } })),
});

test('the summary holds the Sun\'s system and the bodies that orbit nothing, and lists no body of another holder', () => {
  assert.ok(summary.bodies.some(body => body.id === 'earth') && summary.bodies.some(body => body.id === 'trappist-1'));
  assert.equal(summary.bodies.some(body => body.id === 'trappist-1b'), false);
  assert.equal('deferred' in summary, false, 'a body is found through its holder, never through a list of the world');
  assert.equal(index.holders['trappist-1b'], 'trappist-1');
  assert.deepEqual(trappist.bodies.map(body => body.id).sort(), Object.keys(index.holders).filter(id => index.holders[id] === 'trappist-1').sort());
  assert.equal(index.order.length, summary.worldBodyCount);
});

test('a holder file names itself and holds bodies', () => {
  assert.throws(() => parsePreparedWorldSystem(trappistFile, summary, 'wasp-43'), /names trappist-1/);
  const columns = trappistFile.bodies as Record<string, unknown[]>;
  const empty = { ...trappistFile, bodies: Object.fromEntries(Object.entries(columns).map(([field]) => [field, []])) };
  assert.throws(() => parsePreparedWorldSystem(empty, summary, 'trappist-1'), /holds no body/);
});

test('a holder added to a plan keeps every earlier body at its index, and its own bodies follow', () => {
  const extended = extendWorldContext(summary, [trappist]);
  assert.deepEqual(extended.bodies.slice(0, summary.bodies.length), summary.bodies);
  assert.deepEqual(extended.bodies.slice(summary.bodies.length).map(body => body.id), trappist.bodies.map(body => body.id));
  assert.equal(extendWorldContext(extended, [trappist]), extended, 'a holder read twice is added once');
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
