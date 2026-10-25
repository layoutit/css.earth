import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fft2, ifft2 } from './python-ports/fft.mts';
import { FLOAT32_EPSILON, matchTemplate, phaseCrossCorrelation } from './registration.mts';

/**
 * scikit-image 0.26.0 on double-precision inputs built from the formulas below (the scratch venv):
 * - match_template of a 60 x 70 image sin(0.21 x) cos(0.17 y) + 0.5 exp(-((y-40)^2 + (x-45)^2) / 20), its first 20
 *   rows by 25 columns set to zero, with the 12 x 15 template cut at rows 33-44, columns 38-52 of the same field moved
 *   by (-0.3, +0.4): every 97th response, the sum, the zero count and the peak;
 * - phase_cross_correlation(a, b, upsample_factor=20) of a 31 x 31 scene and (whole) the scene rolled by (3, -2) plus
 *   a faint ripple, also unsampled; (subpixel) the scene moved by (2.35, -1.6) through its Fourier transform.
 * [shift, error, phase difference].
 */
const SKIMAGE_MATCH = { shape: [49, 56] as const, zeros: 99, sum: 8.143790476451157, argmax: 1887, samples: [[0, 0.0], [97, 0.6325692793160976], [194, -0.31572542770837], [291, -0.07876054227643285], [388, 0.4489643886990198], [485, -0.743770542715206], [582, 0.7436194453987165], [679, -0.4452967309546592], [776, 0.8581273620281371], [873, -0.7933130976855088], [970, 0.5059178943536461], [1067, -0.3998121184107732], [1164, -0.2771188798977616], [1261, 0.16453769942378413], [1358, -0.035607426646509066], [1455, -0.4274698285728346], [1552, 0.7137726915534569], [1649, -0.8413186975499065], [1746, 0.917804952828296], [1843, -0.9817118089555984], [1940, 0.9162595777348722], [2037, -0.8555578036533974], [2134, 0.6304317057485869], [2231, 0.01324271800078553], [2328, -0.2498860269179914], [2425, 0.3049308663586317], [2522, -0.47544381287299886], [2619, -0.41068384541511466], [2716, 0.5777628123582814]] as [number, number][] };
const SKIMAGE_PHASE = { whole: [[-3.0, 2.0], 0.9995133544215141, 5.730285078531697e-18], wholeUnsampled: [[-3.0, 2.0], 0.9995133544215141, 0.0], subpixel: [[-2.35, 1.6], 0.9994818653100335, -1.4162650926918148e-17] };

const field = (y: number, x: number) => Math.sin(0.21 * x) * Math.cos(0.17 * y) + 0.5 * Math.exp(-((y - 40) ** 2 + (x - 45) ** 2) / 20);
function matchInputs() {
  const image = new Float64Array(60 * 70), template = new Float64Array(12 * 15);
  for (let y = 0; y < 60; y++) for (let x = 0; x < 70; x++) image[y * 70 + x] = y < 20 && x < 25 ? 0 : field(y, x);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 15; x++) template[y * 15 + x] = field(y + 33 - 0.3, x + 38 + 0.4);
  return { image, template };
}

test('matchTemplate matches skimage.feature.match_template', () => {
  const { image, template } = matchInputs(), out = matchTemplate(image, [60, 70], template, [12, 15], Number.EPSILON);
  assert.equal(out.length, SKIMAGE_MATCH.shape[0] * SKIMAGE_MATCH.shape[1]);
  for (const [index, value] of SKIMAGE_MATCH.samples) assert.ok(Math.abs(out[index]! - value) < 1e-10, `response ${index}: ${out[index]} against ${value}`);
  let sum = 0, zeros = 0, peak = 0; out.forEach((value, i) => { sum += value; if (value === 0) zeros++; if (value > out[peak]!) peak = i; });
  assert.ok(Math.abs(sum - SKIMAGE_MATCH.sum) < 1e-8);
  // Windows wholly inside the zeroed corner have no spread: skimage leaves them at zero rather than dividing by it.
  assert.equal(zeros, SKIMAGE_MATCH.zeros);
  assert.equal(peak, SKIMAGE_MATCH.argmax);
});

