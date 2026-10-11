/**
 * The image filters and resampling of the outer-ejecta chain, as scipy.ndimage 1.18.1 and numpy.gradient compute
 * them. Each follows scipy's C code
 * (`scipy/ndimage/src/ni_filters.c`, `ni_interpolation.c`, `ni_splines.c`, `ni_support.c`): the same kernel, the same
 * order of additions and the same edge rules, so a filter gives scipy's bits wherever JavaScript's `Math.exp` agrees
 * with the platform's (the Gaussian's weights are its only transcendental step).
 *
 * Arrays are row-major typed arrays with their numpy shape (the last axis fastest). As in scipy, a filter's output has
 * its input's type, and a 32-bit input is rounded to 32 bits after each axis's pass. Masks are `Uint8Array`s of 0 and 1.
 *
 * Modes, as scipy names them, for what lies past an edge: `reflect` (d c b a | a b c d | d c b a), `mirror`
 * (d c b | a b c d | c b a), `nearest` (a a a | a b c d | d d d), `wrap` (a b c d | a b c d | a b c d) and `constant`
 * (k k k | a b c d | k k k).
 */

export type Mode = 'reflect' | 'mirror' | 'nearest' | 'wrap' | 'constant';
export type Values = Float32Array | Float64Array;

function size(shape: readonly number[]): number {
  if (!shape.length || shape.some(n => !Number.isSafeInteger(n) || n < 1)) throw new TypeError(`${JSON.stringify(shape)} is not an array shape.`);
  return shape.reduce((a, b) => a * b, 1);
}
function checked(values: ArrayLike<number>, shape: readonly number[]): void {
  if (values.length !== size(shape)) throw new TypeError(`An array of ${values.length} values does not have the shape ${JSON.stringify(shape)}.`);
}
function perAxis(value: number | readonly number[], shape: readonly number[], name: string): number[] {
  const list = typeof value === 'number' ? shape.map(() => value) : [...value];
  if (list.length !== shape.length || list.some(v => !Number.isFinite(v) || v < 0)) throw new TypeError(`${name} ${JSON.stringify(value)} does not fit the shape ${JSON.stringify(shape)}.`);
  return list;
}
const like = <T extends Values>(values: T): T => (values instanceof Float32Array ? new Float32Array(values.length) : new Float64Array(values.length)) as T;

/** Calls `line(start, stride, length)` for every line of the array along `axis`. */
function eachLine(shape: readonly number[], axis: number, line: (start: number, stride: number, length: number) => void): void {
  const length = shape[axis]!, stride = shape.slice(axis + 1).reduce((a, b) => a * b, 1), outer = shape.slice(0, axis).reduce((a, b) => a * b, 1);
  for (let o = 0; o < outer; o++) for (let i = 0; i < stride; i++) line(o * length * stride + i, stride, length);
}

/** A line copied into `buffer` after `before` places and extended past both ends as NI_ExtendLine extends it. */
function extendLine(buffer: Float64Array, values: ArrayLike<number>, start: number, stride: number, length: number, before: number, after: number, mode: Mode, cval: number): void {
  for (let k = 0; k < length; k++) buffer[before + k] = values[start + k * stride]!;
  const first = before, last = before + length;
  if (length === 1 && mode === 'mirror') mode = 'nearest';
  let src: number, dst: number, b = before, a = after;
  switch (mode) {
    case 'nearest':
      for (dst = 0; b-- > 0;) buffer[dst++] = buffer[first]!;
      for (dst = last; a-- > 0;) buffer[dst++] = buffer[last - 1]!;
      break;
    case 'wrap':
      for (src = last - 1, dst = first - 1; b-- > 0;) buffer[dst--] = buffer[src--]!;
      for (src = first, dst = last; a-- > 0;) buffer[dst++] = buffer[src++]!;
      break;
    case 'reflect':
      for (src = first, dst = first - 1; b && src < last; b--) buffer[dst--] = buffer[src++]!;
      for (src = last - 1; b-- > 0;) buffer[dst--] = buffer[src--]!;
      for (src = last - 1, dst = last; a && src >= first; a--) buffer[dst++] = buffer[src--]!;
      for (src = first; a-- > 0;) buffer[dst++] = buffer[src++]!;
      break;
    case 'mirror':
      for (src = first + 1, dst = first - 1; b && src < last; b--) buffer[dst--] = buffer[src++]!;
      for (src = last - 2; b-- > 0;) buffer[dst--] = buffer[src--]!;
      for (src = last - 2, dst = last; a && src >= first; a--) buffer[dst++] = buffer[src--]!;
      for (src = first + 1; a-- > 0;) buffer[dst++] = buffer[src++]!;
      break;
    case 'constant':
      for (dst = 0; b-- > 0;) buffer[dst++] = cval;
      for (dst = last; a-- > 0;) buffer[dst++] = cval;
      break;
    default: throw new TypeError(`Unknown mode ${String(mode)}.`);
  }
}

