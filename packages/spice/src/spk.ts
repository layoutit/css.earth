/**
 * SPK ephemeris segments: Chebyshev position (type 2) and position-velocity
 * (type 3), two-body propagation between states (type 5), equally spaced
 * Lagrange (type 8), difference lines (type 1), and Lagrange (type 9) and
 * Hermite (type 13) interpolation of discrete states. Layouts follow the NAIF SPK Required Reading. States are kilometres
 * and kilometres per second in the segment's reference frame; ephemeris time
 * is TDB seconds past J2000. Other types are refused by number.
 */
import type { Daf, DafSummary } from './daf.js';
import { propagateTwoBody } from './two-body.js';

export interface State { readonly position: readonly [number, number, number]; readonly velocity: readonly [number, number, number] }
export interface SpkSegment {
  readonly name: string; readonly target: number; readonly center: number; readonly frame: number; readonly type: number;
  readonly start: number; readonly stop: number;
  /** State of the target relative to the center at ET, in the segment frame. */
  readonly state: (et: number) => State;
}

function evaluateChebyshev(coefficients: Float64Array, offset: number, count: number, s: number) {
  let value = 0, derivative = 0, tPrev = 1, tCur = s, dPrev = 0, dCur = 1;
  if (count > 0) value += coefficients[offset];
  if (count > 1) { value += coefficients[offset + 1] * s; derivative += coefficients[offset + 1]; }
  for (let k = 2; k < count; k++) {
    const tNext = 2 * s * tCur - tPrev, dNext = 2 * tCur + 2 * s * dCur - dPrev;
    value += coefficients[offset + k] * tNext; derivative += coefficients[offset + k] * dNext;
    tPrev = tCur; tCur = tNext; dPrev = dCur; dCur = dNext;
  }
  return { value, derivative };
}

function chebyshevSegment(daf: Daf, summary: DafSummary, withVelocity: boolean): SpkSegment['state'] {
  const trailer = daf.words(summary.endAddress - 3, 4), init = trailer[0], intlen = trailer[1], rsize = trailer[2], records = trailer[3];
  if (!(intlen > 0) || !Number.isInteger(rsize) || !Number.isInteger(records) || records < 1) throw new Error(`Invalid Chebyshev SPK trailer in ${summary.name}.`);
  const components = withVelocity ? 6 : 3, count = (rsize - 2) / components;
  if (!Number.isInteger(count) || count < 1 || summary.startAddress + rsize * records - 1 > summary.endAddress - 4) throw new Error(`Invalid Chebyshev record size in ${summary.name}.`);
  return et => {
    const index = Math.min(records - 1, Math.max(0, Math.floor((et - init) / intlen)));
    const record = daf.words(summary.startAddress + index * rsize, rsize), mid = record[0], radius = record[1];
    if (!(radius > 0)) throw new Error(`Invalid Chebyshev record radius in ${summary.name}.`);
    const s = (et - mid) / radius;
    if (s < -1 - 1e-9 || s > 1 + 1e-9) throw new Error(`Ephemeris time ${et} is outside record ${index} of ${summary.name}.`);
    const axis = (component: number) => evaluateChebyshev(record, 2 + component * count, count, s);
    const x = axis(0), y = axis(1), z = axis(2);
    if (withVelocity) return { position: [x.value, y.value, z.value], velocity: [axis(3).value, axis(4).value, axis(5).value] };
    return { position: [x.value, y.value, z.value], velocity: [x.derivative / radius, y.derivative / radius, z.derivative / radius] };
  };
}

/** Index of the last epoch not after et, within the sorted list. */
function lastNotAfter(epochs: Float64Array, et: number) {
  let low = 0, high = epochs.length - 1;
  if (et < epochs[0]) return -1;
  while (low < high) { const mid = (low + high + 1) >> 1; if (epochs[mid] <= et) low = mid; else high = mid - 1; }
  return low;
}

