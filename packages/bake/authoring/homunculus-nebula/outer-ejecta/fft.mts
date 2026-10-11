/**
 * The discrete Fourier transform of complex data of any length, in one and two dimensions, with numpy's conventions:
 * the forward transform sums x[n] e^(-2 pi i k n / N) unscaled and the inverse divides by N. A length that is a power
 * of two takes the radix-2 transform; any other length is turned into one by Bluestein's chirp (a convolution of
 * power-of-two length). Each length's twiddles and chirp are kept for reuse, since the outer-ejecta registration
 * transforms thousands of windows of a few sizes.
 *
 * A complex array is a pair of Float64Arrays (`re`, `im`); a two-dimensional one is row-major, `rows` by `columns`.
 */

/** A complex array: real and imaginary parts of equal length. */
export interface Complex { re: Float64Array; im: Float64Array }

interface Radix2Plan { kind: 'radix2'; n: number; reverse: Uint32Array; cos: Float64Array; sin: Float64Array }
interface BluesteinPlan { kind: 'bluestein'; n: number; m: number; inner: Radix2Plan; chirpRe: Float64Array; chirpIm: Float64Array; kernelRe: Float64Array; kernelIm: Float64Array; workRe: Float64Array; workIm: Float64Array }
type Plan = Radix2Plan | BluesteinPlan;
const plans = new Map<number, Plan>();

function radix2Plan(n: number): Radix2Plan {
  const bits = Math.round(Math.log2(n)), reverse = new Uint32Array(n), cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
  for (let i = 0; i < n; i++) { let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); reverse[i] = r; }
  for (let k = 0; k < n / 2; k++) { const angle = -2 * Math.PI * k / n; cos[k] = Math.cos(angle); sin[k] = Math.sin(angle); }
  return { kind: 'radix2', n, reverse, cos, sin };
}

function planFor(n: number): Plan {
  let plan = plans.get(n);
  if (plan) return plan;
  if ((n & (n - 1)) === 0) plan = radix2Plan(n);
  else {
    // Bluestein: X[k] = conj(w[k]) * sum_n (x[n] conj(w[n])) w[k - n], w[j] = e^(i pi j^2 / N), as a circular
    // convolution of length m >= 2N - 1. The chirp's angle takes j^2 mod 2N so that it stays exact for large j.
    let m = 1; while (m < 2 * n - 1) m *= 2;
    const inner = radix2Plan(m), chirpRe = new Float64Array(n), chirpIm = new Float64Array(n), kernelRe = new Float64Array(m), kernelIm = new Float64Array(m);
    for (let j = 0; j < n; j++) { const angle = Math.PI * ((j * j) % (2 * n)) / n; chirpRe[j] = Math.cos(angle); chirpIm[j] = Math.sin(angle); }
    kernelRe[0] = chirpRe[0]!; kernelIm[0] = chirpIm[0]!;
    for (let j = 1; j < n; j++) { kernelRe[j] = kernelRe[m - j] = chirpRe[j]!; kernelIm[j] = kernelIm[m - j] = chirpIm[j]!; }
    transformRadix2(inner, kernelRe, kernelIm, 0, 1);
    plan = { kind: 'bluestein', n, m, inner, chirpRe, chirpIm, kernelRe, kernelIm, workRe: new Float64Array(m), workIm: new Float64Array(m) };
  }
  plans.set(n, plan);
  return plan;
}

