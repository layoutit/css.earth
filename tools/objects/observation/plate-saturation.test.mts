import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { maskSaturatedStars, PLATE_PREPARATION } from './plate-saturation.mts';

const W = 200, H = 200;
/** A plate with sky, one saturated star (flat core plus halo) and one unsaturated star of the same peak. */
function plate() {
  const plane = new Float32Array(W * H);
  for (let i = 0; i < plane.length; i++) plane[i] = 1000 + (i % 7) * 20;
  const peak = 25000;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const flat = Math.hypot(x - 60, y - 60), sharp = Math.hypot(x - 150, y - 150);
    // Saturated: a flat core of radius 6 with a broad halo. Unsaturated: the same peak, no plateau.
    if (flat <= 6) plane[y * W + x] = peak - flat * 4;
    else if (flat <= 40) plane[y * W + x] = Math.max(plane[y * W + x]!, peak * Math.exp(-(flat - 6) / 9));
    if (sharp <= 30) plane[y * W + x] = Math.max(plane[y * W + x]!, peak * Math.exp(-sharp / 1.4));
  }
  return plane;
}

test('a flat-cored plate star and its halo become no coverage; a peaked star and a flat field do not', () => {
  const plane = plate(), original = Float32Array.from(plane);
  const result = maskSaturatedStars(plane, W, H);
  assert.equal(result.stars.length, 1, JSON.stringify(result.stars));
  const [star] = result.stars as [typeof result.stars[number]];
  assert.ok(Math.hypot(star.x - 60, star.y - 60) <= 1, `the saturated core is found at ${star.x},${star.y}`);
  assert.ok(star.plateauRadius >= PLATE_PREPARATION.minimumPlateauRadius && star.plateauRadius <= 8, `plateau ${star.plateauRadius}`);
  assert.ok(star.maskedRadius > star.plateauRadius && star.maskedRadius <= PLATE_PREPARATION.maximumHaloRadius, `halo ${star.maskedRadius}`);
  assert.ok(Number.isNaN(plane[60 * W + 60]!) && Number.isNaN(plane[60 * W + 60 + star.plateauRadius + 2]!), 'the core and its halo are masked');
  assert.ok(!Number.isNaN(plane[150 * W + 150]!), 'the peaked star of the same peak keeps its measurement');
  assert.equal(plane[150 * W + 150], original[150 * W + 150]);
  assert.ok(result.maskedPixels > Math.PI * star.plateauRadius ** 2 && result.maskedPixels < W * H / 4, `masked ${result.maskedPixels}`);
  // A flat field is not saturation, however bright: no core stands above the background.
  const flat = new Float32Array(W * H).fill(25000);
  assert.deepEqual(maskSaturatedStars(flat, W, H).stars, []);
  assert.ok(flat.every(value => value === 25000));
});