/** Window of `size` consecutive epochs around et, clamped to the segment, per NAIF's selection for types 9 and 13. */
function window(epochs: Float64Array, et: number, size: number) {
  const n = epochs.length;
  if (size > n) throw new Error('Interpolation window exceeds the segment.');
  const last = lastNotAfter(epochs, et);
  // Even sizes bracket et with the middle pair; odd sizes centre on the nearer epoch.
  let first = size % 2 === 0 ? last - size / 2 + 1 : (last >= 0 && last + 1 < n && et - epochs[last] > epochs[last + 1] - et ? last + 1 : last) - (size - 1) / 2;
  first = Math.max(0, Math.min(n - size, first));
  return first;
}

function lagrange(epochs: Float64Array, values: (index: number) => number, first: number, size: number, et: number) {
  let sum = 0;
  for (let i = 0; i < size; i++) {
    let basis = 1;
    for (let j = 0; j < size; j++) if (j !== i) basis *= (et - epochs[first + j]) / (epochs[first + i] - epochs[first + j]);
    sum += basis * values(first + i);
  }
  return sum;
}

/** Hermite interpolation of a function from values and derivatives at `size` nodes, returning value and derivative at et. */
function hermite(nodes: number[], values: number[], derivatives: number[], et: number) {
  // Divided-difference table on doubled nodes.
  const n = nodes.length, count = 2 * n, x: number[] = [], q: number[][] = [];
  for (let i = 0; i < n; i++) { x.push(nodes[i], nodes[i]); }
  for (let i = 0; i < count; i++) q.push(new Array<number>(count).fill(0));
  for (let i = 0; i < n; i++) { q[2 * i][0] = values[i]; q[2 * i + 1][0] = values[i]; q[2 * i + 1][1] = derivatives[i]; if (i) q[2 * i][1] = (q[2 * i][0] - q[2 * i - 1][0]) / (x[2 * i] - x[2 * i - 1]); }
  for (let j = 2; j < count; j++) for (let i = j; i < count; i++) q[i][j] = (q[i][j - 1] - q[i - 1][j - 1]) / (x[i] - x[i - j]);
  // Evaluate the Newton form and its derivative.
  let value = q[count - 1][count - 1], derivative = 0;
  for (let i = count - 2; i >= 0; i--) { derivative = derivative * (et - x[i]) + value; value = value * (et - x[i]) + q[i][i]; }
  return { value, derivative };
}

function discreteSegment(daf: Daf, summary: DafSummary, type: 9 | 13): SpkSegment['state'] {
  const trailer = daf.words(summary.endAddress - 1, 2), degree = trailer[0], count = trailer[1];
  if (!Number.isInteger(degree) || !Number.isInteger(count) || count < 2 || degree < 1) throw new Error(`Invalid type ${type} SPK trailer in ${summary.name}.`);
  const epochs = daf.words(summary.startAddress + count * 6, count);
  for (let i = 1; i < count; i++) if (!(epochs[i] > epochs[i - 1])) throw new Error(`Type ${type} SPK epochs are not increasing in ${summary.name}.`);
  const stateAt = (index: number) => daf.words(summary.startAddress + index * 6, 6);
  const size = type === 9 ? degree + 1 : (degree + 1) / 2;
  if (!Number.isInteger(size)) throw new Error(`Type 13 SPK degree must be odd in ${summary.name}.`);
  return et => {
    if (et < epochs[0] - 1e-9 || et > epochs[count - 1] + 1e-9) throw new Error(`Ephemeris time ${et} is outside ${summary.name}.`);
    const first = window(epochs, et, size), states = Array.from({ length: size }, (_, i) => stateAt(first + i));
    if (type === 9) {
      const component = (k: number) => lagrange(epochs, index => states[index - first][k], first, size, et);
      return { position: [component(0), component(1), component(2)], velocity: [component(3), component(4), component(5)] };
    }
    const nodes = Array.from({ length: size }, (_, i) => epochs[first + i]);
    const axis = (k: number) => hermite(nodes, states.map(state => state[k]), states.map(state => state[k + 3]), et);
    const x = axis(0), y = axis(1), z = axis(2);
    return { position: [x.value, y.value, z.value], velocity: [x.derivative, y.derivative, z.derivative] };
  };
}

