import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePreparedWorldContext } from '@cssearth/objects';
import { createWorldContextPlanner, type WorldContextView } from './world-context-planner.js';

const plan = parsePreparedWorldContext(JSON.parse(await readFile(
  new URL('../../../../../src/objects/observable-universe/prepared/world-context.json', import.meta.url), 'utf8')));

// Three stars of the field that are not featured, seen from far past the Sun's system: two 4 pixels apart, one alone.
const focalPixels = 1000, away = plan.system.hiddenDistanceM * 100, pixel = away / focalPixels;
const template = plan.bodies.find(body => body.id === 'merak')!;
const star = (id: string, x: number, y: number) => ({ ...template, id, name: id, positionM: [x * pixel, y * pixel, 0] as [number, number, number] });
const field = { ...plan, bodies: [star('pair-a', -200, 0), star('pair-b', -196, 0), star('alone', 200, 0)] };
const bodies = [field.focus, ...field.bodies];
const view = (distanceM: number): WorldContextView => ({
  world: { referenceFrame: plan.frame.referenceFrame, epochJdTt: plan.frame.epochJdTt, pose: { positionM: [0, 0, distanceM], orientationXyzw: [0, 0, 0, 1] } },
  viewport: { focalPixels, widthPixels: 1200, heightPixels: 800, principalOffsetPixels: [0, 0] },
  selectedId: field.focus.id, overview: true, navigationInFlight: false, anchorOnly: false,
  // The names of stars that are not featured are hidden by their rank, as the site declares them.
  bodies: bodies.map(body => ({ hovered: false, orbitHidden: false, labelHidden: body !== field.focus,
    labelSize: { width: body.name.length * 6, height: 14 }, labelShown: false, labelPlacement: 0,
    indicatorShown: false, indicatorRadius: 8, orbitAppearance: { width: 1, opacity: 1 } })),
});
const planned = (distanceM: number) => {
  const result = createWorldContextPlanner(field, Object.fromEntries(field.bodies.map(body => [body.id, 3])))(view(distanceM));
  return Object.fromEntries(result.projectedBodies.map(body => [bodies[body.index]!.id, body]));
};

test('past its system, a star that is not featured keeps its marker and is named where nothing crowds it', () => {
  const far = planned(away);
  assert.deepEqual([far.alone!.markerOpacity, far.alone!.labelShown, far.alone!.indicatorShown], [1, true, true], 'the star that stands alone');
  for (const id of ['pair-a', 'pair-b']) assert.deepEqual([far[id]!.markerOpacity, far[id]!.labelShown, far[id]!.indicatorShown], [0, false, false], `${id} is one of a crowd: it gives way to the catalogue dots`);
});

test('inside a system the stars behind it stay dots that name themselves on hover', () => {
  const near = planned(plan.system.hiddenDistanceM / 2);
  for (const id of ['pair-a', 'pair-b', 'alone']) assert.equal(near[id]!.labelShown, false, id);
});
