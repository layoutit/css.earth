// Preparation-only overlap calibration and source selection. No samples or
// camera solutions are constructed by the retained runtime.
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

export function sampleTrianglePoints(faces, count) {
  if (!Number.isInteger(count) || count < 4 || count > 64) throw new Error('Invalid overlap sample count.');
  return faces.flatMap(({ vertices: [a, b, c] }) => Array.from({ length: count }, (_, i) => {
    const u = Math.sqrt((i + .5) / count), v = (i * .6180339887498949 + .5) % 1;
    return a.map((n, axis) => n * (1 - u) + b[axis] * u * (1 - v) + c[axis] * u * v);
  }));
}

/** Fit one bounded log gain per observation from robust co-located overlap
 * ratios. The first observation anchors the display. Reject disconnected data
 * or gains outside the authored budget rather than inventing a calibration. */
export function fitObservationLevels(samples, policy) {
  const count = samples.length, n = count - 1;
  if (count < 2 || count > 8 || samples.some(s => s.length !== samples[0].length)) throw new Error('Invalid observation overlap samples.');
  const matrix = Array.from({ length: n }, () => Array(n).fill(0)), rhs = Array(n).fill(0), pairs = [];
  for (let a = 0; a < count; a++) for (let b = a + 1; b < count; b++) {
    const ratios = [];
    for (let i = 0; i < samples[a].length; i++) {
      const x = samples[a][i], y = samples[b][i];
      // Fit levels only on moderate-angle patches; retain other valid pixels
      // for display. This gate never changes the observation coverage mask.
      if (policy.maximumAngleDegrees !== undefined && [x, y].some(s =>
        !Number.isFinite(s.maximumIncidenceDegrees) || !Number.isFinite(s.maximumEmissionDegrees) ||
        s.maximumIncidenceDegrees > policy.maximumAngleDegrees || s.maximumEmissionDegrees > policy.maximumAngleDegrees)) continue;
      // Positive values are necessary for a log ratio, not a coverage mask.
      // Valid zero/negative radiance remains eligible for the displayed mosaic.
      if (!x.reason && !y.reason && Number.isFinite(x.radiance) && Number.isFinite(y.radiance) && x.radiance > 0 && y.radiance > 0) ratios.push(Math.log(x.radiance / y.radiance));
    }
    const ratio = ratios.length ? median(ratios) : null;
    const mad = ratio === null ? null : median(ratios.map(x => Math.abs(x - ratio)));
    const accepted = ratios.length >= policy.minimumPairs && mad <= policy.maximumLogMad;
    const pair = { a, b, samples: ratios.length, medianLogRatio: ratio, logMad: mad, accepted };
    pairs.push(pair); if (!accepted) continue;
    const weight = Math.min(ratios.length, 1000) / Math.max(.05, mad) ** 2;
    const row = Array(n).fill(0); if (a) row[a - 1] = -1; if (b) row[b - 1] = 1;
    for (let i = 0; i < n; i++) { rhs[i] += row[i] * ratio * weight;
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
  const logGains = [0, ...augmented.map(row => row[n])], gains = logGains.map(Math.exp);
  if (gains.some(gain => !Number.isFinite(gain) || gain < 1 / policy.maximumGain || gain > policy.maximumGain)) throw new Error('Observation level fit exceeds its authored gain budget.', { cause: { gains, pairs } });
  for (const pair of pairs) if (pair.accepted) pair.residualLogRatio = pair.medianLogRatio + logGains[pair.a] - logGains[pair.b];
  return { gains, pairs, referenceIndex: 0, interpretation: 'Bounded relative display-level adjustment from robust overlaps; not a phase correction or recovered albedo.' };
}

/** Prefer the least foreshortened qualified image. Stable source order breaks
 * exact ties; brightness never controls validity or the winning observation. */
export function selectObservation(samples) {
  let index = -1;
  for (let i = 0; i < samples.length; i++) if (!samples[i].reason && Number.isFinite(samples[i].maximumEmissionDegrees) &&
      (index < 0 || samples[i].maximumEmissionDegrees < samples[index].maximumEmissionDegrees)) index = i;
  return index;
}
