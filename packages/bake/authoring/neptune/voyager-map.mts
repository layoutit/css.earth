/**
 * Neptune from Voyager 2's approach, August 1989: placed narrow-angle frames assembled into equirectangular maps.
 *
 *   placed frame → planetographic grid with emission and incidence → Minnaert-normalised reflectance
 *                → carried along its latitude circle to one epoch → one map per filter
 *
 * Each frame is a snapshot of an atmosphere whose clouds drift against the planet's rotation, up to 3 degrees of longitude
 * an hour. A frame is therefore carried to the map's epoch by the drift of its latitude before it is combined, so a map is
 * the planet at that epoch. Clouds also change shape between rotations, so frames a rotation apart are not averaged: each
 * rotation makes its own mosaic and a cell goes to the one that saw it better.
 */
import type { NeptuneFrame, Spheroid } from './voyager-frames.mts';

export interface MapGrid { width: number; height: number }
export interface MosaicPolicy {
  /** Largest emission and incidence angles a sample is used at, in degrees. */
  maximumEmissionDegrees: number; maximumIncidenceDegrees: number;
  /** Frames more than this many hours apart are in different groups: under one 16.11 h rotation, so a group sees no cloud twice. */
  groupHours: number;
  /** How firmly a cell goes to the group that saw it better: the power its summed weight is raised to. */
  groupSharpness: number;
  /** Degrees of longitude a frame may shear a cloud by, per degree of the cloud's height, before it counts for 1/e. */
  shearToleranceDegrees: number;
}
export const MOSAIC_POLICY: MosaicPolicy = { maximumEmissionDegrees: 72, maximumIncidenceDegrees: 78, groupHours: 13, groupSharpness: 3, shearToleranceDegrees: 0.7 };
/** Drift in degrees of east longitude per hour at a planetographic latitude in degrees. */
export type DriftRate = (latitudeDegrees: number) => number;

const D2R = Math.PI / 180;
export const rowLatitude = (row: number, grid: MapGrid) => 90 - (row + 0.5) / grid.height * 180;

/** Columns each row of a frame moves by to reach the epoch: its latitude's drift over the time between them. */
export function columnShifts(frame: NeptuneFrame, grid: MapGrid, drift: DriftRate, epochEt: number) {
  const shifts = new Int32Array(grid.height), hours = (epochEt - frame.et) / 3600;
  for (let row = 0; row < grid.height; row++) shifts[row] = Math.round(drift(rowLatitude(row, grid)) * hours / 360 * grid.width);
  return shifts;
}

/**
 * How much a frame counts at each latitude row. The drift differs from one latitude to the next, so carrying a frame to the
 * epoch shears its clouds by the drift's change across them times the hours carried. Where that change is steep, as in the
 * jet near 70 degrees south, only frames taken close to the epoch keep a cloud's shape, and that part of the planet faces the
 * spacecraft all day, so they are enough. Where the drift is even, as round the Great Dark Spot, every frame counts in full.
 */
export function shearWeights(frame: NeptuneFrame, grid: MapGrid, drift: DriftRate, epochEt: number, policy: MosaicPolicy) {
  const weights = new Float32Array(grid.height), hours = Math.abs(frame.et - epochEt) / 3600;
  for (let row = 0; row < grid.height; row++) {
    const latitude = rowLatitude(row, grid), shearPerDegree = Math.abs(drift(Math.min(89, latitude + 1)) - drift(Math.max(-89, latitude - 1))) / 2;
    // Never nothing: a cell only frames far from the epoch reached still takes them, and a frame fades out towards its edge.
    weights[row] = Math.max(0.02, Math.exp(-((hours * shearPerDegree / policy.shearToleranceDegrees) ** 2)));
  }
  return weights;
}

