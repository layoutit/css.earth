import assert from 'node:assert/strict';
import test from 'node:test';
import { createPhotoMasterEmissionSampler } from './photo-master.js';

const baseOptions = (density: Float64Array) => ({
  density,
  dimensions: [2, 1, 2] as [number, number, number],
  boundsKpc: { min: [0, 0, 0] as [number, number, number], max: [2, 1, 2] as [number, number, number] },
  projection: { centerKpc: [1, .5] as [number, number], spanKpc: [2, 1] as [number, number] },
  edgeFeatherFraction: 0,
  columnDensityFloorFraction: 0,
  columnDensityFullSignalFraction: .0001,
  exposureGain: 1,
});

test('master sampler retains photo frequencies finer than its depth grid', async () => {
  const density = new Float64Array([1, 1, 1, 1]);
  const rgba = new Uint8Array(8 * 4);
  for (let x = 0; x < 8; x++) {
    const signal = x % 2 ? 128 : 0;
    rgba.set([signal, signal, signal, 255], 4 * x);
  }
  const master = await createPhotoMasterEmissionSampler({
    ...baseOptions(density),
    photo: { rgba, width: 8, height: 1 },
  });
  const dark: [number, number, number] = [9, 9, 9];
  const bright: [number, number, number] = [0, 0, 0];
  // Adjacent source pixels both fall inside the same coarse XY depth cell.
  master.sample(4 / 7, .5, .5, dark);
  master.sample(6 / 7, .5, .5, bright);
  assert.deepEqual(dark, [0, 0, 0]);
  assert.ok(bright[0] > 0 && bright[0] === bright[1] && bright[1] === bright[2]);
  assert.deepEqual(master.diagnostics.photoDimensions, [8, 1]);
  assert.deepEqual(master.diagnostics.dimensions, [2, 1, 2]);
});

test('master sampler conserves optical columns and gates empty density', async () => {
  // First XY column has a 1:3 depth profile; the second has no simulated support.
  const density = new Float64Array([1, 0, 3, 0]);
  const rgba = new Uint8Array([
    128, 64, 32, 200,
    128, 64, 32, 200,
  ]);
  const master = await createPhotoMasterEmissionSampler({
    ...baseOptions(density),
    photo: { rgba, width: 2, height: 1 },
  });
  const lower: [number, number, number] = [0, 0, 0];
  const upper: [number, number, number] = [0, 0, 0];
  master.sample(.5, .5, .5, lower);
  master.sample(.5, .5, 1.5, upper);
  const display = [128, 64, 32].map(channel => channel / 255 * 200 / 255);
  const peakOptical = -Math.log(1 - display[0]!);
  for (let channel = 0; channel < 3; channel++) {
    const integrated = lower[channel]! + upper[channel]!;
    const expected = peakOptical * display[channel]! / display[0]!;
    assert.ok(Math.abs(integrated - expected) < 1e-6);
  }
  assert.ok(upper[0] > 2.9 * lower[0], 'coarse simulated density still controls depth');

  const absent: [number, number, number] = [1, 1, 1];
  master.sample(1.5, .5, .5, absent);
  assert.deepEqual(absent, [0, 0, 0]);
});
