import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { contourDepth, contourDistances } from './contour.mts';

// A deterministic generator keeps the random masks reproducible.
function random(seed: number) {
  let state = seed >>> 0;
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32; };
}

test('contour distances equal the brute-force distance to the nearest unusable pixel or the detector edge', () => {
  const next = random(7);
  for (let trial = 0; trial < 40; trial++) {
    const width = 3 + Math.floor(next() * 30), height = 3 + Math.floor(next() * 30), density = next();
    const usable = Array.from({ length: width * height }, () => next() > density * .3);
    const { distances, deepest } = contourDistances(width, height, i => usable[i]);
    let expectedDeepest = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      let best = Math.min(x + 1, y + 1, width - x, height - y);
      if (!usable[y * width + x]) best = 0;
      else for (let j = 0; j < width * height; j++) if (!usable[j]) best = Math.min(best, Math.hypot(x - j % width, y - Math.floor(j / width)));
      assert.ok(Math.abs(distances[y * width + x] - best) < 1e-5, `trial ${trial} pixel ${x},${y}: ${distances[y * width + x]} against ${best}`);
      expectedDeepest = Math.max(expectedDeepest, best);
    }
    assert.ok(Math.abs(deepest - expectedDeepest) < 1e-5);
  }
});

test('a disc fades from one at its deepest pixel to zero at its edge, continuously', () => {
  const size = 41, centre = 20, radius = 15;
  const contour = contourDistances(size, size, i => Math.hypot(i % size - centre, Math.floor(i / size) - centre) <= radius);
  assert.equal(contourDepth(contour, centre, centre), 1);
  assert.equal(contourDepth(contour, 2, 2), 0);
  assert.equal(contourDepth(contour, -1, centre), 0);
  // One pixel of travel changes the depth by at most one pixel's share of the deepest distance.
  for (let x = 0; x < size - 1; x += .25) {
    const step = Math.abs(contourDepth(contour, x + .25, centre + .3) - contourDepth(contour, x, centre + .3));
    assert.ok(step <= .25 / contour.deepest + 1e-9, `step ${step} at ${x}`);
  }
});

test('a detector with no usable pixel has no depth anywhere', () => {
  const contour = contourDistances(8, 6, () => false);
  assert.equal(contour.deepest, 0);
  assert.equal(contourDepth(contour, 3, 3), 0);
});