/** Visit every grid cell a frame sees: planetographic latitude rows north to south, east longitude columns from 0, moved by `shifts`. */
export function forEachSample(frame: NeptuneFrame, { equatorialKm: a, polarKm: c }: Spheroid, grid: MapGrid, policy: MosaicPolicy,
  visit: (index: number, value: number, mu: number, mu0: number, row: number) => void, shifts?: Int32Array, stride = 1) {
  const { matrix: m, positionKm: o, sunDirection: s, values, usable, width, height } = frame;
  const cosE = Math.cos(policy.maximumEmissionDegrees * D2R), cosI = Math.cos(policy.maximumIncidenceDegrees * D2R);
  const cosLon = new Float64Array(grid.width), sinLon = new Float64Array(grid.width);
  for (let x = 0; x < grid.width; x++) { const lon = (x + 0.5) / grid.width * 2 * Math.PI; cosLon[x] = Math.cos(lon); sinLon[x] = Math.sin(lon); }
  for (let y = 0; y < grid.height; y += stride) {
    const latitude = rowLatitude(y, grid) * D2R, sinG = Math.sin(latitude), cosG = Math.cos(latitude), shift = shifts ? shifts[y]! : 0;
    // Planetographic latitude to the point on the spheroid: the parametric latitude has tan = (c / a) tan(planetographic).
    const parametric = Math.atan2(c * sinG, a * cosG), rxy = a * Math.cos(parametric), rz = c * Math.sin(parametric);
    for (let x = 0; x < grid.width; x += stride) {
      const nx = cosG * cosLon[x]!, ny = cosG * sinLon[x]!, nz = sinG, mu0 = nx * s[0]! + ny * s[1]! + nz * s[2]!;
      if (mu0 < cosI) continue;
      const px = rxy * cosLon[x]!, py = rxy * sinLon[x]!, vx = o[0]! - px, vy = o[1]! - py, vz = o[2]! - rz, mu = (nx * vx + ny * vy + nz * vz) / Math.hypot(vx, vy, vz);
      if (mu < cosE) continue;
      const w = m[2]![0]! * px + m[2]![1]! * py + m[2]![2]! * rz + m[2]![3]!;
      const u = (m[0]![0]! * px + m[0]![1]! * py + m[0]![2]! * rz + m[0]![3]!) / w, v = (m[1]![0]! * px + m[1]![1]! * py + m[1]![2]! * rz + m[1]![3]!) / w;
      const u0 = Math.floor(u), v0 = Math.floor(v);
      if (u0 < 0 || v0 < 0 || u0 >= width - 1 || v0 >= height - 1) continue;
      const fu = u - u0, fv = v - v0, i = v0 * width + u0;
      if (!usable[i]) continue;
      const value = (values[i]! * (1 - fu) + values[i + 1]! * fu) * (1 - fv) + (values[i + width]! * (1 - fu) + values[i + width + 1]! * fu) * fv;
      visit(y * grid.width + ((x + shift) % grid.width + grid.width) % grid.width, value, mu, mu0, y);
    }
  }
}

/**
 * Minnaert exponent of one filter from its own frames: the slope of ln(I mu) against ln(mu mu0), with every latitude band
 * given its own level so the planet's belts do not pull the slope.
 */
export function fitMinnaert(frames: readonly NeptuneFrame[], spheroid: Spheroid, grid: MapGrid, policy: MosaicPolicy) {
  const bands = 36, sx = new Float64Array(bands), sy = new Float64Array(bands), sxx = new Float64Array(bands), sxy = new Float64Array(bands), n = new Float64Array(bands);
  for (const frame of frames) forEachSample(frame, spheroid, grid, policy, (_index, value, mu, mu0, row) => {
    const band = Math.min(bands - 1, Math.floor(row / grid.height * bands)), x = Math.log(mu * mu0), y = Math.log(value * mu);
    sx[band]! += x; sy[band]! += y; sxx[band]! += x * x; sxy[band]! += x * y; n[band]! += 1;
  }, undefined, 6);
  let numerator = 0, denominator = 0, samples = 0;
  for (let band = 0; band < bands; band++) if (n[band]! > 200) { numerator += sxy[band]! - sx[band]! * sy[band]! / n[band]!; denominator += sxx[band]! - sx[band]! * sx[band]! / n[band]!; samples += n[band]!; }
  return { k: numerator / denominator, samples };
}

const normalised = (value: number, mu: number, mu0: number, k: number) => value / (mu0 ** k * mu ** (k - 1));

/** One frame alone on the grid at the epoch: Minnaert-normalised reflectance, NaN where the frame does not see. */
export function frameMap(frame: NeptuneFrame, k: number, spheroid: Spheroid, grid: MapGrid, policy: MosaicPolicy, shifts?: Int32Array) {
  const map = new Float32Array(grid.width * grid.height).fill(NaN);
  forEachSample(frame, spheroid, grid, policy, (index, value, mu, mu0) => { map[index] = normalised(value, mu, mu0, k); }, shifts);
  return map;
}

/**
 * One gain per frame so that frames agree where they overlap: each frame's level against the consensus of the others,
 * iterated, with the gains' geometric mean held at 1. Frames of one set differ by a few percent in calibration and in how
 * well one exponent describes their limb.
 */
