/**
 * CK pointing segments: discrete (type 1), constant-rate (type 2) and
 * interpolated (type 3) quaternion records. Times are encoded SCLK ticks.
 * Quaternions use the SPICE convention (scalar first) and the returned matrix
 * is the C-matrix: it maps vectors from the segment's reference frame into
 * the instrument frame. Layouts follow the NAIF CK Required Reading.
 */
import type { Daf, DafSummary } from './daf.js';

export type Matrix3 = readonly [readonly [number, number, number], readonly [number, number, number], readonly [number, number, number]];
export interface Pointing { readonly cMatrix: Matrix3; readonly angularVelocity: readonly [number, number, number] | null }
export interface CkSegment {
  readonly name: string; readonly instrument: number; readonly reference: number; readonly type: number; readonly hasRates: boolean;
  readonly start: number; readonly stop: number;
  /** Pointing at an encoded SCLK time, or null when the segment has no coverage there. */
  readonly pointing: (sclk: number, toleranceTicks?: number) => Pointing | null;
}

/** NAIF q2m: the matrix of a unit SPICE quaternion (scalar first). For a CK quaternion this is the C-matrix that maps
 * reference-frame vectors into the instrument frame; verified against DART's pointing at Dimorphos. */
export function quaternionToMatrix(q: ArrayLike<number>): Matrix3 {
  const q0 = q[0], q1 = q[1], q2 = q[2], q3 = q[3];
  return [
    [1 - 2 * (q2 * q2 + q3 * q3), 2 * (q1 * q2 - q0 * q3), 2 * (q1 * q3 + q0 * q2)],
    [2 * (q1 * q2 + q0 * q3), 1 - 2 * (q1 * q1 + q3 * q3), 2 * (q2 * q3 - q0 * q1)],
    [2 * (q1 * q3 - q0 * q2), 2 * (q2 * q3 + q0 * q1), 1 - 2 * (q1 * q1 + q2 * q2)]];
}
const normalize = (values: ArrayLike<number>) => { const q = Array.from(values), n = Math.hypot(...q); if (!(n > 0)) throw new Error('Zero quaternion.'); return q.map(v => v / n); };
/** Spherical linear interpolation of SPICE quaternions along the shorter arc. */
export function slerp(from: ArrayLike<number>, toward: ArrayLike<number>, fraction: number) {
  const a = Array.from(from), b = Array.from(toward);
  let dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3], to = b;
  if (dot < 0) { dot = -dot; to = b.map(v => -v); }
  if (dot > 0.9999999) return normalize(a.map((v, i) => v + (to[i] - v) * fraction));
  const theta = Math.acos(Math.min(1, dot)), sinTheta = Math.sin(theta);
  const wa = Math.sin((1 - fraction) * theta) / sinTheta, wb = Math.sin(fraction * theta) / sinTheta;
  return a.map((v, i) => wa * v + wb * to[i]);
}

function lastNotAfter(values: Float64Array, t: number) {
  let low = 0, high = values.length - 1;
  if (values.length === 0 || t < values[0]) return -1;
  while (low < high) { const mid = (low + high + 1) >> 1; if (values[mid] <= t) low = mid; else high = mid - 1; }
  return low;
}

/** Every segment of a CK, in file order. */
export function ckSegments(daf: Daf): CkSegment[] {
  if (daf.idWord !== 'DAF/CK') throw new Error(`Not a CK: ${daf.idWord}`);
  if (daf.nd !== 2 || daf.ni !== 6) throw new Error('CK summaries must hold two doubles and six integers.');
  return daf.summaries.map(summary => {
    const [instrument, reference, type, rates] = summary.integers, [start, stop] = summary.doubles, hasRates = rates === 1;
    const pointing = type === 1 ? type1(daf, summary, hasRates) : type === 2 ? type2(daf, summary) : type === 3 ? type3(daf, summary, hasRates) : null;
    if (!pointing) throw new Error(`Unsupported CK segment type ${type} in ${summary.name} (instrument ${instrument}).`);
    return { name: summary.name, instrument, reference, type, hasRates, start, stop, pointing };
  });
}

function type1(daf: Daf, summary: DafSummary, hasRates: boolean): CkSegment['pointing'] {
  // Records, then their time tags, then one directory epoch per 100 tags, then the record count as the final word.
  const size = hasRates ? 7 : 4, count = daf.words(summary.endAddress, 1)[0]!;
  if (!Number.isInteger(count) || count < 1 || summary.endAddress - summary.startAddress + 1 !== count * (size + 1) + Math.floor((count - 1) / 100) + 1) {
    throw new Error(`Invalid type 1 CK trailer in ${summary.name}.`);
  }
  const times = daf.words(summary.startAddress + count * size, count);
  return (sclk, tolerance = 0) => {
    const index = lastNotAfter(times, sclk + tolerance);
    if (index < 0 || sclk - times[index] > tolerance) return null;
    const record = daf.words(summary.startAddress + index * size, size);
    return { cMatrix: quaternionToMatrix(normalize(record.subarray(0, 4))), angularVelocity: hasRates ? [record[4], record[5], record[6]] : null };
  };
}

