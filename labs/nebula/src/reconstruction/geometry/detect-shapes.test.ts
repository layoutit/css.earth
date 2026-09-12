import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectShapes, groupShapes, type ShapeCandidate } from './detect-shapes.js';
import { ellipsePoint, fitEllipse, radialError, supportedArcs, tau, type Ellipse } from './ellipse.js';
import { readDetectionSettings } from './settings.js';

function raster(width: number, height: number, rings: Ellipse[], missing = false, clutter = false) {
  const pixels = new Uint8Array(width * height * 3);
  let state = 12;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const stars = Array.from({ length: clutter ? 35 : 0 }, () => [random() * width, random() * height]);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    let signal = .015 + .006 * x / width;
    for (const ring of rings) {
      const theta = Math.atan2(y + .5 - ring.center[1], x + .5 - ring.center[0]);
      if (missing && theta > .2 && theta < 1.4) continue;
      const error = radialError(ring, [x + .5, y + .5]);
      signal += .55 * Math.exp(-.5 * (error / 1.8) ** 2) * (.75 + .25 * Math.cos(theta * 3));
    }
    for (const star of stars) signal += .85 * Math.exp(-.5 * ((x - star[0]!) ** 2 + (y - star[1]!) ** 2) / .6 ** 2);
    signal += (random() - .5) * .008;
    const n = Math.round(Math.min(1, Math.max(0, signal)) * 255);
    pixels.fill(n, (y * width + x) * 3, (y * width + x) * 3 + 3);
  }
  return pixels;
}
function agreement(actual: Ellipse, expected: Ellipse) {
  return Array.from({ length: 48 }, (_, i) => radialError(actual, ellipsePoint(expected, i * tau / 48))).reduce((a, b) => a + b, 0) / 48;
}

test('five-point fit recovers an offset rotated ellipse, rejects a line', () => {
  const expected: Ellipse = { center: [71, 110], radii: [62, 35], angleRadians: .71 };
  const actual = fitEllipse([0, .8, 1.9, 3.4, 4.8].map(t => ellipsePoint(expected, t)), 200);
  assert.ok(actual); assert.ok(agreement(actual, expected) < 1e-6);
  assert.equal(fitEllipse(Array.from({ length: 5 }, (_, i) => [i, i * 3]), 200), null);
});

test('automatic detection recovers an interrupted offset ellipse amid stars without a supplied center or radius', () => {
  const expected: Ellipse = { center: [107, 81], radii: [65, 39], angleRadians: .6 };
  const rgb = raster(224, 192, [expected], true, true);
  const result = detectShapes(rgb, 224, 192, { iterations: 6000 });
  assert.ok(result.candidates.length, JSON.stringify(result.diagnostics));
  const best = result.candidates.reduce((a, b) => agreement(a, expected) < agreement(b, expected) ? a : b);
  assert.ok(agreement(best, expected) < 3, JSON.stringify(best));
  assert.ok(best.coverage > .45 && best.coverage < .98, `Missing arc must remain unsupported: ${best.coverage}`);
  assert.ok(best.supportedArcs.reduce((sum, arc) => sum + arc.endRadians - arc.startRadians, 0) < tau * .95);
  assert.deepEqual(detectShapes(rgb, 224, 192, { iterations: 6000 }), result, 'Same inputs and seed must reproduce identical candidates.');
});

test('empty image and isolated stars do not manufacture nebular ellipse detections', () => {
  assert.equal(detectShapes(new Uint8Array(128 * 128 * 3), 128, 128, { iterations: 1000 }).candidates.length, 0);
  assert.equal(detectShapes(raster(160, 160, [], false, true), 160, 160, { iterations: 3000 }).candidates.length, 0);
});