/** Error-free transformations: a + b and a · b as a rounded value and its exact error (Knuth; Dekker with Veltkamp's split). */
function twoSum(a: number, b: number): [number, number] { const s = a + b, bb = s - a; return [s, (a - (s - bb)) + (b - bb)]; }
function twoProduct(a: number, b: number): [number, number] {
  const p = a * b, ca = 134217729 * a, ah = ca - (ca - a), al = a - ah, cb = 134217729 * b, bh = cb - (cb - b), bl = b - bh;
  return [p, ((ah * bh - p) + ah * bl + al * bh) + al * bl];
}
const BITS = new Float64Array(1), WORD = new BigInt64Array(BITS.buffer);
/**
 * a · b + c rounded once, as a fused multiply-add gives it. scipy's C is compiled with floating-point contraction (clang
 * on arm64), so `x += a * b` in its filters and affine coordinates is one fused operation; this matches it. The exact
 * product's error and the sum's error are added with round-to-odd before the last rounding (Boldo and Melquiond 2008),
 * which makes the result correctly rounded.
 */
export function fusedMultiplyAdd(a: number, b: number, c: number): number {
  const [p, e] = twoProduct(a, b), [s, t] = twoSum(p, c), [v, err] = twoSum(t, e);
  if (err === 0 || v === 0 || !Number.isFinite(s)) return s + (v + err);
  BITS[0] = v; if ((WORD[0]! & 1n) === 0n) WORD[0] = WORD[0]! + ((v > 0) === (err > 0) ? 1n : -1n);
  return s + BITS[0]!;
}
/** e^x correctly rounded (double-double range reduction and Taylor series). The Gaussian's weights need it: numpy's
 * exp is the platform's libm, which on this machine agreed with this on every kernel weight tested, while V8's
 * `Math.exp` differed in the last bit on 4% of them. */
export function exp(x: number): number {
  if (!Number.isFinite(x) || x === 0 || x < -700 || x > 700) return Math.exp(x);
  const LN2_HI = 0.6931471805599453, LN2_LO = 2.3190468138462996e-17, k = Math.round(x / LN2_HI), [ph, pl] = twoProduct(k, LN2_HI);
  const add = (a: [number, number], b: [number, number]): [number, number] => { const [s, e] = twoSum(a[0], b[0]); return twoSum(s, e + a[1] + b[1]); };
  const r = add(add([x, 0], [-ph, -pl]), [-k * LN2_LO, 0]);
  let term: [number, number] = [1, 0], sum: [number, number] = [1, 0];
  for (let n = 1; n < 40; n++) {
    const [p, e] = twoProduct(term[0], r[0]), product = twoSum(p, e + term[0] * r[1] + term[1] * r[0]);
    const q = product[0] / n, [qp, qe] = twoProduct(q, n); term = twoSum(q, (product[0] - qp - qe + product[1]) / n);
    sum = add(sum, term); if (Math.abs(term[0]) < 1e-40) break;
  }
  return (sum[0] + sum[1]) * 2 ** k;
}

/** numpy's pairwise sum of a float64 array (`np.sum`): eight running sums over blocks of up to 128, halves above that. */
export function pairwiseSum(values: ArrayLike<number>, start = 0, n = values.length - start): number {
  if (n < 8) { let res = 0; for (let i = 0; i < n; i++) res += values[start + i]!; return res; }
  if (n <= 128) {
    const r = [0, 1, 2, 3, 4, 5, 6, 7].map(j => values[start + j]!); let i = 8;
    for (; i < n - (n % 8); i += 8) for (let j = 0; j < 8; j++) r[j]! += values[start + i + j]!;
    let res = ((r[0]! + r[1]!) + (r[2]! + r[3]!)) + ((r[4]! + r[5]!) + (r[6]! + r[7]!));
    for (; i < n; i++) res += values[start + i]!;
    return res;
  }
  let n2 = Math.floor(n / 2); n2 -= n2 % 8;
  return pairwiseSum(values, start, n2) + pairwiseSum(values, start + n2, n - n2);
}

