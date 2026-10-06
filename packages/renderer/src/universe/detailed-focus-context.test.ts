import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { createDetailStandIn, detailedFocusContextOpacity, selectedBodyContextOpacity } from './detailed-focus-context.js';
import type { WorldCameraPose } from '@cssearth/engine';

const focus = { positionM: [1e12, -2e12, 3e12] as const, framingRadiusM: 1e6 };
const world = (radii: number): WorldCameraPose => ({ referenceFrame: 'fixture', epochJdTt: 1,
  pose: { positionM: [focus.positionM[0], focus.positionM[1], focus.positionM[2] + radii * focus.framingRadiusM], orientationXyzw: [0, 0, 0, 1] } });
test('close-up context covers native arrival, smoothly restores in physical focus radii, and leaves absent focus unchanged', () => {
  for (const distance of [0, .05, 6.1, 8]) assert.equal(detailedFocusContextOpacity(world(distance), focus), 0);
  assert.equal(detailedFocusContextOpacity(world(20), focus), .5);
  for (const distance of [32, 100]) assert.equal(detailedFocusContextOpacity(world(distance), focus), 1);
  const samples = Array.from({ length: 321 }, (_, index) => detailedFocusContextOpacity(world(index / 10), focus));
  assert.equal(samples.every((value, index) => index === 0 || value >= samples[index - 1]!), true);
  const camera = world(6.1), before = structuredClone(camera);
  assert.equal(detailedFocusContextOpacity(camera, null), 1);
  assert.deepEqual(camera, before);
});

test('body close-ups suppress distant clouds by projected size across viewports and camera lenses', () => {
  const body = { positionM: focus.positionM, radiusM: focus.framingRadiusM };
  for (const height of [390, 820, 1440]) {
    const viewport = { focalPixels: height, widthPixels: height, heightPixels: height * 1.5,
      principalOffsetPixels: [0, 0] as const };
    assert.equal(selectedBodyContextOpacity(world(6), viewport, body), 0);
    assert.equal(selectedBodyContextOpacity(world(40), viewport, body), 1);
    const mid = selectedBodyContextOpacity(world(16), viewport, body);
    assert.ok(mid > 0); assert.ok(mid < 1);
    assert.equal(selectedBodyContextOpacity({ ...world(16), projectionScale: 2 }, viewport, body), 0);
  }
});

test('two prepared positions are one place to the last bits a double holds at that distance, and no farther', async () => {
  const { samePlaceM } = await import('./detailed-focus-context.js');
  // HD 59088, 1,795 pc out: its own frame and its nebula's member list, one double's step (4,096 m) apart on one axis.
  assert.equal(samePlaceM([-19628941377457766000, 47872559906344755000, 19769983547037815000], [-19628941377457766000, 47872559906344755000, 19769983547037810000]), true);
  assert.equal(samePlaceM([-19628941377457766000, 47872559906344755000, 19769983547037815000], [-19628941377457766000, 47872559906344755000, 19769983547137815000]), false, 'a hundred thousand kilometres off is another place');
  assert.equal(samePlaceM([1.5e11, 0, 0], [1.5e11 + 0.0005, 0, 0]), true);
  assert.equal(samePlaceM([1.5e11, 0, 0], [1.5e11 + 0.01, 0, 0]), false, 'a planet a centimetre off is refused as before');
  assert.equal(samePlaceM([1, 2, 3], [1, 2]), false);
});

test('the bank a subject drew before a dataset pick stands in until the picked bank draws, and never for another subject', () => {
  const standIn = createDetailStandIn(), helix = {}, crab = {}, drawing = new Set<string>();
  const of = (picked: string | undefined, subject: unknown) => standIn.of(picked, subject, id => drawing.has(id));
  assert.equal(of('photograph', helix), undefined, 'nothing was drawn before the first bank');
  drawing.add('photograph');
  assert.equal(of('photograph', helix), undefined);
  assert.equal(of('slices', helix), 'photograph', 'picked, and not drawing yet');
  drawing.delete('photograph');
  assert.equal(of('slices', helix), 'photograph', 'whatever the stand-in itself reports');
  drawing.add('slices');
  assert.equal(of('slices', helix), undefined, 'it draws: the stand-in leaves');
  assert.equal(of('photograph', helix), 'slices', 'and it stands in for the next pick');
  assert.equal(of('pulsar', crab), undefined, 'no bank of one body stands in for another body');
  drawing.add('pulsar');
  assert.equal(of('pulsar', crab), undefined);
  assert.equal(of(undefined, crab), undefined);
  assert.equal(of('wind', crab), undefined, 'nothing stands in after the subject had no bank');
});