export function equaliseGains(maps: readonly Float32Array[], iterations = 30) {
  const logGain = new Float64Array(maps.length), cells = maps[0]?.length ?? 0;
  for (let iteration = 0; iteration < iterations; iteration++) {
    const sum = new Float64Array(cells), count = new Uint16Array(cells);
    maps.forEach((map, f) => { for (let i = 0; i < cells; i++) { const v = map[i]!; if (v > 0) { sum[i]! += Math.log(v) + logGain[f]!; count[i]!++; } } });
    maps.forEach((map, f) => {
      let difference = 0, n = 0;
      for (let i = 0; i < cells; i++) { const v = map[i]!; if (v > 0 && count[i]! > 1) { difference += sum[i]! / count[i]! - (Math.log(v) + logGain[f]!); n++; } }
      if (n > 0) logGain[f]! += 0.7 * difference / n;
    });
    const mean = logGain.reduce((p, q) => p + q, 0) / maps.length;
    for (let f = 0; f < maps.length; f++) logGain[f]! -= mean;
  }
  return Array.from(logGain, value => Math.exp(value));
}

export interface FilterMosaic { value: Float32Array; frames: number }
export interface MosaicFrame { frame: NeptuneFrame; k: number; gain: number; shifts: Int32Array; limb?: LimbResidual }
/** What one Minnaert exponent leaves behind: a frame's level against the consensus map, by emission and incidence cosine. */
export interface LimbResidual { bins: Float32Array }
const LIMB_BINS = 16;
const limbFactor = (limb: LimbResidual | undefined, mu: number, mu0: number) => {
  if (!limb) return 1;
  const px = Math.min(LIMB_BINS - 1.001, Math.max(0, mu * LIMB_BINS - 0.5)), py = Math.min(LIMB_BINS - 1.001, Math.max(0, mu0 * LIMB_BINS - 0.5));
  const x = Math.floor(px), y = Math.floor(py), fx = px - x, fy = py - y, b = limb.bins;
  return (b[y * LIMB_BINS + x]! * (1 - fx) + b[y * LIMB_BINS + x + 1]! * fx) * (1 - fy) + (b[(y + 1) * LIMB_BINS + x]! * (1 - fx) + b[(y + 1) * LIMB_BINS + x + 1]! * fx) * fy;
};

/**
 * The photometric residual of a set of frames, measured against their own mosaic: the mean ratio of a frame's normalised
 * value to the consensus, in bins of the emission and incidence cosines. At 15 degrees of phase the two differ by which
 * side of the disc a cell sits on, which one exponent cannot describe. Dividing by the residual removes the brightness steps
 * where frames that saw a cell from different sides meet.
 */
export function measureLimbResidual(frames: readonly MosaicFrame[], consensus: Float32Array, spheroid: Spheroid, grid: MapGrid, policy: MosaicPolicy): LimbResidual {
  const sum = new Float64Array(LIMB_BINS * LIMB_BINS), count = new Float64Array(LIMB_BINS * LIMB_BINS);
  for (const { frame, k, gain, shifts } of frames) forEachSample(frame, spheroid, grid, policy, (index, value, mu, mu0) => {
    const reference = consensus[index]!;
    if (!(reference > 0)) return;
    const bin = Math.min(LIMB_BINS - 1, Math.floor(mu0 * LIMB_BINS)) * LIMB_BINS + Math.min(LIMB_BINS - 1, Math.floor(mu * LIMB_BINS));
    sum[bin]! += Math.log(gain * normalised(value, mu, mu0, k) / reference); count[bin]! += 1;
  }, shifts, 3);
  const bins = new Float32Array(LIMB_BINS * LIMB_BINS).fill(NaN);
  for (let bin = 0; bin < bins.length; bin++) if (count[bin]! > 300) bins[bin] = Math.exp(sum[bin]! / count[bin]!);
  // Bins no frame reached take their nearest measured neighbour, so the lookup never meets a hole.
  const filled = Float32Array.from(bins);
  for (let y = 0; y < LIMB_BINS; y++) for (let x = 0; x < LIMB_BINS; x++) {
    if (!Number.isNaN(bins[y * LIMB_BINS + x]!)) continue;
    let best = Infinity, value = 1;
    for (let q = 0; q < LIMB_BINS; q++) for (let p = 0; p < LIMB_BINS; p++) { const v = bins[q * LIMB_BINS + p]!; if (Number.isNaN(v)) continue; const d = (p - x) ** 2 + (q - y) ** 2; if (d < best) { best = d; value = v; } }
    filled[y * LIMB_BINS + x] = value;
  }
  return { bins: filled };
}