/** scipy's Gaussian kernel (`_gaussian_kernel1d`, order 0): exp(-x²/2σ²) over x = -radius..radius, over its pairwise sum. */
export function gaussianKernel(sigma: number, radius: number): Float64Array {
  const factor = -0.5 / (sigma * sigma), phi = Float64Array.from({ length: 2 * radius + 1 }, (_, k) => exp(factor * (k - radius) ** 2)), total = pairwiseSum(phi);
  return phi.map(v => v / total);
}

/** One correlation pass along an axis (NI_Correlate1D), `fw` centred, each `t += value · weight` fused or not as
 * scipy's compiled loop does it; written into `out`. The antisymmetric and general loops (unused here) are taken as
 * fused throughout, unmeasured. */
function correlate1d(input: ArrayLike<number>, out: Values, shape: readonly number[], axis: number, weights: Float64Array, mode: Mode, cval: number): void {
  const filterSize = weights.length, size1 = filterSize >> 1, size2 = filterSize - size1 - 1;
  let symmetric = 0;
  if (filterSize & 1) {
    symmetric = 1;
    for (let i = 1; i <= size1; i++) if (Math.abs(weights[i + size1]! - weights[size1 - i]!) > Number.EPSILON) { symmetric = 0; break; }
    if (!symmetric) { symmetric = -1; for (let i = 1; i <= size1; i++) if (Math.abs(weights[size1 + i]! + weights[size1 - i]!) > Number.EPSILON) { symmetric = 0; break; } }
  }
  // How scipy's compiled symmetric loop adds (measured on the macOS arm64 wheel of scipy 1.18.1):
  // from 10 terms a side, the first multiple of 8 are a vector body of separate multiplies and in-order adds, and the
  // rest scalar fused multiply-adds; below 10, all fused.
  const plain = size1 >= 10 ? size1 - size1 % 8 : 0;
  const length = shape[axis]!, buffer = new Float64Array(length + size1 + size2), line = new Float64Array(length), fw = (j: number) => weights[size1 + j]!;
  eachLine(shape, axis, (start, stride) => {
    extendLine(buffer, input, start, stride, length, size1, size2, mode, cval);
    for (let l = 0; l < length; l++) {
      const c = l + size1; let t: number;
      if (symmetric > 0) { t = buffer[c]! * fw(0); for (let j = -size1; j < 0; j++) t = j < plain - size1 ? t + (buffer[c + j]! + buffer[c - j]!) * fw(j) : fusedMultiplyAdd(buffer[c + j]! + buffer[c - j]!, fw(j), t); }
      else if (symmetric < 0) { t = buffer[c]! * fw(0); for (let j = -size1; j < 0; j++) t = fusedMultiplyAdd(buffer[c + j]! - buffer[c - j]!, fw(j), t); }
      else { t = buffer[c + size2]! * fw(size2); for (let j = -size1; j < size2; j++) t = fusedMultiplyAdd(buffer[c + j]!, fw(j), t); }
      line[l] = t;
    }
    for (let l = 0; l < length; l++) out[start + l * stride] = line[l]!;
  });
}

/** scipy's `gaussian_filter`: one pass per axis whose sigma is above 1e-15, each to `truncate` sigmas (radius
 * int(truncate·σ + 0.5)). */
export function gaussianFilter<T extends Values>(values: T, shape: readonly number[], sigma: number | readonly number[], options: { mode?: Mode; truncate?: number; cval?: number } = {}): T {
  checked(values, shape);
  const sigmas = perAxis(sigma, shape, 'sigma'), { mode = 'reflect', truncate = 4, cval = 0 } = options, out = like(values);
  let input: ArrayLike<number> = values, passed = false;
  for (let axis = 0; axis < shape.length; axis++) {
    const s = sigmas[axis]!; if (!(s > 1e-15)) continue;
    correlate1d(input, out, shape, axis, gaussianKernel(s, Math.trunc(truncate * s + 0.5)).reverse(), mode, cval); input = out; passed = true;
  }
  if (!passed) out.set(values);
  return out;
}

