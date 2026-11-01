import assert from 'node:assert/strict';
import test from 'node:test';
import { hybridOpticalOpacity } from './hybrid-optics.js';

test('dense split images lift the normal-view ceiling with fixed retained opacities', () => {
  assert.equal(hybridOpticalOpacity('single', 1), .998);
  assert.equal(hybridOpticalOpacity('merged-two', 1), .001);
  assert.equal(hybridOpticalOpacity('merged-three', 1), 1 / 3);
  assert.throws(() => hybridOpticalOpacity('single', NaN));
});

test('a floored merged pair never adds transmission light over the exact optical path', () => {
  for (let byte = 0; byte <= 255; byte++) for (let step = 0; step <= 1024; step++) {
    const alpha = byte / 255, gain = 1 + step / 512;
    const pair = Math.floor((1 - (1 - alpha) ** 2) * 255) / 255;
    const result = 1 - (1 - alpha * hybridOpticalOpacity('single', gain)) *
      (1 - pair * hybridOpticalOpacity('merged-two', gain));
    const exact = 1 - (1 - alpha) ** gain;
    assert.ok(result <= exact + 1e-12, `alpha ${byte}, gain ${gain}`);
  }
});
