import assert from 'node:assert/strict';
import test from 'node:test';
import { sampledPanels } from './panels.ts';

test('comparison projects actual 3D RGB, not the photograph used as its target', async () => {
  const result = await sampledPanels({ bounds: { min: [-1, -1, 0], max: [1, 1, 1] },
    sampleEmission(_x, _y, _z, out) { out.fill(1); } },
  { sampleRgb(_x, _y, out) { out[0] = out[1] = 0; out[2] = 255; return true; } },
  { min: [-1, -1], max: [1, 1] }, (_x, _y, _z, out) => { out[0] = 255; out[1] = out[2] = 0; return true; }, 4);
  const actualMaterialError = Math.abs(.2126 * (1 - Math.exp(-1)) - .0722);
  assert.ok(Math.abs(result.metrics.fitRmse - actualMaterialError) < 1e-7);
  const photographProjectionError = Math.abs(.0722 * (1 - Math.exp(-1)) - .0722);
  assert.ok(Math.abs(result.metrics.fitRmse - photographProjectionError) > .02);
});
