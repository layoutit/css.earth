/**
 * NumPy's reductions as the outer-ejecta scripts call them, to the last bit (NumPy 2.5.4, one-dimensional data):
 *
 * - `sum` and `mean`: `np.add.reduce` over contiguous data is NumPy's pairwise summation (fewer than eight values in
 *   order from -0; eight running sums over blocks of at most 128 values; longer runs split in halves on multiples of
 *   eight). A Float32Array is
 *   summed in single precision, as NumPy sums float32 data.
 * - `variance` and `std`: the mean, then the mean of the squared deviations, then its square root (ddof 0), in single
 *   precision step by step for float32 data, as NumPy's `_var` does.
 * - `percentile`: method 'linear' (the virtual index (n - 1) q / 100 between its two neighbours, by NumPy's `_lerp`,
 *   which interpolates from the upper neighbour when the fraction is at least a half). A Float32Array is interpolated in
 *   single precision, as NumPy does for a float32 array and a Python-number q.
 * - `median`: the middle value, or the mean of the two middle values; `nanmedian` and `nanpercentile` leave NaN out
 *   (NaN when nothing is left). `percentile` and `median` give NaN when the data hold a NaN, as NumPy does.
 * - `digitize` (right=False, increasing bins) and a stable `argsort` (NaN last).
 */

type Data = ArrayLike<number>;
/** `float32`: compute as NumPy does for a float32 array. By default a Float32Array is float32 data and anything else
 * float64. */
export interface Precision { float32?: boolean }
const isSingle = (values: Data, options: Precision = {}): boolean => options.float32 ?? values instanceof Float32Array;

/** NumPy's pairwise sum of `count` values from `start` (`DOUBLE_pairwise_sum` / `FLOAT_pairwise_sum`). */
function pairwise(values: Data, start: number, count: number, single: boolean): number {
  const add = single ? (a: number, b: number) => Math.fround(a + b) : (a: number, b: number) => a + b;
  if (count < 8) { let res = -0; for (let i = 0; i < count; i++) res = add(res, values[start + i]!); return res; }
  if (count <= 128) {
    const r = [0, 1, 2, 3, 4, 5, 6, 7].map(j => values[start + j]!);
    let i = 8;
    for (; i < count - (count % 8); i += 8) for (let j = 0; j < 8; j++) r[j] = add(r[j]!, values[start + i + j]!);
    let res = add(add(add(r[0]!, r[1]!), add(r[2]!, r[3]!)), add(add(r[4]!, r[5]!), add(r[6]!, r[7]!)));
    for (; i < count; i++) res = add(res, values[start + i]!);
    return res;
  }
  let half = Math.floor(count / 2); half -= half % 8;
  return add(pairwise(values, start, half, single), pairwise(values, start + half, count - half, single));
}

/** NumPy's `pairwise_sum` over all the values (in single precision with `float32`, or for a Float32Array). */
export function pairwiseSum(values: Data, options: Precision = {}): number {
  const single = isSingle(values, options);
  return pairwise(single && !(values instanceof Float32Array) ? Float32Array.from(values) : values, 0, values.length, single);
}

/** `np.sum(values)`: the pairwise sum of the values (0 for no values). */
export function sum(values: Data, options: Precision = {}): number {
  const single = isSingle(values, options);
  if (!values.length) return 0;
  if (single && !(values instanceof Float32Array)) values = Float32Array.from(values);
  return pairwise(values, 0, values.length, single);
}

/** `np.mean(values)`: the sum over the count (NaN for no values). */
export function mean(values: Data, options: Precision = {}): number {
  if (!values.length) return NaN;
  const s = sum(values, options) / values.length;
  return isSingle(values, options) ? Math.fround(s) : s;
}

/** `np.var(values)` (ddof 0), as NumPy's `_var`: the mean, the squared deviations from it, their sum over the count;
 * each step rounded to single precision for float32 data. */
export function variance(values: Data, options: Precision = {}): number {
  if (!values.length) return NaN;
  const n = values.length;
  if (isSingle(values, options)) {
    const f = Math.fround, data = Float32Array.from(values), m = f(pairwiseSum(data) / n);
    return f(pairwiseSum(data.map(v => { const x = f(v - m); return f(x * x); })) / n);
  }
  const data = Float64Array.from(values), m = pairwiseSum(data) / n;
  return pairwiseSum(data.map(v => { const x = v - m; return x * x; })) / n;
}

/** `np.std(values)` (ddof 0): the square root of `variance`. */
export function std(values: Data, options: Precision = {}): number {
  const v = Math.sqrt(variance(values, options));
  return isSingle(values, options) ? Math.fround(v) : v;
}