/** In-place forward radix-2 transform of `plan.n` values starting at `offset`, `stride` apart. */
function transformRadix2(plan: Radix2Plan, re: Float64Array, im: Float64Array, offset: number, stride: number): void {
  const { n, reverse, cos, sin } = plan;
  for (let i = 0; i < n; i++) { const j = reverse[i]!; if (j > i) { const a = offset + i * stride, b = offset + j * stride; let t = re[a]!; re[a] = re[b]!; re[b] = t; t = im[a]!; im[a] = im[b]!; im[b] = t; } }
  for (let size = 2; size <= n; size *= 2) {
    const half = size / 2, step = n / size;
    for (let start = 0; start < n; start += size) for (let k = 0; k < half; k++) {
      const wr = cos[k * step]!, wi = sin[k * step]!, a = offset + (start + k) * stride, b = a + half * stride;
      const xr = re[b]! * wr - im[b]! * wi, xi = re[b]! * wi + im[b]! * wr;
      re[b] = re[a]! - xr; im[b] = im[a]! - xi; re[a] = re[a]! + xr; im[a] = im[a]! + xi;
    }
  }
}

/** In-place forward transform of `n` values starting at `offset`, `stride` apart, through the plan for `n`. */
function transformStrided(re: Float64Array, im: Float64Array, n: number, offset: number, stride: number): void {
  const plan = planFor(n);
  if (plan.kind === 'radix2') { transformRadix2(plan, re, im, offset, stride); return; }
  const { m, chirpRe, chirpIm, kernelRe, kernelIm, workRe, workIm, inner } = plan;
  workRe.fill(0); workIm.fill(0);
  for (let j = 0; j < n; j++) { const xr = re[offset + j * stride]!, xi = im[offset + j * stride]!, cr = chirpRe[j]!, ci = -chirpIm[j]!; workRe[j] = xr * cr - xi * ci; workIm[j] = xr * ci + xi * cr; }
  transformRadix2(inner, workRe, workIm, 0, 1);
  for (let k = 0; k < m; k++) { const ar = workRe[k]!, ai = workIm[k]!, br = kernelRe[k]!, bi = kernelIm[k]!; workRe[k] = ar * br - ai * bi; workIm[k] = ar * bi + ai * br; }
  // The inverse of the convolution: conjugate, forward transform, conjugate, divide by m.
  for (let k = 0; k < m; k++) workIm[k] = -workIm[k]!;
  transformRadix2(inner, workRe, workIm, 0, 1);
  for (let k = 0; k < n; k++) { const ar = workRe[k]! / m, ai = -workIm[k]! / m, cr = chirpRe[k]!, ci = -chirpIm[k]!; re[offset + k * stride] = ar * cr - ai * ci; im[offset + k * stride] = ar * ci + ai * cr; }
}

function checkComplex(data: Complex, length: number, name: string): void {
  if (!(data.re instanceof Float64Array) || !(data.im instanceof Float64Array) || data.re.length !== length || data.im.length !== length)
    throw new TypeError(`${name}: expected real and imaginary Float64Arrays of length ${length}.`);
}
function checkLength(n: number, name: string): void { if (!Number.isSafeInteger(n) || n < 1) throw new RangeError(`${name}: a transform length must be a positive integer, got ${n}.`); }

/** The forward transform of a complex vector, in place (numpy.fft.fft). */
export function fft(data: Complex): Complex {
  const n = data.re.length; checkLength(n, 'fft'); checkComplex(data, n, 'fft');
  transformStrided(data.re, data.im, n, 0, 1);
  return data;
}
/** The inverse transform of a complex vector, in place, divided by its length (numpy.fft.ifft). */
export function ifft(data: Complex): Complex {
  const n = data.re.length; checkLength(n, 'ifft'); checkComplex(data, n, 'ifft');
  for (let i = 0; i < n; i++) data.im[i] = -data.im[i]!;
  transformStrided(data.re, data.im, n, 0, 1);
  for (let i = 0; i < n; i++) { data.re[i] = data.re[i]! / n; data.im[i] = -data.im[i]! / n; }
  return data;
}