/** scipy's `uniform_filter`: per axis of size above 1, the running mean of NI_UniformFilter1D (the window's sum
 * carried along the line, each place the sum over the size). */
export function uniformFilter<T extends Values>(values: T, shape: readonly number[], filterSize: number | readonly number[], options: { mode?: Mode; cval?: number } = {}): T {
  checked(values, shape);
  const sizes = perAxis(filterSize, shape, 'size'), { mode = 'reflect', cval = 0 } = options, out = like(values);
  let input: ArrayLike<number> = values, passed = false;
  for (let axis = 0; axis < shape.length; axis++) {
    const n = Math.trunc(sizes[axis]!); if (n <= 1) continue;
    const size1 = n >> 1, size2 = n - size1 - 1, length = shape[axis]!, buffer = new Float64Array(length + n - 1), line = new Float64Array(length);
    eachLine(shape, axis, (start, stride) => {
      extendLine(buffer, input, start, stride, length, size1, size2, mode, cval);
      let t = 0; for (let l = 0; l < n; l++) t += buffer[l]!;
      line[0] = t / n;
      for (let l = 1; l < length; l++) { t += buffer[l + n - 1]! - buffer[l - 1]!; line[l] = t / n; }
      for (let l = 0; l < length; l++) out[start + l * stride] = line[l]!;
    });
    input = out; passed = true;
  }
  if (!passed) out.set(values);
  return out;
}

/** scipy's `maximum_filter` with a box: the largest value in the window, axis by axis (exact; not for NaN). */
export function maximumFilter<T extends Values>(values: T, shape: readonly number[], filterSize: number | readonly number[], options: { mode?: Mode; cval?: number } = {}): T {
  checked(values, shape);
  const sizes = perAxis(filterSize, shape, 'size'), { mode = 'reflect', cval = 0 } = options, out = like(values);
  let input: ArrayLike<number> = values, passed = false;
  for (let axis = 0; axis < shape.length; axis++) {
    const n = Math.trunc(sizes[axis]!); if (n <= 1) continue;
    const size1 = n >> 1, size2 = n - size1 - 1, length = shape[axis]!, buffer = new Float64Array(length + n - 1), line = new Float64Array(length);
    eachLine(shape, axis, (start, stride) => {
      extendLine(buffer, input, start, stride, length, size1, size2, mode, cval);
      for (let l = 0; l < length; l++) { let m = buffer[l]!; for (let k = 1; k < n; k++) if (buffer[l + k]! > m) m = buffer[l + k]!; line[l] = m; }
      for (let l = 0; l < length; l++) out[start + l * stride] = line[l]!;
    });
    input = out; passed = true;
  }
  if (!passed) out.set(values);
  return out;
}

/** Where index `i` of a line of `n` reads from under `mode` (-1 for the constant). */
function extendIndex(i: number, n: number, mode: Mode): number {
  if (i >= 0 && i < n) return i;
  if (mode === 'constant') return -1;
  if (mode === 'nearest' || n === 1) return i < 0 ? 0 : n - 1;
  if (mode === 'wrap') return ((i % n) + n) % n;
  if (mode === 'reflect') { const m = ((i % (2 * n)) + 2 * n) % (2 * n); return m < n ? m : 2 * n - 1 - m; }
  const p = 2 * n - 2, m = ((i % p) + p) % p; return m < n ? m : p - m;
}

/**
 * scipy's `median_filter` with a box (`size` per axis, odd or even: the value of rank size//2 in the window, origin 0),
 * exact. One axis of size above 1 slides a sorted window along each line; two (a 2-D image) keep the window's values as
 * ranks of the whole image in a Fenwick tree, walking the image row by row back and forth so each step changes one
 * column or row of the window. A NaN has no rank among numbers: the chain's callers pass none (scipy's own order for
 * NaN is not reproduced), and one here throws.
 */
