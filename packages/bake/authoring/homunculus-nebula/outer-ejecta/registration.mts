/**
 * Image-to-image registration as scikit-image 0.26.0 does it, for the outer-ejecta chain:
 *
 * - `phaseCrossCorrelation`: skimage.registration.phase_cross_correlation with space 'real', normalization 'phase',
 *   no disambiguation and no masks (./hubble-epochs.mts ties each WFPC2 epoch to 2005 by the field stars' 31 x 31 windows,
 *   upsampled 20 times). The whole-pixel peak of the phase correlation, refined by a matrix-multiply DFT of the
 *   30 x 30 neighbourhood on the upsampled grid (Guizar-Sicairos et al. 2008).
 * - `matchTemplate`: skimage.feature.match_template with pad_input false (./hubble-motions.mts follows each 2.4 arcsec tile
 *   through the epochs): the normalized cross-correlation of the template with every window of the image that holds
 *   it whole.
 *
 * Both compute in double precision. scikit-image given the chain's single-precision arrays works in single
 * precision, so the two agree to that precision, not bit for bit: the tests state the measured agreement.
 */
import { fft2, ifft2, transformColumnsThenRows, transformRowsThenColumns, type Complex } from './python-ports/fft.mts';

/** Single precision's machine epsilon: below it, skimage leaves a window's correlation at zero (match_template on float32). */
export const FLOAT32_EPSILON = 2 ** -23;

/** Round half to even, as numpy.round does. */
function roundHalfEven(value: number): number {
  const floor = Math.floor(value), diff = value - floor;
  if (diff < 0.5) return floor;
  if (diff > 0.5) return floor + 1;
  return floor % 2 === 0 ? floor : floor + 1;
}

function checkImage(values: ArrayLike<number>, shape: readonly [number, number], name: string): void {
  const [rows, columns] = shape;
  if (!Number.isSafeInteger(rows) || !Number.isSafeInteger(columns) || rows < 1 || columns < 1) throw new RangeError(`${name}: shape ${JSON.stringify(shape)} is not two positive integers.`);
  if (values.length !== rows * columns) throw new RangeError(`${name}: ${values.length} values do not fill a ${rows} x ${columns} image.`);
}

/** numpy.fft.fftfreq(n, d): the sample frequencies of a length-n transform with spacing d. */
function fftFrequencies(n: number, d: number): Float64Array {
  const out = new Float64Array(n), positive = Math.floor((n - 1) / 2);
  for (let k = 0; k < n; k++) out[k] = (k <= positive ? k : k - n) / (d * n);
  return out;
}

/** The shift that registers `moving` on `reference` (rows, columns: where reference content sits in moving is at minus
 * the shift), the translation-invariant RMS error and the global phase difference. */
export interface PhaseCorrelation { shift: [number, number]; error: number; phaseDifference: number }

/**
 * skimage's phase_cross_correlation(reference, moving, upsample_factor) for real two-dimensional images of one shape.
 * Throws on a value that is not a number, as skimage does.
 */