const scratch = { re: new Float64Array(0), im: new Float64Array(0) };
function checkRange(data: Complex, rows: number, columns: number, rowFrom: number, rowTo: number, name: string): void {
  checkLength(rows, name); checkLength(columns, name); checkComplex(data, rows * columns, name);
  if (!Number.isSafeInteger(rowFrom) || !Number.isSafeInteger(rowTo) || rowFrom < 0 || rowTo > rows || rowFrom > rowTo) throw new RangeError(`${name}: rows ${rowFrom} to ${rowTo} are not within ${rows}.`);
}
/** Each row in [rowFrom, rowTo) transformed in place; `inverse` gives the unscaled inverse (conjugate either side). */
function transformRows(data: Complex, columns: number, rowFrom: number, rowTo: number, inverse: boolean): void {
  const { re, im } = data;
  for (let r = rowFrom; r < rowTo; r++) {
    if (inverse) for (let c = 0; c < columns; c++) im[r * columns + c] = -im[r * columns + c]!;
    transformStrided(re, im, columns, r * columns, 1);
    if (inverse) for (let c = 0; c < columns; c++) im[r * columns + c] = -im[r * columns + c]!;
  }
}
/** Every column transformed in place, gathered into a contiguous buffer for its transform. */
function transformColumns(data: Complex, rows: number, columns: number, inverse: boolean): void {
  const { re, im } = data, sign = inverse ? -1 : 1;
  if (scratch.re.length < rows) { scratch.re = new Float64Array(rows); scratch.im = new Float64Array(rows); }
  const sr = scratch.re, si = scratch.im;
  for (let c = 0; c < columns; c++) {
    for (let r = 0; r < rows; r++) { sr[r] = re[r * columns + c]!; si[r] = sign * im[r * columns + c]!; }
    transformStrided(sr, si, rows, 0, 1);
    for (let r = 0; r < rows; r++) { re[r * columns + c] = sr[r]!; im[r * columns + c] = sign * si[r]!; }
  }
}
/**
 * The two-dimensional transform of a row-major complex array, in place, unscaled (`inverse` conjugates the kernel):
 * the rows `rowFrom` to `rowTo` (exclusive) first, then every column. Rows outside the range must be zero already
 * (a zero row transforms to zero), which lets a zero-padded correlation skip them.
 */
export function transformRowsThenColumns(data: Complex, rows: number, columns: number, rowFrom = 0, rowTo = rows, inverse = false): void {
  checkRange(data, rows, columns, rowFrom, rowTo, 'transformRowsThenColumns');
  transformRows(data, columns, rowFrom, rowTo, inverse); transformColumns(data, rows, columns, inverse);
}
/**
 * The two-dimensional transform the other way round: every column, then only the rows `rowFrom` to `rowTo`
 * (exclusive); the other rows hold their column transforms only. For a correlation that reads only some rows back.
 */
export function transformColumnsThenRows(data: Complex, rows: number, columns: number, rowFrom = 0, rowTo = rows, inverse = false): void {
  checkRange(data, rows, columns, rowFrom, rowTo, 'transformColumnsThenRows');
  transformColumns(data, rows, columns, inverse); transformRows(data, columns, rowFrom, rowTo, inverse);
}

/** The forward transform of a row-major `rows` x `columns` complex array, in place (numpy.fft.fft2). */
export function fft2(data: Complex, rows: number, columns: number): Complex {
  transformRowsThenColumns(data, rows, columns);
  return data;
}
/** The inverse transform of a row-major `rows` x `columns` complex array, in place, divided by its size (numpy.fft.ifft2). */
export function ifft2(data: Complex, rows: number, columns: number): Complex {
  transformRowsThenColumns(data, rows, columns, 0, rows, true);
  const size = rows * columns;
  for (let i = 0; i < size; i++) { data.re[i] = data.re[i]! / size; data.im[i] = data.im[i]! / size; }
  return data;
}

/** A complex array of `length` zeros, or a copy of real values with a zero imaginary part. */
export function complexOf(values: ArrayLike<number> | number): Complex {
  if (typeof values === 'number') { checkLength(values, 'complexOf'); return { re: new Float64Array(values), im: new Float64Array(values) }; }
  return { re: Float64Array.from(values), im: new Float64Array(values.length) };
}