export function medianFilter<T extends Values>(values: T, shape: readonly number[], filterSize: number | readonly number[], options: { mode?: Mode; cval?: number } = {}): T {
  checked(values, shape);
  const sizes = perAxis(filterSize, shape, 'size').map(Math.trunc), { mode = 'reflect', cval = 0 } = options, out = like(values);
  for (const v of values) if (Number.isNaN(v)) throw new TypeError('medianFilter does not take NaN.');
  const active = sizes.flatMap((n, axis) => n > 1 ? [axis] : []);
  if (!active.length) { out.set(values); return out; }
  if (active.length === 1) {
    const axis = active[0]!, n = sizes[axis]!, size1 = n >> 1, size2 = n - size1 - 1, rank = n >> 1, length = shape[axis]!;
    const buffer = new Float64Array(length + n - 1), window = new Float64Array(n);
    eachLine(shape, axis, (start, stride) => {
      extendLine(buffer, values, start, stride, length, size1, size2, mode, cval);
      for (let k = 0; k < n; k++) window[k] = buffer[k]!;
      window.sort();
      out[start] = window[rank]!;
      for (let l = 1; l < length; l++) {
        const gone = buffer[l - 1]!, come = buffer[l + n - 1]!;
        let at = 0; while (window[at] !== gone) at++;
        // Take `gone` out and put `come` in, shifting the values between.
        if (come >= gone) { while (at + 1 < n && window[at + 1]! < come) { window[at] = window[at + 1]!; at++; } }
        else { while (at > 0 && window[at - 1]! > come) { window[at] = window[at - 1]!; at--; } }
        window[at] = come;
        out[start + l * stride] = window[rank]!;
      }
    });
    return out;
  }
  if (active.length !== 2 || shape.length !== 2) throw new TypeError('medianFilter takes a box of size above 1 along one axis, or along both axes of a 2-D image.');
  const [H, W] = shape as [number, number], [h, w] = sizes as [number, number], r1 = h >> 1, c1 = w >> 1, rank = (h * w) >> 1;
  if (mode === 'constant' || h * w <= 49) return medianBrute(values, shape, sizes, mode, cval, out);
  // Each value's rank: its first place in the sorted values (equal values share it).
  const sorted = Float64Array.from(values).sort(), N = sorted.length, ranks = new Int32Array(N);
  for (let p = 0; p < N; p++) { const v = values[p]!; let lo = 0, hi = N - 1; while (lo < hi) { const mid = (lo + hi) >> 1; if (sorted[mid]! < v) lo = mid + 1; else hi = mid; } ranks[p] = lo; }
  const total = N, tree = new Int32Array(total + 1); let top = 1; while (top * 2 <= total) top *= 2;
  // Rows and columns past the edges, read through the mode once.
  const rowStart = Int32Array.from({ length: H + h }, (_, k) => extendIndex(k - r1 - 1, H, mode) * W), colAt = Int32Array.from({ length: W + w }, (_, k) => extendIndex(k - c1 - 1, W, mode));
  const rankAt = (y: number, x: number) => ranks[rowStart[y + r1 + 1]! + colAt[x + c1 + 1]!]!;
  const sortedValue = (r: number) => sorted[r]!;
  const add = (r: number, d: number) => { for (let i = r + 1; i <= total; i += i & -i) tree[i]! += d; };
  const kth = () => { let pos = 0, rem = rank + 1; for (let step = top; step; step >>= 1) { const next = pos + step; if (next <= total && tree[next]! < rem) { pos = next; rem -= tree[next]!; } } return pos; };
  for (let dy = -r1; dy < h - r1; dy++) for (let dx = -c1; dx < w - c1; dx++) add(rankAt(dy, dx), 1);
  for (let y = 0; y < H; y++) {
    const forward = y % 2 === 0;
    for (let s = 0; s < W; s++) {
      const x = forward ? s : W - 1 - s;
      if (s > 0) {
        // Move one column: the column leaving the window out, the one entering in.
        const leave = forward ? x - 1 - c1 : x + 1 - c1 + w - 1, enter = forward ? x - c1 + w - 1 : x - c1;
        for (let dy = -r1; dy < h - r1; dy++) { add(rankAt(y + dy, leave), -1); add(rankAt(y + dy, enter), 1); }
      }
      out[y * W + x] = sortedValue(kth());
    }
    if (y + 1 < H) { const x = forward ? W - 1 : 0; for (let dx = -c1; dx < w - c1; dx++) { add(rankAt(y - r1, x + dx), -1); add(rankAt(y + 1 - r1 + h - 1, x + dx), 1); } }
  }
  return out;
}
function medianBrute<T extends Values>(values: T, shape: readonly number[], sizes: number[], mode: Mode, cval: number, out: T): T {
  const [H, W] = shape as [number, number], [h, w] = sizes as [number, number], r1 = h >> 1, c1 = w >> 1, window = new Float64Array(h * w);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let k = 0; for (let dy = -r1; dy < h - r1; dy++) for (let dx = -c1; dx < w - c1; dx++) { const Y = extendIndex(y + dy, H, mode), X = extendIndex(x + dx, W, mode); window[k++] = Y < 0 || X < 0 ? cval : values[Y * W + X]!; }
    window.sort(); out[y * W + x] = window[(h * w) >> 1]!;
  }
  return out;
}