/** Type 5: discrete states with two-body propagation between the bracketing epochs, blended by a cosine taper (NAIF spke05). */
function twoBodySegment(daf: Daf, summary: DafSummary): SpkSegment['state'] {
  const trailer = daf.words(summary.endAddress - 1, 2), gm = trailer[0], count = trailer[1];
  if (!(gm > 0) || !Number.isInteger(count) || count < 1) throw new Error(`Invalid type 5 SPK trailer in ${summary.name}.`);
  const epochs = daf.words(summary.startAddress + count * 6, count);
  const stateAt = (index: number) => { const s = daf.words(summary.startAddress + index * 6, 6); return { position: [s[0], s[1], s[2]] as [number, number, number], velocity: [s[3], s[4], s[5]] as [number, number, number] }; };
  return et => {
    if (et < summary.doubles[0] - 1e-9 || et > summary.doubles[1] + 1e-9) throw new Error(`Ephemeris time ${et} is outside ${summary.name}.`);
    const last = Math.max(0, lastNotAfter(epochs, et));
    if (et === epochs[last] || last === count - 1 || et < epochs[0]) return propagateTwoBody(gm, stateAt(last), et - epochs[last]);
    const before = propagateTwoBody(gm, stateAt(last), et - epochs[last]), after = propagateTwoBody(gm, stateAt(last + 1), et - epochs[last + 1]);
    const w = 0.5 * (1 - Math.cos(Math.PI * (et - epochs[last]) / (epochs[last + 1] - epochs[last])));
    const blend = (a: readonly number[], b: readonly number[]) => [0, 1, 2].map(i => (1 - w) * a[i] + w * b[i]) as [number, number, number];
    return { position: blend(before.position, after.position), velocity: blend(before.velocity, after.velocity) };
  };
}

/** Type 8: equally spaced states with Lagrange interpolation over a window of degree + 1 states. */
function equalStepSegment(daf: Daf, summary: DafSummary): SpkSegment['state'] {
  const trailer = daf.words(summary.endAddress - 3, 4), start = trailer[0], step = trailer[1], degree = trailer[2], count = trailer[3];
  if (!(step > 0) || !Number.isInteger(degree) || degree < 0 || !Number.isInteger(count) || count < 1) throw new Error(`Invalid type 8 SPK trailer in ${summary.name}.`);
  const size = Math.min(degree + 1, count);
  return et => {
    if (et < summary.doubles[0] - 1e-9 || et > summary.doubles[1] + 1e-9) throw new Error(`Ephemeris time ${et} is outside ${summary.name}.`);
    const position = (et - start) / step, nearest = Math.round(position);
    let first = size % 2 === 0 ? Math.floor(position) - size / 2 + 1 : nearest - (size - 1) / 2;
    first = Math.max(0, Math.min(count - size, first));
    const epochs = new Float64Array(size), states: Float64Array[] = [];
    for (let i = 0; i < size; i++) { epochs[i] = start + (first + i) * step; states.push(daf.words(summary.startAddress + (first + i) * 6, 6)); }
    const component = (k: number) => lagrange(epochs, index => states[index][k], 0, size, et);
    return { position: [component(0), component(1), component(2)], velocity: [component(3), component(4), component(5)] };
  };
}

/**
 * Type 1: modified difference arrays (JPL's difference-line navigation format).
 * Each 71-word record holds the final epoch, 15 step sizes, reference position
 * and velocity interleaved, a 15 x 3 difference table and the polynomial
 * orders; the evaluation is NAIF's spke01.
 */
