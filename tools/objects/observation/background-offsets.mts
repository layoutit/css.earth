import { dotN as dot } from '@cssearth/core';
/** One additive level per region, solved from the median difference of every measured boundary.
 * Montage's mBgModel with constant terms (Berriman et al.): minimise sum n_ij (o_i - o_j - d_ij)^2 with
 * sum o = 0. The WISE atlas mosaic and the photographic plate background share this solver. */
export const MONTAGE_BACKGROUND_REFERENCE = 'https://doi.org/10.1504/IJCSE.2009.026999';

export interface OffsetPair { readonly i: number; readonly j: number; readonly difference: number; readonly pixels: number }

export function median(values: number[]): number {
  values.sort((a, b) => a - b);
  const middle = values.length >> 1;
  return values.length % 2 ? values[middle]! : (values[middle - 1]! + values[middle]!) / 2;
}

/** Connected components of the boundary graph, in discovery order; every index belongs to exactly one. */
export function offsetComponents(count: number, pairs: readonly OffsetPair[]): Int32Array {
  const component = new Int32Array(count).fill(-1);
  let next = 0;
  for (let start = 0; start < count; start++) {
    if (component[start]! >= 0) continue;
    const queue = [start]; component[start] = next;
    for (let head = 0; head < queue.length; head++) for (const pair of pairs) {
      const other = pair.i === queue[head] ? pair.j : pair.j === queue[head] ? pair.i : -1;
      if (other >= 0 && component[other]! < 0) { component[other] = next; queue.push(other); }
    }
    next++;
  }
  return component;
}

/** Conjugate gradients on the weighted graph Laplacian, then the zero-mean gauge. The null space of a
 * connected graph is the constant vector and the right-hand side sums to zero, so the free level is fixed. */
export function solveConstantOffsets(count: number, pairs: readonly OffsetPair[]) {
  const degree = new Float64Array(count), rhs = new Float64Array(count);
  for (const pair of pairs) {
    degree[pair.i] += pair.pixels; degree[pair.j] += pair.pixels;
    rhs[pair.i] += pair.pixels * pair.difference; rhs[pair.j] -= pair.pixels * pair.difference;
  }
  const apply = (v: Float64Array) => {
    const out = new Float64Array(count);
    for (let t = 0; t < count; t++) out[t] = degree[t]! * v[t]!;
    for (const pair of pairs) { out[pair.i] -= pair.pixels * v[pair.j]!; out[pair.j] -= pair.pixels * v[pair.i]!; }
    return out;
  };
  const offsets = new Float64Array(count), residualVector = Float64Array.from(rhs), direction = Float64Array.from(rhs);
  let rr = dot(residualVector, residualVector), sweeps = 0;
  const tolerance = 1e-20 * Math.max(1, dot(rhs, rhs));
  for (; sweeps < 10 * count && rr > tolerance; sweeps++) {
    const ad = apply(direction), step = rr / dot(direction, ad);
    for (let t = 0; t < count; t++) { offsets[t] += step * direction[t]!; residualVector[t] -= step * ad[t]!; }
    const next = dot(residualVector, residualVector);
    for (let t = 0; t < count; t++) direction[t] = residualVector[t]! + next / rr * direction[t]!;
    rr = next;
  }
  const mean = offsets.reduce((sum, value) => sum + value, 0) / Math.max(1, count);
  for (let t = 0; t < count; t++) offsets[t] -= mean;
  const residual = (applied: boolean) => {
    const values = pairs.map(pair => Math.abs(pair.difference - (applied ? offsets[pair.i]! - offsets[pair.j]! : 0)));
    return values.length ? median(values) : 0;
  };
  return { offsets, pairs: pairs.length, sweeps, medianPairStepBefore: residual(false), medianPairStepAfter: residual(true) };
}