/** The values in increasing order, NaN last (a copy, of the input's precision). */
function sorted(values: Data, single: boolean): Float64Array | Float32Array {
  const copy = single ? Float32Array.from(values) : Float64Array.from(values);
  return copy.sort();
}

/** NumPy's `_lerp(a, b, t)`, in the data's precision: from a when t is under a half, from b otherwise. */
function lerp(a: number, b: number, t: number, single: boolean): number {
  if (single) {
    const f = Math.fround, diff = f(b - a);
    return t >= 0.5 ? f(b - f(diff * f(1 - t))) : f(a + f(diff * f(t)));
  }
  const diff = b - a;
  return t >= 0.5 ? b - diff * (1 - t) : a + diff * t;
}

function checkedQ(q: number): number {
  if (!(q >= 0 && q <= 100)) throw new RangeError(`A percentile must be between 0 and 100; got ${q}.`);
  return q;
}

/** The linear percentile of increasing values with no NaN. */
function percentileOfSorted(s: Float64Array | Float32Array, q: number, single: boolean): number {
  const n = s.length;
  if (!n) return NaN;
  const virtual = (n - 1) * (q / 100), previous = Math.floor(virtual);
  const below = virtual < 0, above = virtual >= n - 1;
  const lo = below ? 0 : above ? n - 1 : previous, hi = below ? 0 : above ? n - 1 : previous + 1;
  return lerp(s[lo]!, s[hi]!, virtual - previous, single);
}

/** `np.percentile(values, q)` (method 'linear'); NaN when the data hold a NaN. */
export function percentile(values: Data, q: number, options: Precision = {}): number {
  checkedQ(q);
  const single = isSingle(values, options), s = sorted(values, single);
  if (s.length && Number.isNaN(s[s.length - 1]!)) return NaN;
  return percentileOfSorted(s, q, single);
}

/** `np.nanpercentile(values, q)`: the percentile of the values that are not NaN (NaN when none are). */
export function nanpercentile(values: Data, q: number, options: Precision = {}): number {
  checkedQ(q);
  const single = isSingle(values, options), kept = Array.from(values).filter(v => !Number.isNaN(v));
  return percentileOfSorted(single ? Float32Array.from(kept).sort() : Float64Array.from(kept).sort(), q, single);
}

/** The median of increasing values with no NaN: the middle one, or the mean of the two middle ones. */
function medianOfSorted(s: Float64Array | Float32Array, single: boolean): number {
  const n = s.length;
  if (!n) return NaN;
  if (n % 2) return s[(n - 1) / 2]!;
  const a = s[n / 2 - 1]!, b = s[n / 2]!;
  return single ? Math.fround(Math.fround(a + b) / 2) : (a + b) / 2;
}

/** `np.median(values)`; NaN when the data hold a NaN. */
export function median(values: Data, options: Precision = {}): number {
  const single = isSingle(values, options), s = sorted(values, single);
  if (s.length && Number.isNaN(s[s.length - 1]!)) return NaN;
  return medianOfSorted(s, single);
}

/** `np.nanmedian(values)`: the median of the values that are not NaN (NaN when none are). */
export function nanmedian(values: Data, options: Precision = {}): number {
  const single = isSingle(values, options), kept = Array.from(values).filter(v => !Number.isNaN(v));
  return medianOfSorted(single ? Float32Array.from(kept).sort() : Float64Array.from(kept).sort(), single);
}

/** `np.digitize(x, bins)` for increasing bins (right=False): the index i with bins[i - 1] <= x < bins[i]; NaN goes
 * past the last bin. */
export function digitize(x: number, bins: Data): number {
  for (let i = 1; i < bins.length; i++) if (!(bins[i]! >= bins[i - 1]!)) throw new RangeError('digitize: the bins must increase.');
  if (Number.isNaN(x)) return bins.length;
  let lo = 0, hi = bins.length;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (bins[mid]! <= x) lo = mid + 1; else hi = mid; }
  return lo;
}

/** `np.argsort(values, kind='stable')`: indices by increasing value, equal values in their order, NaN last. */
export function argsortStable(values: Data): number[] {
  const key = (v: number) => Number.isNaN(v) ? Infinity : v;
  return Array.from({ length: values.length }, (_, i) => i).sort((a, b) => {
    const x = values[a]!, y = values[b]!, nx = Number.isNaN(x), ny = Number.isNaN(y);
    if (nx !== ny) return nx ? 1 : -1;
    return key(x) - key(y) || a - b;
  });
}