function type2(daf: Daf, summary: DafSummary): CkSegment['pointing'] {
  // Type 2 has no count word: N records of 8 doubles, N start times, N stop times, then one directory entry per 100 starts.
  const length = summary.endAddress - summary.startAddress + 1;
  let count = Math.floor(length / 10);
  while (count > 0 && 10 * count + Math.floor((count - 1) / 100) > length) count--;
  if (count < 1 || 10 * count + Math.floor((count - 1) / 100) !== length) throw new Error(`Invalid type 2 CK segment length in ${summary.name}.`);
  const starts = daf.words(summary.startAddress + count * 8, count), stops = daf.words(summary.startAddress + count * 9, count);
  return sclk => {
    const index = lastNotAfter(starts, sclk);
    if (index < 0 || sclk > stops[index]) return null;
    const record = daf.words(summary.startAddress + index * 8, 8), q = normalize(record.subarray(0, 4)), av = [record[4], record[5], record[6]], rate = record[7];
    // Constant angular velocity from the record epoch: rotate the C-matrix about the axis by the elapsed angle.
    const seconds = (sclk - starts[index]) * rate, magnitude = Math.hypot(...av);
    const base = quaternionToMatrix(q);
    if (magnitude === 0 || seconds === 0) return { cMatrix: base, angularVelocity: [av[0], av[1], av[2]] };
    const angle = magnitude * seconds, axis = av.map(v => v / magnitude), half = angle / 2;
    // Angular velocity is expressed in the reference frame: apply the rotation before the base pointing.
    const delta = quaternionToMatrix([Math.cos(half), ...axis.map(v => Math.sin(half) * v)]);
    return { cMatrix: multiply(base, delta), angularVelocity: [av[0], av[1], av[2]] };
  };
}

function type3(daf: Daf, summary: DafSummary, hasRates: boolean): CkSegment['pointing'] {
  const size = hasRates ? 7 : 4, trailer = daf.words(summary.endAddress - 1, 2), intervals = trailer[0], count = trailer[1];
  if (!Number.isInteger(count) || count < 1 || !Number.isInteger(intervals) || intervals < 1) throw new Error(`Invalid type 3 CK trailer in ${summary.name}.`);
  const times = daf.words(summary.startAddress + count * size, count);
  const timeDirectories = Math.floor((count - 1) / 100);
  const intervalStarts = daf.words(summary.startAddress + count * size + count + timeDirectories, intervals);
  return (sclk, tolerance = 0) => {
    const interval = lastNotAfter(intervalStarts, sclk);
    if (interval < 0) return null;
    const intervalEnd = interval + 1 < intervals ? intervalStarts[interval + 1] : Infinity;
    const index = lastNotAfter(times, sclk);
    if (index < 0) return null;
    const record = (i: number) => daf.words(summary.startAddress + i * size, size);
    const exact = record(index);
    if (times[index] === sclk || index + 1 >= count || times[index + 1] >= intervalEnd) {
      if (sclk - times[index] > tolerance && times[index] !== sclk) return null;
      return { cMatrix: quaternionToMatrix(normalize(exact.subarray(0, 4))), angularVelocity: hasRates ? [exact[4], exact[5], exact[6]] : null };
    }
    const next = record(index + 1), fraction = (sclk - times[index]) / (times[index + 1] - times[index]);
    const q = slerp(normalize(exact.subarray(0, 4)), normalize(next.subarray(0, 4)), fraction);
    const av = hasRates ? ([4, 5, 6].map(k => exact[k] + (next[k] - exact[k]) * fraction) as [number, number, number]) : null;
    return { cMatrix: quaternionToMatrix(q), angularVelocity: av };
  };
}

export function multiply(a: Matrix3, b: Matrix3): Matrix3 {
  const row = (i: number) => [0, 1, 2].map(j => a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j]) as [number, number, number];
  return [row(0), row(1), row(2)];
}
export const transpose = (m: Matrix3): Matrix3 => [[m[0][0], m[1][0], m[2][0]], [m[0][1], m[1][1], m[2][1]], [m[0][2], m[1][2], m[2][2]]];
export const apply = (m: Matrix3, v: readonly number[]): [number, number, number] => [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]];
