import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadSystemView, systemViewLoaded, systemViewTarget, drawnGalaxiesZoomTarget, systemFramingRect } from './system-framing.mts';
import { readSystemViewFile } from './test/system-view-file.mts';
import type { WorldCameraPose } from '@cssearth/engine';

const world: WorldCameraPose = { referenceFrame: 'test', epochJdTt: 1, pose: { positionM: [0, 0, 10], orientationXyzw: [0, 0, 0, 1] } };
const frame = { referenceFrame: 'test', epochJdTt: 1, originM: [0, 0, 0], bodyRadiusM: 1 } as const;
const optics = { focalPixels: 100, framingRadiusPixels: 20, detailHandoffDiameterPixels: 14, visibleRect: null, principalOffsetPixels: [0, 0] } as const;
const rect = { left: -20, right: 20, top: -20, bottom: 20 };
const candidate = { minimumM: [-1, -1, -1], maximumM: [1, 1, 1], cameraToReference: [1, 0, 0, 0, 1, 0, 0, 0, 1] } as const;

test('system framing rejects mismatched frames, epochs, invalid rectangles and absent bounds', () => {
  for (const other of [{ ...frame, referenceFrame: 'different' }, { ...frame, epochJdTt: 2 }]) assert.throws(() => systemViewTarget(world, other, optics, { candidates: [candidate] }, rect), /System selection requires a common frame and epoch\./);
  for (const other of [{ ...rect, left: 0 }, { ...rect, right: 0 }, { ...rect, top: 0 }, { ...rect, bottom: 0 }]) assert.throws(() => systemViewTarget(world, frame, optics, { candidates: [candidate] }, other), /System framing must leave room around the scene center\./);
  assert.throws(() => systemViewTarget(world, frame, optics, { candidates: [] }, rect), /System framing requires prepared bounds\./);
  assert.throws(() => drawnGalaxiesZoomTarget('unknown', world, optics, rect), /has no box for unknown/);
});

test('one-box and parallel-axis candidates retain orientation even when edge-on opening is requested', () => {
  const one = systemViewTarget(world, frame, optics, { candidates: [candidate] }, rect, 0, true);
  const parallel = systemViewTarget(world, frame, optics, { candidates: [candidate, candidate] }, rect, 0, true);
  assert.deepEqual(one, parallel); assert.deepEqual(one.pose.orientationXyzw, world.pose.orientationXyzw);
  assert.deepEqual(one.pose.positionM, [0, 0, 6]);
  assert.equal(systemViewTarget(world, frame, optics, { candidates: [candidate] }, rect, 20).pose.positionM[2], 20 + 8 * Number.EPSILON * 20);
  assert.equal(systemViewTarget(world, frame, optics, { candidates: [candidate] }, rect, 0, false, 4).pose.positionM[2], 4);
  assert.deepEqual(systemFramingRect(optics), { left: -15, right: 15, top: -15, bottom: 15 });
});

test('failed system candidate reads are forgotten and concurrent retries adopt one validated result', async () => {
  const failure = new Error('offline candidates'); let calls = 0;
  assert.equal(systemViewLoaded('neptune'), false);
  await assert.rejects(loadSystemView('neptune', async () => { throw failure; }), error => error === failure);
  const read = async (id: string) => { calls++; return readSystemViewFile(id); };
  await Promise.all([loadSystemView('neptune', read), loadSystemView('neptune', read)]);
  assert.equal(calls, 1); assert.equal(systemViewLoaded('neptune'), true);
  await loadSystemView('neptune', async () => { throw new Error('must use resident result'); });
});

test('asymmetric shell padding and both principal offsets determine the fitted camera range', () => {
  assert.deepEqual(systemFramingRect({ ...optics, visibleRect: { left: -12, right: 20, top: -100, bottom: 120 } }),
    { left: -8, right: 16, top: -96, bottom: 116 });
  const target = systemViewTarget(world, { ...frame, bodyRadiusM: 0 }, { ...optics, principalOffsetPixels: [30, 40] },
    { candidates: [candidate] }, { left: -200, right: 200, top: -200, bottom: 200 }, 100);
  const depth = 100 / Math.hypot(1, .3, .4) + 8 * Number.EPSILON * 100;
  assert.deepEqual(target.pose.positionM, [.3 * depth, -.4 * depth, depth]);
});
