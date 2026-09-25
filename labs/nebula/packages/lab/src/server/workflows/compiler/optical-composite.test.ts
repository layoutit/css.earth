import assert from 'node:assert/strict';
import test from 'node:test';
import { createOpticalComposite, type OpticalImageSampler } from '@cssearth/nebula-reconstruction/observations/optical-composite';
import type { SkyBounds } from '@cssearth/bake/volume';

type Rgb = [number, number, number];
type Matrix = [number, number, number, number, number, number];
const bounds: SkyBounds = { min: [-300, -300], max: [300, 300] };
function source(width: number, height: number, matrix: Matrix, diffuse: (x: number, y: number) => Rgb,
  original = diffuse, valid = (_x: number, _y: number) => true): OpticalImageSampler {
  const [a, b, c, d, e, f] = matrix, determinant = a * d - b * c;
  const sample = (rgb: typeof diffuse) => (x: number, y: number, out: Rgb) => {
    const u = (d * (x - e) - c * (y - f)) / determinant, v = (-b * (x - e) + a * (y - f)) / determinant;
    if (u < 0 || u >= width || v < 0 || v >= height || !valid(x, y)) return false;
    const value = rgb(x, y); for (let channel = 0; channel < 3; channel++) out[channel] = value[channel]!;
    return true;
  };
  return { nativeWidth: width, nativeHeight: height, pixelToSky: (u, v) => [a * u + c * v + e, b * u + d * v + f],
    sampleRgb: sample(diffuse), sampleOriginal: sample(original) };
}
const detailMatrix: Matrix = [0, 2, 3, 0, -120, -100];
const wideMatrix: Matrix = [3, 0, 0, -3, -300, 300];
const base = (x: number, y: number): Rgb => [80 + .16 * x + .06 * y, 100 + .05 * x + .2 * y, 100 + .1 * x - .1 * y];
const expectedGain: Rgb = [1.2, .8, 1.1], expectedOffset: Rgb = [7, 14, -3];
const matched = (x: number, y: number): Rgb => base(x, y).map((v, c) => v * expectedGain[c]! + expectedOffset[c]!) as Rgb;
function close(actual: number, expected: number, tolerance = 1e-8) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected} by more than ${tolerance}`);
}

test('native rotated and scaled overlap recovers channel gains and applies them across the wide footprint', () => {
  const reference = source(100, 80, detailMatrix, matched);
  const wide = source(200, 200, wideMatrix, base, (x, y) => base(x, y).map(v => v + 8) as Rgb);
  const composite = createOpticalComposite(reference, wide, bounds, { featherArcsec: 30, correctionScope: 'full' });
  assert.equal(composite.metadata.status, 'fitted');
  assert.ok(composite.metadata.sampleCount >= 1000); assert.ok(composite.metadata.heldOutSampleCount > 100);
  assert.ok(composite.metadata.heldOutRmseBefore! > 10); assert.ok(composite.metadata.heldOutRmseAfter! < 1e-8);
  const rgb: Rgb = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    close(composite.metadata.correction.gain[c]!, expectedGain[c]!);
    close(composite.metadata.correction.offset[c]!, expectedOffset[c]!);
  }
  for (const [x, y] of [[0, 0], [115, 12], [220, -170]]) {
    assert.equal(composite.sampleRgb(x!, y!, rgb), true);
    rgb.forEach((v, c) => close(v, matched(x!, y!)[c]!));
  }
  assert.equal(composite.sampleOriginal(220, -170, rgb), true);
  rgb.forEach((v, c) => close(v, matched(220, -170)[c]! + 8 * expectedGain[c]!));
  assert.equal(composite.sampleRgb(301, 0, rgb), false);
});

test('clipped and star-dominated samples are excluded and remaining diffuse outliers cannot set the fit', () => {
  const reference = source(100, 80, detailMatrix, (x, y) => {
    if (x < -90) return [255, 255, 255];
    const rgb = matched(x, y);
    return (Math.floor(x) + Math.floor(y)) % 11 === 0 ? rgb.map(v => v + 35) as Rgb : rgb;
  }, (x, y) => matched(x, y).map(v => v + (x > 85 ? 90 : 0)) as Rgb);
  const composite = createOpticalComposite(reference, source(200, 200, wideMatrix, base), bounds);
  assert.equal(composite.metadata.status, 'fitted'); assert.ok(composite.metadata.rejectedSampleCount > 500);
  assert.ok(composite.metadata.heldOutRmseAfter! < composite.metadata.heldOutRmseBefore!);
  composite.metadata.correction.gain.forEach((v, c) => close(v, expectedGain[c]!, .01));
  composite.metadata.correction.offset.forEach((v, c) => close(v, expectedOffset[c]!, .5));
});

test('feathering uses arcseconds after rotation and preserves interior detail and original sampling', () => {
  const composite = createOpticalComposite(source(100, 80, detailMatrix, () => [100, 80, 60], () => [110, 90, 70]),
    source(200, 200, wideMatrix, () => [20, 40, 60], () => [40, 60, 80]), bounds, { featherArcsec: 30 });
  assert.equal(composite.metadata.status, 'insufficient-variation');
  const rgb: Rgb = [0, 0, 0];
  composite.sampleRgb(0, 0, rgb); assert.deepEqual(rgb, [100, 80, 60]);
  composite.sampleRgb(105, 0, rgb); assert.deepEqual(rgb, [60, 60, 60]); // 15 arcseconds from the reference edge.
  composite.sampleOriginal(105, 0, rgb); assert.deepEqual(rgb, [75, 75, 75]);
  composite.sampleRgb(0, 85, rgb); assert.deepEqual(rgb, [60, 60, 60]); // Other native scale, same physical edge distance.
  composite.sampleRgb(120 - .001, 0, rgb); close(rgb[0], 20, 1e-6);
  composite.sampleRgb(120 + .001, 0, rgb); assert.deepEqual(rgb, [20, 40, 60]);
});

test('source coverage, interior holes and observed black remain separate without extrapolation', () => {
  const reference = source(100, 80, detailMatrix, () => [0, 0, 0], undefined, x => x < 30);
  const wide = source(200, 200, wideMatrix, () => [50, 60, 70], undefined, x => x > -30 && x < 200);
  const composite = createOpticalComposite(reference, wide, bounds);
  assert.equal(composite.metadata.status, 'insufficient-overlap');
  const rgb: Rgb = [99, 99, 99];
  assert.equal(composite.sampleRgb(-50, 0, rgb), true); assert.deepEqual(rgb, [0, 0, 0]);
  assert.equal(composite.sampleRgb(80, 0, rgb), true); assert.deepEqual(rgb, [50, 60, 70]);
  for (const method of ['sampleRgb', 'sampleOriginal'] as const) {
    rgb.fill(99); assert.equal(composite[method](220, 0, rgb), false); assert.deepEqual(rgb, [99, 99, 99]);
    assert.equal(composite[method](NaN, 0, rgb), false);
  }
});

test('fit limits bound attempted display corrections and sparse or constant overlap never invents calibration', () => {
  const reference = source(100, 80, detailMatrix, (x, y) => base(x, y).map(v => v * 1.6 + 10) as Rgb);
  const wide = source(200, 200, wideMatrix, base);
  const bounded = createOpticalComposite(reference, wide, bounds, { gainLimits: [.9, 1.1], offsetLimits: [-5, 5] });
  assert.equal(bounded.metadata.status, 'fitted');
  assert.ok(bounded.metadata.correction.gain.every(v => v >= .9 && v <= 1.1));
  assert.ok(bounded.metadata.correction.offset.every(v => v >= -5 && v <= 5));
  const sparse = createOpticalComposite(reference, wide, { min: [0, 0], max: [1, 1] });
  assert.equal(sparse.metadata.status, 'insufficient-overlap'); assert.deepEqual(sparse.metadata.correction, { gain: [1, 1, 1], offset: [0, 0, 0] });
  assert.throws(() => createOpticalComposite(reference, wide, bounds, { featherArcsec: 0 }), /Invalid/);
  assert.throws(() => createOpticalComposite(reference, wide, bounds, { maxFitSamples: Infinity }), /Invalid/);
});

test('held-out disagreement rejects a misleading fit instead of applying invented calibration', () => {
  const matrix: Matrix = [1, 0, 0, 1, 0, 0], smallBounds: SkyBounds = { min: [0, 0], max: [10, 10] };
  const signal = (x: number, y: number): Rgb => [60 + 3 * x + 2 * y, 70 + 2 * x + 3 * y, 80 + 3 * x + 3 * y];
  const reference = source(10, 10, matrix, (x, y) => {
    const rgb = signal(x, y);
    return (Math.floor(y) * 10 + Math.floor(x)) % 5 === 0 ? rgb : rgb.map(v => 1.4 * v + 10) as Rgb;
  });
  const result = createOpticalComposite(reference, source(10, 10, matrix, signal), smallBounds,
    { maxFitSamples: 100, minFitSamples: 20 });
  assert.equal(result.metadata.status, 'held-out-regression');
  assert.equal(result.metadata.heldOutRmseBefore, 0); assert.equal(result.metadata.heldOutRmseAfter, 0);
  assert.deepEqual(result.metadata.correction, { gain: [1, 1, 1], offset: [0, 0, 0] });
});

test('default overlap correction preserves exact wide outskirts and blends continuously across a tilted footprint', () => {
  const tilted: Matrix = [2, 1, -.5, 3, -80, -170];
  const reference = source(100, 80, tilted, matched, (x, y) => matched(x, y).map(v => v + 6) as Rgb);
  const wide = source(200, 200, wideMatrix, base, (x, y) => base(x, y).map(v => v + 8) as Rgb);
  const composite = createOpticalComposite(reference, wide, bounds, { featherArcsec: 30 });
  assert.equal(composite.metadata.status, 'fitted'); assert.equal(composite.metadata.limits.correctionScope, 'overlap');
  const rgb: Rgb = [0, 0, 0], expected: Rgb = [0, 0, 0];
  for (const method of ['sampleRgb', 'sampleOriginal'] as const) {
    assert.equal(composite[method](220, -170, rgb), true); wide[method](220, -170, expected);
    assert.deepEqual(rgb, expected, 'Wide-only RGB must remain exact, including the original layer.');
    const center = reference.pixelToSky(50, 40); composite[method](...center, rgb); reference[method](...center, expected);
    assert.deepEqual(rgb, expected, 'The reference interior is unchanged.');
    // The native top edge has sky tangent (2,1), so (-1,2)/sqrt(5) points inward.
    const edge = reference.pixelToSky(50, 0), nx = -1 / Math.sqrt(5), ny = 2 / Math.sqrt(5);
    const x = edge[0] + 15 * nx, y = edge[1] + 15 * ny;
    const a: Rgb = [0, 0, 0], b: Rgb = [0, 0, 0]; reference[method](x, y, a); wide[method](x, y, b);
    composite[method](x, y, rgb);
    for (let c = 0; c < 3; c++) {
      const corrected = b[c]! * composite.metadata.correction.gain[c]! + composite.metadata.correction.offset[c]!;
      close(rgb[c]!, .5 * a[c]! + .25 * b[c]! + .25 * corrected);
    }
    for (const distance of [-.001, .001]) {
      const sx = edge[0] + distance * nx, sy = edge[1] + distance * ny;
      composite[method](sx, sy, rgb); wide[method](sx, sy, expected);
      rgb.forEach((v, c) => close(v, expected[c]!, 1e-6));
    }
  }
});

function withLow(image: OpticalImageSampler, low: OpticalImageSampler): OpticalImageSampler {
  return { ...image, sampleLowRgb: low.sampleRgb, sampleLowOriginal: low.sampleOriginal };
}

test('detail fusion preserves different broad backgrounds and colors without a rectangular reference patch', () => {
  const reference = source(100, 80, detailMatrix, (x, y) => [20 + .05 * x, 12 + .03 * y, 24 + .06 * x]);
  const wide = source(200, 200, wideMatrix, base, (x, y) => base(x, y).map(v => v + 15) as Rgb);
  const composite = createOpticalComposite(withLow(reference, reference), withLow(wide, wide), bounds, { method: 'detail-fusion', featherArcsec: 30 });
  assert.equal(composite.metadata.status, 'detail-fusion'); assert.equal(composite.metadata.heldOutRmseAfter, null);
  const rgb: Rgb = [0, 0, 0], expected: Rgb = [0, 0, 0];
  for (const method of ['sampleRgb', 'sampleOriginal'] as const) for (const x of [-160, -120.001, -119.999, -105, 0, 105, 119.999, 120.001, 220]) {
    assert.equal(composite[method](x, 0, rgb), true); wide[method](x, 0, expected);
    assert.deepEqual(rgb, expected, 'A broad reference offset/gradient must contribute no fine detail.');
  }
});

test('Gaussian-separated fine ridges replace wide detail while preserving its broad illumination and chromaticity', () => {
  const frequency = Math.PI / 6, gaussianAttenuation = Math.exp(-.5 * (30 * frequency) ** 2);
  const reference = source(100, 80, detailMatrix, x => [1, 1, 1].map(() => 20 * (1 + .5 * Math.cos(frequency * x))) as Rgb,
    x => [1, 1, 1].map(() => 40 * (1 + .25 * Math.cos(frequency * x))) as Rgb);
  const lowReference = source(100, 80, detailMatrix, x => [1, 1, 1].map(() => 20 * (1 + .5 * gaussianAttenuation * Math.cos(frequency * x))) as Rgb,
    x => [1, 1, 1].map(() => 40 * (1 + .25 * gaussianAttenuation * Math.cos(frequency * x))) as Rgb);
  const wide = source(200, 200, wideMatrix, x => [80, 60, 40].map(v => v * (1 + .1 * Math.cos(frequency * x))) as Rgb,
    x => [100, 80, 60].map(v => v * (1 + .05 * Math.cos(frequency * x))) as Rgb);
  const lowWide = source(200, 200, wideMatrix, x => [80, 60, 40].map(v => v * (1 + .1 * gaussianAttenuation * Math.cos(frequency * x))) as Rgb,
    x => [100, 80, 60].map(v => v * (1 + .05 * gaussianAttenuation * Math.cos(frequency * x))) as Rgb);
  const composite = createOpticalComposite(withLow(reference, lowReference), withLow(wide, lowWide), bounds, { method: 'detail-fusion', featherArcsec: 30 });
  const rgb: Rgb = [0, 0, 0];
  composite.sampleRgb(0, 0, rgb); rgb.forEach((v, c) => close(v, [120, 90, 60][c]!));
  composite.sampleRgb(6, 0, rgb); rgb.forEach((v, c) => close(v, [40, 30, 20][c]!));
  composite.sampleOriginal(0, 0, rgb); rgb.forEach((v, c) => close(v, [125, 100, 75][c]!));
  const expected: Rgb = [0, 0, 0]; composite.sampleRgb(220, 0, rgb); wide.sampleRgb(220, 0, expected); assert.deepEqual(rgb, expected);
  composite.sampleRgb(120 - .001, 0, rgb); wide.sampleRgb(120 - .001, 0, expected);
  rgb.forEach((v, c) => close(v, expected[c]!, 1e-6));
});

test('detail fusion requires prepared low-pass inputs, bounds extreme detail, and keeps black distinct from missing coverage', () => {
  const ref = source(100, 80, detailMatrix, () => [255, 255, 255]);
  const refLow = source(100, 80, detailMatrix, () => [4, 4, 4]);
  const wide = source(200, 200, wideMatrix, x => x < 0 ? [0, 0, 0] : [200, 100, 50]);
  assert.throws(() => createOpticalComposite(ref, wide, bounds, { method: 'detail-fusion' }), /requires.*low-pass/);
  const composite = createOpticalComposite(withLow(ref, refLow), withLow(wide, wide), bounds, { method: 'detail-fusion' });
  const rgb: Rgb = [99, 99, 99];
  assert.equal(composite.sampleRgb(-20, 0, rgb), true); assert.deepEqual(rgb, [0, 0, 0]);
  assert.equal(composite.sampleRgb(20, 0, rgb), true); rgb.forEach((v, c) => close(v, [255, 127.5, 63.75][c]!));
  rgb.fill(99); assert.equal(composite.sampleRgb(400, 0, rgb), false); assert.deepEqual(rgb, [99, 99, 99]);
  const missingLow = { ...wide, sampleLowRgb: () => false, sampleLowOriginal: () => false };
  const fallback = createOpticalComposite(withLow(ref, refLow), missingLow, bounds, { method: 'detail-fusion' });
  fallback.sampleRgb(20, 0, rgb); assert.deepEqual(rgb, [200, 100, 50]);
  const noWide = source(200, 200, wideMatrix, () => [0, 0, 0], undefined, () => false);
  const referenceOnly = createOpticalComposite(withLow(ref, refLow), withLow(noWide, noWide), bounds, { method: 'detail-fusion' });
  assert.equal(referenceOnly.sampleRgb(0, 0, rgb), true); assert.deepEqual(rgb, [255, 255, 255]);
  assert.throws(() => createOpticalComposite(withLow(ref, refLow), withLow(wide, wide), bounds,
    { method: 'detail-fusion', detailRatioLimits: [0, 2] }), /Invalid/);
  for (let i = 0; i < 1000; i++) {
    const value = 170 + i * .08123;
    const fractional = source(200, 200, wideMatrix, () => [value, value / 2, value / 3]);
    const bounded = createOpticalComposite(withLow(ref, refLow), withLow(fractional, fractional), bounds, { method: 'detail-fusion' });
    bounded.sampleRgb(0, 0, rgb);
    assert.ok(rgb.every(v => v >= 0 && v <= 255), 'Fractional native samples must meet the strict material RGB boundary.');
  }
});