export function phaseCrossCorrelation(reference: ArrayLike<number>, moving: ArrayLike<number>, shape: readonly [number, number], upsampleFactor = 1): PhaseCorrelation {
  checkImage(reference, shape, 'phaseCrossCorrelation reference'); checkImage(moving, shape, 'phaseCrossCorrelation moving');
  if (!Number.isFinite(upsampleFactor) || upsampleFactor < 1) throw new RangeError(`phaseCrossCorrelation: upsample factor ${upsampleFactor} is not at least 1.`);
  const [rows, columns] = shape, size = rows * columns;
  const source: Complex = { re: Float64Array.from(reference), im: new Float64Array(size) }, target: Complex = { re: Float64Array.from(moving), im: new Float64Array(size) };
  fft2(source, rows, columns); fft2(target, rows, columns);
  // The cross-power spectrum, each frequency scaled to unit amplitude (never divided by less than 100 epsilon).
  const product: Complex = { re: new Float64Array(size), im: new Float64Array(size) }, floor = 100 * Number.EPSILON;
  let sourceAmplitude = 0, targetAmplitude = 0;
  for (let i = 0; i < size; i++) {
    const ar = source.re[i]!, ai = source.im[i]!, br = target.re[i]!, bi = -target.im[i]!, pr = ar * br - ai * bi, pi = ar * bi + ai * br, scale = Math.max(Math.hypot(pr, pi), floor);
    product.re[i] = pr / scale; product.im[i] = pi / scale;
    sourceAmplitude += ar * ar + ai * ai; targetAmplitude += br * br + bi * bi;
  }
  const correlation: Complex = { re: Float64Array.from(product.re), im: Float64Array.from(product.im) };
  ifft2(correlation, rows, columns);
  let peak = 0, best = -1;
  for (let i = 0; i < size; i++) { const a = Math.hypot(correlation.re[i]!, correlation.im[i]!); if (a > best) { best = a; peak = i; } }
  if (!(best >= 0)) throw new RangeError('phaseCrossCorrelation: the images hold values that are not numbers.');
  const shift: [number, number] = [Math.floor(peak / columns), peak % columns];
  if (shift[0] > Math.trunc(rows / 2)) shift[0] -= rows;
  if (shift[1] > Math.trunc(columns / 2)) shift[1] -= columns;
  let peakRe: number, peakIm: number;
  if (upsampleFactor === 1) {
    peakRe = correlation.re[peak]!; peakIm = correlation.im[peak]!;
    sourceAmplitude /= size; targetAmplitude /= size;
  } else {
    // The upsampled DFT about the whole-pixel estimate: region of ceil(1.5 x factor) samples, its centre at dftshift.
    shift[0] = roundHalfEven(shift[0] * upsampleFactor) / upsampleFactor; shift[1] = roundHalfEven(shift[1] * upsampleFactor) / upsampleFactor;
    const region = Math.ceil(upsampleFactor * 1.5), dftShift = Math.trunc(region / 2), offsets = [dftShift - shift[0] * upsampleFactor, dftShift - shift[1] * upsampleFactor];
    const up = upsampledDft(product, rows, columns, region, upsampleFactor, offsets as [number, number]);
    let at = 0, top = -1;
    for (let i = 0; i < region * region; i++) { const a = Math.hypot(up.re[i]!, up.im[i]!); if (a > top) { top = a; at = i; } }
    peakRe = up.re[at]!; peakIm = up.im[at]!;
    shift[0] += (Math.floor(at / region) - dftShift) / upsampleFactor; shift[1] += (at % region - dftShift) / upsampleFactor;
  }
  if (rows === 1) shift[0] = 0;
  if (columns === 1) shift[1] = 0;
  if (!Number.isFinite(peakRe) || !Number.isFinite(sourceAmplitude) || !Number.isFinite(targetAmplitude)) throw new RangeError('phaseCrossCorrelation: the images hold values that are not numbers.');
  const error = Math.sqrt(Math.abs(1 - (peakRe * peakRe + peakIm * peakIm) / (sourceAmplitude * targetAmplitude)));
  return { shift, error, phaseDifference: Math.atan2(peakIm, peakRe) };
}

/**
 * skimage's _upsampled_dft as phase_cross_correlation calls it, conjugations included: for the cross-power spectrum
 * P (rows x columns), out[r][c] = sum over y, x of P[y][x] e^(2 pi i ((r - offsetRow) fy + (c - offsetColumn) fx)),
 * fy and fx the sample frequencies of each axis divided by the upsampling factor. Exported for its test.
 */
export function upsampledDft(product: Complex, rows: number, columns: number, region: number, factor: number, offsets: readonly [number, number]): Complex {
  const fy = fftFrequencies(rows, factor), fx = fftFrequencies(columns, factor);
  // First along columns: partial[y][c] = sum_x P[y][x] e^(2 pi i (c - oc) fx).
  const partRe = new Float64Array(rows * region), partIm = new Float64Array(rows * region);
  const kernel = (count: number, frequencies: Float64Array, offset: number) => {
    const re = new Float64Array(region * count), im = new Float64Array(region * count);
    for (let u = 0; u < region; u++) for (let k = 0; k < count; k++) { const angle = 2 * Math.PI * (u - offset) * frequencies[k]!; re[u * count + k] = Math.cos(angle); im[u * count + k] = Math.sin(angle); }
    return { re, im };
  };
  const kx = kernel(columns, fx, offsets[1]), ky = kernel(rows, fy, offsets[0]);
  for (let y = 0; y < rows; y++) for (let c = 0; c < region; c++) {
    let sr = 0, si = 0;
    for (let x = 0; x < columns; x++) { const pr = product.re[y * columns + x]!, pi = product.im[y * columns + x]!, kr = kx.re[c * columns + x]!, ki = kx.im[c * columns + x]!; sr += pr * kr - pi * ki; si += pr * ki + pi * kr; }
    partRe[y * region + c] = sr; partIm[y * region + c] = si;
  }
  const out: Complex = { re: new Float64Array(region * region), im: new Float64Array(region * region) };
  for (let r = 0; r < region; r++) for (let c = 0; c < region; c++) {
    let sr = 0, si = 0;
    for (let y = 0; y < rows; y++) { const pr = partRe[y * region + c]!, pi = partIm[y * region + c]!, kr = ky.re[r * rows + y]!, ki = ky.im[r * rows + y]!; sr += pr * kr - pi * ki; si += pr * ki + pi * kr; }
    out.re[r * region + c] = sr; out.im[r * region + c] = si;
  }
  return out;
}