/** Each pixel's grid distance (along the axes, one step at a time) to the nearest pixel of `from`, up to `limit`
 * (beyond: Infinity). `outside` counts every pixel past the edges as one of `from`. */
function stepDistance(from: (p: number) => boolean, shape: readonly number[], limit: number, outside: boolean): Float64Array {
  const n = size(shape), dist = new Float64Array(n).fill(Infinity), strides = shape.map((_, a) => shape.slice(a + 1).reduce((x, y) => x * y, 1));
  const coordinate = (p: number, a: number) => Math.floor(p / strides[a]!) % shape[a]!, levels: number[][] = [[], []];
  for (let p = 0; p < n; p++) if (from(p)) { dist[p] = 0; levels[0]!.push(p); }
  // A pixel on an edge is one step from the outside.
  if (outside) for (let p = 0; p < n; p++) if (dist[p] !== 0 && shape.some((len, a) => { const i = coordinate(p, a); return i === 0 || i === len - 1; })) { dist[p] = 1; levels[1]!.push(p); }
  for (let d = 0; d < limit; d++) {
    const next = levels[d + 1] ??= [];
    for (const p of levels[d]!) {
      if (dist[p] !== d) continue;
      for (let a = 0; a < shape.length; a++) { const i = coordinate(p, a);
        for (const step of [-1, 1]) { if (i + step < 0 || i + step >= shape[a]!) continue; const q = p + step * strides[a]!; if (dist[q]! > d + 1) { dist[q] = d + 1; next.push(q); } } }
    }
  }
  return dist;
}

/** scipy's `binary_dilation` with its default cross (`generate_binary_structure(rank, 1)`), `iterations` times, the
 * outside 0: a pixel is set when a set pixel is within `iterations` steps along the axes. */
export function binaryDilation(mask: Uint8Array, shape: readonly number[], iterations = 1): Uint8Array {
  checked(mask, shape); if (!Number.isSafeInteger(iterations) || iterations < 1) throw new TypeError('binaryDilation takes iterations ≥ 1.');
  const dist = stepDistance(p => mask[p] !== 0, shape, iterations, false);
  return Uint8Array.from(dist, d => d <= iterations ? 1 : 0);
}
/** scipy's `binary_erosion` with the default cross, `iterations` times, the outside 0 (border_value 0): a pixel stays
 * set when no unset pixel and no edge is within `iterations` steps. */
export function binaryErosion(mask: Uint8Array, shape: readonly number[], iterations = 1): Uint8Array {
  checked(mask, shape); if (!Number.isSafeInteger(iterations) || iterations < 1) throw new TypeError('binaryErosion takes iterations ≥ 1.');
  const dist = stepDistance(p => mask[p] === 0, shape, iterations, true);
  return Uint8Array.from(dist, d => d > iterations ? 1 : 0);
}
/** scipy's `binary_opening`: erosion then dilation, `iterations` each. */
export function binaryOpening(mask: Uint8Array, shape: readonly number[], iterations = 1): Uint8Array {
  return binaryDilation(binaryErosion(mask, shape, iterations), shape, iterations);
}

/** scipy's `label` with its default connectivity (pixels sharing a face): components numbered from 1 in the order
 * their first pixel comes in the array. */
export function label(mask: Uint8Array, shape: readonly number[]): { labels: Int32Array; count: number } {
  checked(mask, shape);
  const n = mask.length, labels = new Int32Array(n), strides = shape.map((_, a) => shape.slice(a + 1).reduce((x, y) => x * y, 1)), stack: number[] = [];
  let count = 0;
  for (let p = 0; p < n; p++) {
    if (!mask[p] || labels[p]) continue;
    labels[p] = ++count; stack.push(p);
    while (stack.length) {
      const q = stack.pop()!;
      for (let a = 0; a < shape.length; a++) { const i = Math.floor(q / strides[a]!) % shape[a]!;
        for (const step of [-1, 1]) { if (i + step < 0 || i + step >= shape[a]!) continue; const r = q + step * strides[a]!; if (mask[r] && !labels[r]) { labels[r] = count; stack.push(r); } } }
    }
  }
  return { labels, count };
}