/**
 * One map of Minnaert-normalised reflectance at the epoch. Frames are given in groups, each within one rotation: inside a
 * group the clouds agree once carried to the epoch, so its frames are averaged by how squarely each saw a cell. Groups are
 * a rotation apart and their clouds have changed shape, so a cell goes to the group that saw it better, with a gradual
 * hand-over where the two saw it equally well.
 */
export function mosaic(groups: readonly (readonly MosaicFrame[])[], spheroid: Spheroid, grid: MapGrid, policy: MosaicPolicy, drift: DriftRate, epochEt: number): FilterMosaic {
  const cells = grid.width * grid.height, total = new Float32Array(cells), totalWeight = new Float32Array(cells);
  for (const frames of groups) {
    const sum = new Float32Array(cells), weight = new Float32Array(cells);
    for (const { frame, k, gain, shifts, limb } of frames) {
      const unsheared = shearWeights(frame, grid, drift, epochEt, policy);
      forEachSample(frame, spheroid, grid, policy, (index, value, mu, mu0, row) => {
        const w = (mu * mu * mu0) ** 2 * unsheared[row]!;
        sum[index]! += w * gain * normalised(value, mu, mu0, k) / limbFactor(limb, mu, mu0); weight[index]! += w;
      }, shifts);
    }
    for (let i = 0; i < cells; i++) if (weight[i]! > 0) { const share = weight[i]! ** policy.groupSharpness; total[i]! += share * sum[i]! / weight[i]!; totalWeight[i]! += share; }
  }
  const value = new Float32Array(cells).fill(NaN);
  for (let i = 0; i < cells; i++) if (totalWeight[i]! > 0) value[i] = total[i]! / totalWeight[i]!;
  return { value, frames: groups.reduce((n, frames) => n + frames.length, 0) };
}

/** Frames split in time into groups no longer than `maximumHours`, by even division of the span they cover. */
export function rotationGroups<T extends { frame: NeptuneFrame }>(frames: readonly T[], maximumHours: number): T[][] {
  const first = Math.min(...frames.map(entry => entry.frame.et)), span = (Math.max(...frames.map(entry => entry.frame.et)) - first) / 3600;
  const count = Math.max(1, Math.ceil(span / maximumHours)), groups: T[][] = Array.from({ length: count }, () => []);
  for (const entry of frames) groups[Math.min(count - 1, Math.floor((entry.frame.et - first) / 3600 / (span / count || 1)))]!.push(entry);
  return groups.filter(group => group.length > 0);
}

/** Gaussian blur of a map with holes: wraps in longitude, ignores NaN cells, and leaves NaN where nothing is near. */
export function blurMap(map: Float32Array, grid: MapGrid, sigmaColumns: number) {
  const radius = Math.ceil(3 * sigmaColumns), kernel = new Float32Array(2 * radius + 1);
  for (let d = -radius; d <= radius; d++) kernel[d + radius] = Math.exp(-0.5 * (d / sigmaColumns) ** 2);
  const pass = (source: Float32Array, weightIn: Float32Array | null, horizontal: boolean) => {
    const value = new Float32Array(source.length), weight = new Float32Array(source.length);
    for (let y = 0; y < grid.height; y++) for (let x = 0; x < grid.width; x++) {
      let sum = 0, total = 0;
      for (let d = -radius; d <= radius; d++) {
        const xx = horizontal ? ((x + d) % grid.width + grid.width) % grid.width : x, yy = horizontal ? y : y + d;
        if (yy < 0 || yy >= grid.height) continue;
        const i = yy * grid.width + xx, w = weightIn ? weightIn[i]! : Number.isNaN(source[i]!) ? 0 : 1;
        if (w === 0) continue;
        sum += kernel[d + radius]! * source[i]!; total += kernel[d + radius]! * w;
      }
      value[y * grid.width + x] = sum; weight[y * grid.width + x] = total;
    }
    return { value, weight };
  };
  const first = pass(map, null, true), second = pass(first.value, first.weight, false), out = new Float32Array(map.length).fill(NaN);
  for (let i = 0; i < out.length; i++) if (second.weight[i]! > 1e-3) out[i] = second.value[i]! / second.weight[i]!;
  return out;
}