interface CorrelationWork { size: number; work: Complex }
const workBySize = new Map<number, CorrelationWork>();
function workFor(rows: number, columns: number): CorrelationWork {
  let n = 1; while (n < Math.max(rows, columns)) n *= 2;
  let entry = workBySize.get(n);
  if (!entry) { entry = { size: n, work: { re: new Float64Array(n * n), im: new Float64Array(n * n) } }; workBySize.set(n, entry); }
  return entry;
}

/**
 * skimage's match_template(image, template) (pad_input false): for each placement of the template wholly inside the
 * image, (rows - templateRows + 1) x (columns - templateColumns + 1) of them, the correlation of the window with the
 * template less its mean, over the square roots of their sums of squares about their means. A window whose
 * denominator is not above `epsilon` (skimage: the working precision's epsilon, `FLOAT32_EPSILON` for the chain's
 * single-precision images) is left at zero.
 *
 * The cross-correlation is circular over a power-of-two square at least as large as the image, which wraps nothing a
 * valid window reads; the image and the template share one complex transform (image real, template imaginary).
 */
export function matchTemplate(image: ArrayLike<number>, imageShape: readonly [number, number], template: ArrayLike<number>, templateShape: readonly [number, number], epsilon = FLOAT32_EPSILON): Float64Array {
  checkImage(image, imageShape, 'matchTemplate image'); checkImage(template, templateShape, 'matchTemplate template');
  const [H, W] = imageShape, [h, w] = templateShape;
  if (h > H || w > W) throw new RangeError(`matchTemplate: a ${h} x ${w} template does not fit a ${H} x ${W} image.`);
  const outRows = H - h + 1, outColumns = W - w + 1, count = h * w;
  let templateSum = 0; for (let i = 0; i < count; i++) templateSum += template[i]!;
  const templateMean = templateSum / count;
  let templateSsd = 0; for (let i = 0; i < count; i++) { const d = template[i]! - templateMean; templateSsd += d * d; }
  // Window sums of the image and its square from summed-area tables.
  const area = new Float64Array((H + 1) * (W + 1)), area2 = new Float64Array((H + 1) * (W + 1));
  for (let y = 0; y < H; y++) { let s = 0, s2 = 0; for (let x = 0; x < W; x++) { const v = image[y * W + x]!; s += v; s2 += v * v; area[(y + 1) * (W + 1) + x + 1] = area[y * (W + 1) + x + 1]! + s; area2[(y + 1) * (W + 1) + x + 1] = area2[y * (W + 1) + x + 1]! + s2; } }
  // Cross-correlation: FFT(image + i template); split by conjugate symmetry; multiply image by the template's conjugate.
  const { size: n, work } = workFor(H, W), { re, im } = work;
  re.fill(0); im.fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) re[y * n + x] = image[y * W + x]!;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) im[y * n + x] = template[y * w + x]!;
  transformRowsThenColumns(work, n, n, 0, H);
  const pr = new Float64Array(n * n), pi = new Float64Array(n * n);
  for (let ky = 0; ky < n; ky++) for (let kx = 0; kx < n; kx++) {
    const k = ky * n + kx, m = ((n - ky) % n) * n + (n - kx) % n, zr = re[k]!, zi = im[k]!, cr = re[m]!, ci = -im[m]!;
    // A = (Z[k] + conj Z[-k]) / 2 (the image), B = (Z[k] - conj Z[-k]) / 2i (the template); the product A conj(B).
    const ar = (zr + cr) / 2, ai = (zi + ci) / 2, br = (zi - ci) / 2, bi = -(zr - cr) / 2;
    pr[k] = ar * br + ai * bi; pi[k] = ai * br - ar * bi;
  }
  re.set(pr); im.set(pi);
  // The inverse, unscaled here and divided below; only the rows of valid windows are needed.
  transformColumnsThenRows(work, n, n, 0, outRows, true);
  const scale = n * n;
  const out = new Float64Array(outRows * outColumns);
  for (let y = 0; y < outRows; y++) for (let x = 0; x < outColumns; x++) {
    const a = (y + h) * (W + 1) + x + w, b = y * (W + 1) + x + w, c = (y + h) * (W + 1) + x, d = y * (W + 1) + x;
    const sum = area[a]! - area[b]! - area[c]! + area[d]!, sum2 = area2[a]! - area2[b]! - area2[c]! + area2[d]!;
    const numerator = re[y * n + x]! / scale - sum * templateMean, denominator = Math.sqrt(Math.max((sum2 - sum * sum / count) * templateSsd, 0));
    out[y * outColumns + x] = denominator > epsilon ? numerator / denominator : 0;
  }
  return out;
}