/** ni_interpolation.c `map_coordinate` for an index past the edge, with the boundary modes this chain uses. */
function mapIndex(i: number, len: number, mode: 'mirror' | 'nearest'): number {
  if (mode === 'nearest') return i < 0 ? 0 : i > len - 1 ? len - 1 : i;
  if (len <= 1) return 0;
  const sz2 = 2 * len - 2;
  if (i < 0) { let v = sz2 * Math.trunc(-i / sz2) + i; v = v <= 1 - len ? v + sz2 : -v; return v; }
  if (i > len - 1) { let v = i - sz2 * Math.trunc(i / sz2); if (v >= len) v = sz2 - v; return v; }
  return i;
}

export interface InterpolationOptions { order?: 0 | 1; mode?: 'constant' | 'nearest'; cval?: number; output?: 'float32' | 'float64' }

/** The value of a 2-D image at (row, col) as NI_GeometricTransform reads it (order 0 or 1, prefilter off). */
function interpolate(image: ArrayLike<number>, H: number, W: number, r: number, c: number, order: 0 | 1, mode: 'constant' | 'nearest', cval: number): number {
  const dims = [H, W], coords = [r, c], starts = [0, 0], idx = [[0, 0], [0, 0]], weights = [[0, 0], [0, 0]];
  for (let a = 0; a < 2; a++) {
    const cc = coords[a]!, len = dims[a]!;
    if (mode === 'constant') { if (!(cc >= 0 && cc <= len - 1)) return cval; }
    else if (Number.isNaN(cc)) return NaN;
    const start = order === 1 ? Math.floor(cc) : Math.floor(cc + 0.5); starts[a] = start;
    // Kernel places past the edge read through the spline boundary: mirror for the constant mode, nearest for nearest.
    const spline = mode === 'constant' ? 'mirror' : 'nearest';
    for (let l = 0; l <= order; l++) idx[a]![l] = start < 0 || start + order >= len ? mapIndex(start + l, len, spline) : start + l;
    if (order === 1) { const x = cc - Math.floor(cc), w0 = 1 - x; weights[a]![0] = w0; weights[a]![1] = 1 - w0; }
  }
  if (order === 0) return 0 + image[idx[0]![0]! * W + idx[1]![0]!]!;
  let t = 0;
  for (let i = 0; i <= 1; i++) for (let j = 0; j <= 1; j++) { let coeff = image[idx[0]![i]! * W + idx[1]![j]!]!; coeff *= weights[0]![i]!; coeff *= weights[1]![j]!; t += coeff; }
  return t;
}
function outputLike(image: Values, length: number, output: InterpolationOptions['output']): Values {
  return (output ?? (image instanceof Float32Array ? 'float32' : 'float64')) === 'float32' ? new Float32Array(length) : new Float64Array(length);
}

/** scipy's `map_coordinates` on a 2-D image, order 0 or 1 (no spline prefilter). Constant mode: a coordinate outside
 * [0, n-1] (or NaN) gives `cval`; inside, both neighbours are always read, so a NaN neighbour spoils the value even at
 * zero weight, and a kernel place past the last pixel mirrors to n-2. Weights are 1-x and 1-(1-x), summed corner by
 * corner (row-major) as (value·w_row)·w_col. The output has the image's type unless `output` says otherwise. */
export function mapCoordinates(image: Values, shape: readonly number[], rows: ArrayLike<number>, cols: ArrayLike<number>, options: InterpolationOptions = {}): Values {
  checked(image, shape); if (shape.length !== 2) throw new TypeError('mapCoordinates takes a 2-D image.');
  if (rows.length !== cols.length) throw new TypeError('mapCoordinates needs as many rows as columns.');
  const { order = 1, mode = 'constant', cval = 0 } = options, [H, W] = shape as [number, number], out = outputLike(image, rows.length, options.output);
  for (let k = 0; k < rows.length; k++) out[k] = interpolate(image, H, W, rows[k]!, cols[k]!, order, mode, cval);
  return out;
}