test('matchTemplate leaves at zero a window whose spread is not above epsilon', () => {
  const image = Float64Array.from({ length: 100 }, (_, i) => 1e-8 * ((i * 7) % 5)), template = Float64Array.from({ length: 9 }, (_, i) => i % 2);
  const loose = matchTemplate(image, [10, 10], template, [3, 3], FLOAT32_EPSILON), tight = matchTemplate(image, [10, 10], template, [3, 3], Number.EPSILON);
  assert.ok(loose.every(value => Number.isFinite(value)));
  assert.ok(loose.every(value => value === 0), "every window here is flatter than single precision resolves");
  assert.ok(tight.every(value => value !== 0 && Math.abs(value) <= 1 + 1e-9), "in double precision each window has a correlation");
  assert.throws(() => matchTemplate(image, [10, 10], new Float64Array(121), [11, 11]), RangeError);
  assert.throws(() => matchTemplate(image, [10, 9], template, [3, 3]), RangeError);
});

const scene = (y: number, x: number) => Math.exp(-((y - 14) ** 2 + (x - 16) ** 2) / 6) + 0.6 * Math.exp(-((y - 8) ** 2 + (x - 22) ** 2) / 3) + 0.3 * Math.sin(0.4 * x) * Math.cos(0.3 * y);
function phaseInputs() {
  const a = new Float64Array(961), rolled = new Float64Array(961);
  for (let y = 0; y < 31; y++) for (let x = 0; x < 31; x++) a[y * 31 + x] = scene(y, x);
  for (let y = 0; y < 31; y++) for (let x = 0; x < 31; x++) rolled[y * 31 + x] = a[((y - 3 + 31) % 31) * 31 + (x + 2) % 31]! + 0.02 * Math.cos(0.9 * x + 0.4 * y);
  // The scene moved by (2.35, -1.6) through its Fourier transform (numpy.fft.fftfreq frequencies).
  const freq = (k: number) => (k <= 15 ? k : k - 31) / 31, moved = { re: Float64Array.from(a), im: new Float64Array(961) };
  fft2(moved, 31, 31);
  for (let y = 0; y < 31; y++) for (let x = 0; x < 31; x++) { const i = y * 31 + x, angle = -2 * Math.PI * (freq(y) * 2.35 + freq(x) * -1.6), c = Math.cos(angle), s = Math.sin(angle), r = moved.re[i]!, m = moved.im[i]!; moved.re[i] = r * c - m * s; moved.im[i] = r * s + m * c; }
  ifft2(moved, 31, 31);
  return { a, rolled, moved: moved.re };
}

test('phaseCrossCorrelation matches skimage.registration.phase_cross_correlation', () => {
  const { a, rolled, moved } = phaseInputs();
  for (const [got, [shift, error, phase]] of [[phaseCrossCorrelation(a, rolled, [31, 31], 20), SKIMAGE_PHASE.whole], [phaseCrossCorrelation(a, rolled, [31, 31]), SKIMAGE_PHASE.wholeUnsampled], [phaseCrossCorrelation(a, moved, [31, 31], 20), SKIMAGE_PHASE.subpixel]] as const) {
    assert.ok(Math.abs(got.shift[0] - (shift as number[])[0]!) < 1e-12 && Math.abs(got.shift[1] - (shift as number[])[1]!) < 1e-12, `shift ${got.shift} against ${shift}`);
    assert.ok(Math.abs(got.error - (error as number)) < 1e-9, `error ${got.error} against ${error}`);
    assert.ok(Math.abs(got.phaseDifference - (phase as number)) < 1e-9);
  }
  assert.throws(() => phaseCrossCorrelation(a, new Float64Array(960), [31, 31], 20), RangeError);
  assert.throws(() => phaseCrossCorrelation(a, Float64Array.from(a, (v, i) => i === 5 ? Number.NaN : v), [31, 31], 20), RangeError);
});