function differenceLineSegment(daf: Daf, summary: DafSummary): SpkSegment['state'] {
  const count = daf.words(summary.endAddress, 1)[0];
  if (!Number.isInteger(count) || count < 1) throw new Error(`Invalid type 1 SPK trailer in ${summary.name}.`);
  const finals = daf.words(summary.startAddress + count * 71, count);
  return et => {
    if (et < summary.doubles[0] - 1e-9 || et > summary.doubles[1] + 1e-9) throw new Error(`Ephemeris time ${et} is outside ${summary.name}.`);
    // The first record whose final epoch is not before et.
    let low = 0, high = count - 1;
    while (low < high) { const mid = (low + high) >> 1; if (finals[mid] < et) low = mid + 1; else high = mid; }
    const record = daf.words(summary.startAddress + low * 71, 71);
    const tl = record[0], g = record.subarray(1, 16);
    const refPosition = [record[16], record[18], record[20]], refVelocity = [record[17], record[19], record[21]];
    const dt = (j: number, i: number) => record[22 + i * 15 + j]; // DT(J,I), column major
    const kqmax1 = record[67], kq = [record[68], record[69], record[70]];
    if (!Number.isInteger(kqmax1) || kqmax1 < 2 || kqmax1 > 16) throw new Error(`Invalid type 1 SPK record order in ${summary.name}.`);
    const delta = et - tl;
    let tp = delta;
    const mq2 = kqmax1 - 2;
    let ks = kqmax1 - 1;
    const fc = new Float64Array(16), wc = new Float64Array(15), w = new Float64Array(32);
    fc[0] = 1;
    for (let j = 0; j < mq2; j++) { fc[j + 1] = tp / g[j]; wc[j] = delta / g[j]; tp = delta + g[j]; }
    for (let j = 1; j <= kqmax1; j++) w[j - 1] = 1 / j;
    let jx = 0, ks1 = ks - 1;
    while (ks >= 2) {
      jx++;
      for (let j = 1; j <= jx; j++) w[j + ks - 1] = fc[j] * w[j + ks1 - 1] - wc[j - 1] * w[j + ks - 1];
      ks = ks1; ks1 = ks - 1;
    }
    const position = [0, 1, 2].map(i => { let sum = 0; for (let j = kq[i]; j >= 1; j--) sum += dt(j - 1, i) * w[j + ks - 1]; return refPosition[i] + delta * (refVelocity[i] + delta * sum); }) as [number, number, number];
    for (let j = 1; j <= jx; j++) w[j + ks - 1] = fc[j] * w[j + ks1 - 1] - wc[j - 1] * w[j + ks - 1];
    ks -= 1;
    const velocity = [0, 1, 2].map(i => { let sum = 0; for (let j = kq[i]; j >= 1; j--) sum += dt(j - 1, i) * w[j + ks - 1]; return refVelocity[i] + delta * sum; }) as [number, number, number];
    return { position, velocity };
  };
}

/** Every segment of an SPK, in file order. */
export function spkSegments(daf: Daf): SpkSegment[] {
  if (daf.idWord !== 'DAF/SPK') throw new Error(`Not an SPK: ${daf.idWord}`);
  if (daf.nd !== 2 || daf.ni !== 6) throw new Error('SPK summaries must hold two doubles and six integers.');
  return daf.summaries.map(summary => {
    const [target, center, frame, type] = summary.integers, [start, stop] = summary.doubles;
    const state = type === 2 ? chebyshevSegment(daf, summary, false) : type === 3 ? chebyshevSegment(daf, summary, true)
      : type === 5 ? twoBodySegment(daf, summary) : type === 8 ? equalStepSegment(daf, summary) : type === 1 ? differenceLineSegment(daf, summary)
      : type === 9 || type === 13 ? discreteSegment(daf, summary, type) : null;
    if (!state) throw new Error(`Unsupported SPK segment type ${type} in ${summary.name} (target ${target}).`);
    return { name: summary.name, target, center, frame, type, start, stop, state };
  });
}
