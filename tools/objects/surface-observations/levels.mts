import type { ObservationSample, ObservationLevelPolicy, PreparedTriangle } from '../terrestrial-layers/contracts.mts';
export interface OverlapPair {a:number;b:number;samples:number;medianLogRatio:number|null;logMad:number|null;levelError:number|null;accepted:boolean;residualLogRatio?:number}
// Preparation-only overlap calibration and source selection. No samples or
// camera solutions are constructed by the retained runtime.
const median = (values: readonly number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
/** sqrt(pi / 2) x 1.4826: a median's standard error per root sample, in median absolute deviations of normal data. */
const MEDIAN_ERROR = Math.sqrt(Math.PI / 2) * 1.4826;
/** A pair's log level ratio must be known to 0.07: the precision the former spread cap guaranteed at its limit, a spread of 0.3 over the
 * minimum 64 pairs. A scattered but well-sampled overlap then counts, and a precise one needs no authored spread. */
export const MAXIMUM_LEVEL_ERROR = .07;

export function sampleTrianglePoints(faces: Pick<PreparedTriangle, "vertices">[], count: number) {
  if (!Number.isInteger(count) || count < 4 || count > 64) throw new Error('Invalid overlap sample count.');
  return faces.flatMap(({ vertices: [a, b, c] }) => Array.from({ length: count }, (_, i) => {
    const u = Math.sqrt((i + .5) / count), v = (i * .6180339887498949 + .5) % 1;
    return a.map((n, axis) => n * (1 - u) + b[axis] * u * (1 - v) + c[axis] * u * v);
  }));
}

/** Fit one bounded log gain per observation from robust co-located overlap
 * ratios. Frames join through accepted overlaps, and each group keeps the level
 * of its first frame, so the first observation anchors the display and a frame
 * no accepted overlap reaches keeps its own calibrated brightness. Reject gains
 * outside the authored budget rather than inventing a calibration. */
export function fitObservationLevels(samples: ObservationSample[][], policy: ObservationLevelPolicy) {
  const count = samples.length;
  // The bound matches the controlled-camera frame cap; the fit compares every pair, so its cost grows with the square of the count.
  if (count < 2 || count > 32 || samples.some(s => s.length !== samples[0].length)) throw new Error('Invalid observation overlap samples.');
  const pairs: OverlapPair[] = [], weights = new Map<OverlapPair, number>();
  for (let a = 0; a < count; a++) for (let b = a + 1; b < count; b++) {
    const ratios = [];
    for (let i = 0; i < samples[a].length; i++) {
      const x = samples[a][i], y = samples[b][i];
      // Fit levels only on moderate-angle patches; retain other valid pixels
      // for display. This gate never changes the observation coverage mask.
      const maximumAngleDegrees=policy.maximumAngleDegrees;
      if (maximumAngleDegrees !== undefined && [x, y].some(s =>
        typeof s.maximumIncidenceDegrees !== 'number' || typeof s.maximumEmissionDegrees !== 'number' ||
        !Number.isFinite(s.maximumIncidenceDegrees) || !Number.isFinite(s.maximumEmissionDegrees) ||
        s.maximumIncidenceDegrees > maximumAngleDegrees || s.maximumEmissionDegrees > maximumAngleDegrees)) continue;
      // Positive values are necessary for a log ratio, not a coverage mask.
      // Valid zero/negative radiance remains eligible for the displayed mosaic.
      if (!x.reason && !y.reason && Number.isFinite(x.radiance) && Number.isFinite(y.radiance) && x.radiance !== undefined && y.radiance !== undefined && x.radiance > 0 && y.radiance > 0) ratios.push(Math.log(x.radiance / y.radiance));
    }
    const ratio = ratios.length ? median(ratios) : null;
    const mad = ratio === null ? null : median(ratios.map(x => Math.abs(x - ratio)));
    const levelError = mad === null ? null : MEDIAN_ERROR * mad / Math.sqrt(ratios.length);
    const accepted = ratios.length >= policy.minimumPairs && levelError !== null && levelError <= MAXIMUM_LEVEL_ERROR;
    const pair = { a, b, samples: ratios.length, medianLogRatio: ratio, logMad: mad, levelError, accepted };
    pairs.push(pair);
    if (accepted && mad !== null) weights.set(pair, Math.min(ratios.length, 1000) / Math.max(.05, mad) ** 2);
  }
  const group = Array.from({ length: count }, (_, i) => i), root = (i: number): number => group[i] === i ? i : (group[i] = root(group[i]));
  for (const { a, b } of weights.keys()) { const ra = root(a), rb = root(b); if (ra !== rb) group[Math.max(ra, rb)] = Math.min(ra, rb); }
  const columns: number[] = [];
  let n = 0;
  for (let i = 0; i < count; i++) columns.push(root(i) === i ? -1 : n++);
  const matrix = Array.from({ length: n }, () => Array<number>(n).fill(0)), rhs = Array<number>(n).fill(0);
  for (const [pair, weight] of weights) {
    const row = Array<number>(n).fill(0); if (columns[pair.a] >= 0) row[columns[pair.a]] = -1; if (columns[pair.b] >= 0) row[columns[pair.b]] = 1;
    for (let i = 0; i < n; i++) { rhs[i] += row[i] * (pair.medianLogRatio ?? NaN) * weight;
      for (let j = 0; j < n; j++) matrix[i][j] += row[i] * row[j] * weight; }
  }
  const augmented = matrix.map((row, i) => [...row, rhs[i]]);
  for (let k = 0; k < n; k++) {
    let pivot = k; for (let i = k + 1; i < n; i++) if (Math.abs(augmented[i][k]) > Math.abs(augmented[pivot][k])) pivot = i;
    if (Math.abs(augmented[pivot][k]) < 1e-10) throw new Error('Observation overlaps do not connect to the reference image.');
    [augmented[k], augmented[pivot]] = [augmented[pivot], augmented[k]];
    const divisor = augmented[k][k]; for (let j = k; j <= n; j++) augmented[k][j] /= divisor;
    for (let i = 0; i < n; i++) if (i !== k) { const factor = augmented[i][k];
      for (let j = k; j <= n; j++) augmented[i][j] -= factor * augmented[k][j]; }
  }
  const logGains = columns.map(column => column < 0 ? 0 : augmented[column][n]), gains = logGains.map(Math.exp);
  if (gains.some(gain => !Number.isFinite(gain) || gain < 1 / policy.maximumGain || gain > policy.maximumGain)) throw new Error('Observation level fit exceeds its authored gain budget.', { cause: { gains, pairs } });
  for (const pair of pairs) if (pair.accepted && pair.medianLogRatio !== null) pair.residualLogRatio = pair.medianLogRatio + logGains[pair.a] - logGains[pair.b];
  const groups = [...new Set(group.map((_, i) => root(i)))].map(anchor => group.map((_, i) => i).filter(i => root(i) === anchor));
  return { gains, pairs, referenceIndex: 0, ...(groups.length > 1 ? { groups } : {}),
    interpretation: 'Bounded relative display-level adjustment from robust overlaps; not a phase correction or recovered albedo.' };
}

/** Prefer the least foreshortened qualified image. Stable source order breaks
 * exact ties; brightness never controls validity or the winning observation. */
export function selectObservation(samples: readonly ObservationSample[]) {
  let index = -1;
  for (let i = 0; i < samples.length; i++) if (!samples[i].reason && Number.isFinite(samples[i].maximumEmissionDegrees) &&
      (index < 0 || (samples[i].maximumEmissionDegrees ?? Infinity) < (samples[index].maximumEmissionDegrees ?? Infinity))) index = i;
  return index;
}