test('nested ellipses are detected and grouped from pixels rather than supplied geometry', () => {
  const inner: Ellipse = { center: [96, 94], radii: [35, 27], angleRadians: .4 };
  const outer: Ellipse = { center: [97, 95], radii: [71, 56], angleRadians: .45 };
  const result = detectShapes(raster(192, 192, [inner, outer]), 192, 192, { iterations: 6000 });
  const a = result.candidates.find(candidate => agreement(candidate, inner) < 4);
  const b = result.candidates.find(candidate => agreement(candidate, outer) < 4);
  assert.ok(a && b, 'Both projected rings should be recovered independently.');
  assert.ok(a.groupId && a.groupId === b.groupId, 'Concentric relationship must arise from detected centers.');
});

test('detected shared centers group nested projections without forcing equal orientations', () => {
  const candidate = (id: string, center: [number, number], radii: [number, number], angleRadians: number): ShapeCandidate =>
    ({ id, center, radii, angleRadians, score: .5, coverage: .8, supportedArcs: [] });
  const shapes = [candidate('inner', [100, 100], [40, 30], .1), candidate('outer', [102, 98], [65, 50], .8), candidate('elsewhere', [40, 40], [35, 25], .2)];
  assert.deepEqual(groupShapes(shapes).map(group => group.members), [['inner', 'outer']]);
  assert.equal(shapes[2]!.groupId, undefined);
  assert.deepEqual(supportedArcs([true, true, false, false, true, true]), [
    { startRadians: 0, endRadians: tau / 3 }, { startRadians: tau * 2 / 3, endRadians: tau },
  ]);
});

test('geometry boundary rejects mismatched input and unbounded work settings', () => {
  assert.throws(() => detectShapes(new Uint8Array(4), 100, 100));
  assert.throws(() => detectShapes(new Uint8Array(32 * 32 * 3), 32, 32, { iterations: Infinity }));
});

test('sensitivity reveals faint contours while defaults and explicit 100 percent are identical', () => {
  const width = 128, expected: Ellipse = { center: [64, 63], radii: [40, 30], angleRadians: .25 };
  const faint = new Uint8Array(width * width * 3);
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
    const value = Math.round(4 * Math.exp(-.5 * (radialError(expected, [x + .5, y + .5]) / 2) ** 2));
    faint.fill(value, (y * width + x) * 3, (y * width + x) * 3 + 3);
  }
  const baseline = detectShapes(faint, width, width, { iterations: 3000 });
  assert.equal(baseline.candidates.length, 0);
  assert.deepEqual(detectShapes(faint, width, width, { iterations: 3000, sensitivity: 1 }), baseline);
  const progress: number[] = [];
  const sensitive = detectShapes(faint, width, width, { iterations: 3000, sensitivity: 4 }, { onProgress: (current, total) => progress.push(current / total) });
  assert.ok(sensitive.candidates.some(candidate => agreement(candidate, expected) < 4), 'Sensitivity must reach the detector, not just change display brightness.');
  assert.equal(progress.at(-1), 1); assert.ok(progress.some(value => value > 0 && value < 1));
  assert.equal(detectShapes(new Uint8Array(faint.length), width, width, { sensitivity: 4 }).candidates.length, 0);
});

test('minimum size and maximum shapes control actual proposals; settings reject invalid input', () => {
  const rings: Ellipse[] = [{ center: [96, 94], radii: [35, 27], angleRadians: .4 }, { center: [97, 95], radii: [71, 56], angleRadians: .45 }];
  const rgb = raster(192, 192, rings);
  assert.equal(detectShapes(rgb, 192, 192, { iterations: 3000, maxCandidates: 1 }).candidates.length, 1);
  assert.equal(detectShapes(rgb, 192, 192, { iterations: 3000, minRadiusFraction: .4 }).candidates.length, 0);
  assert.equal(readDetectionSettings({}).sensitivity, 1);
  for (const changed of [{ sensitivity: 0 }, { sensitivity: 4.1 }, { sensitivity: NaN }, { maxCandidates: 33 }, { maxCandidates: 1.5 },
    { minRadiusFraction: .01 }, { mystery: true }]) assert.throws(() => readDetectionSettings(changed));
});
