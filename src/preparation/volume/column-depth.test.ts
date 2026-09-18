import assert from 'node:assert/strict';
import { test } from 'node:test';
import { gainForTopAlpha, spreadColumns } from './column-depth.ts';

const width = 6, height = 4, depth = 32, depthStep = 0.5;
// A shell: every column's matter sits at one depth, which moves with x, except column x = 5, where the model is empty.
const profile = (x: number, _y: number, out: Float64Array) => {
  let sum = 0;
  for (let k = 0; k < depth; k++) { out[k] = x === 5 ? 0 : Math.exp(-(((k - 8 - 3 * x) / 2) ** 2)); sum += out[k]!; }
  return sum;
};
const channel = (value: (x: number, y: number) => number) => Float32Array.from({ length: width * height }, (_, p) => value(p % width, Math.floor(p / width)));

test('each column integrates back to its measured value, and an empty model column is dropped and counted', () => {
  const red = channel((x, y) => 1 + x + y), result = spreadColumns({ width, height, depth, channels: [red], profile, depthStep });
  for (let p = 0; p < width * height; p++) {
    if (p % width === 5) { assert.equal(result.integral[0]![p], 0); continue; }
    // Eight-bit square-root encoding keeps each column within a few per cent of its value.
    assert.ok(Math.abs(result.integral[0]![p]! / red[p]! - 1) < 0.03, `column ${p}: ${result.integral[0]![p]} vs ${red[p]}`);
  }
  const dropped = [0, 1, 2, 3].reduce((sum, y) => sum + red[y * width + 5]!, 0), total = red.reduce((sum, v) => sum + v, 0);
  assert.ok(Math.abs(result.droppedShare[0]! - dropped / total) < 1e-12);
});

test('channels share one depth profile, so a column keeps its colour at every depth', () => {
  const a = channel(() => 2), b = channel(x => 1 + x / 2), result = spreadColumns({ width, height, depth, channels: [a, b], profile, depthStep });
  const p = 1 * width + 3;
  const ratios: number[] = [];
  for (let k = 0; k < depth; k++) {
    const o = 4 * (k * width * height + p), r = result.rgba[o]!, g = result.rgba[o + 1]!;
    if (r > 40 && g > 40) ratios.push((g / 255) ** 2 / (r / 255) ** 2);
  }
  assert.ok(ratios.length >= 3);
  for (const ratio of ratios) assert.ok(Math.abs(ratio - (1 + 3 / 2) / 2) < 0.06, `ratio ${ratio}`);
});

test('the gain puts the brightest column at the requested opacity, and bad input is refused', () => {
  const red = channel((x, y) => 1 + x + y), result = spreadColumns({ width, height, depth, channels: [red], profile, depthStep });
  const gain = gainForTopAlpha(result.integral, result.peak, 0.9);
  const brightest = Math.max(...result.integral[0]!) / result.peak;
  assert.ok(Math.abs(1 - Math.exp(-gain * brightest) - 0.9) < 1e-12);
  assert.throws(() => spreadColumns({ width, height, depth, channels: [], profile, depthStep }), /One to four channels/u);
  assert.throws(() => spreadColumns({ width, height, depth, channels: [new Float32Array(3)], profile, depthStep }), /One to four channels/u);
  assert.throws(() => gainForTopAlpha(result.integral, result.peak, 1), /strictly between/u);
});