/** scipy's `affine_transform` on a 2-D image to the same shape: output pixel (i, j) reads the image at
 * matrix·(i, j) + offset, each coordinate summed as ((offset + i·m0) + j·m1) with each step fused (see
 * `fusedMultiplyAdd`); then as `mapCoordinates`. */
export function affineTransform(image: Values, shape: readonly number[], matrix: readonly [readonly [number, number], readonly [number, number]], offset: readonly [number, number], options: InterpolationOptions = {}): Values {
  checked(image, shape); if (shape.length !== 2) throw new TypeError('affineTransform takes a 2-D image.');
  const { order = 1, mode = 'constant', cval = 0 } = options, [H, W] = shape as [number, number], out = outputLike(image, H * W, options.output);
  for (let i = 0; i < H; i++) for (let j = 0; j < W; j++) {
    const r = fusedMultiplyAdd(j, matrix[0][1], fusedMultiplyAdd(i, matrix[0][0], offset[0])), c = fusedMultiplyAdd(j, matrix[1][1], fusedMultiplyAdd(i, matrix[1][0], offset[1]));
    out[i * W + j] = interpolate(image, H, W, r, c, order, mode, cval);
  }
  return out;
}

/** scipy's `distance_transform_edt` of a 2-D mask: each set pixel's Euclidean distance to the nearest unset one (0 on
 * unset pixels; Infinity everywhere when none is unset). Exact squared distances (Felzenszwalb and Huttenlocher), then
 * their square roots. */
export function distanceTransformEdt(mask: Uint8Array, shape: readonly number[]): Float64Array {
  checked(mask, shape); if (shape.length !== 2) throw new TypeError('distanceTransformEdt takes a 2-D mask.');
  const [H, W] = shape as [number, number], FAR = 1e20, d = Float64Array.from(mask, m => m ? FAR : 0);
  // The lower envelope of the parabolas (q - v)² + f(v) along one line.
  const pass = (get: (k: number) => number, set: (k: number, v: number) => void, n: number) => {
    const f = Float64Array.from({ length: n }, (_, k) => get(k)), v = new Int32Array(n), z = new Float64Array(n + 1); let k = 0; z[0] = -Infinity; z[1] = Infinity;
    const cross = (q: number, p: number) => ((f[q]! + q * q) - (f[p]! + p * p)) / (2 * q - 2 * p);
    for (let q = 1; q < n; q++) { let s = cross(q, v[k]!); while (s <= z[k]!) { k--; s = cross(q, v[k]!); } k++; v[k] = q; z[k] = s; z[k + 1] = Infinity; }
    k = 0; for (let q = 0; q < n; q++) { while (z[k + 1]! < q) k++; set(q, (q - v[k]!) * (q - v[k]!) + f[v[k]!]!); }
  };
  for (let x = 0; x < W; x++) pass(y => d[y * W + x]!, (y, v) => { d[y * W + x] = v; }, H);
  for (let y = 0; y < H; y++) pass(x => d[y * W + x]!, (x, v) => { d[y * W + x] = v; }, W);
  return d.map(v => v >= FAR / 2 ? Infinity : Math.sqrt(v));
}

/** numpy's `gradient` of a 2-D array, spacing 1: [along rows, along columns]; central differences inside, one-sided at
 * the edges, in the array's own type. */
export function gradient<T extends Values>(values: T, shape: readonly number[]): [T, T] {
  checked(values, shape); if (shape.length !== 2) throw new TypeError('gradient takes a 2-D array.');
  const [H, W] = shape as [number, number], f32 = values instanceof Float32Array, round = f32 ? Math.fround : (v: number) => v, dr = like(values), dc = like(values);
  if (H < 2 || W < 2) throw new TypeError('gradient needs at least two samples along each axis.');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x, v = (q: number) => values[q]!;
    dr[p] = y === 0 ? round(v(p + W) - v(p)) : y === H - 1 ? round(v(p) - v(p - W)) : round(v(p + W) - v(p - W)) / 2;
    dc[p] = x === 0 ? round(v(p + 1) - v(p)) : x === W - 1 ? round(v(p) - v(p - 1)) : round(v(p + 1) - v(p - 1)) / 2;
  }
  return [dr, dc];
}
