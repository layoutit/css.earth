import { cross3 as cross } from '@cssearth/core';
/**
 * Epoch refinement of a push-frame image against the retained mesh.
 *
 * A push-frame image is many strips, each with its own camera, and all of them hang on two epochs the archive states
 * once for the image: when the pointing is read, and where along its path the spacecraft is taken. A label's start time
 * carries jitter, and a spinning spacecraft turns many pixels in the time that jitter lasts, so the two epochs are fitted
 * to the observed limb: the lit limb every strip shows is compared with the limb the mesh predicts through that strip's
 * camera, and one pair of offsets is found for the whole image. Optics, distortion, the interframe delay and the Sun
 * keep their source values. Edge points are split into a fit and a holdout partition, and the holdout residual and both
 * offsets must stay within the recipe's budget. The limb measurement itself is limb-refinement.mts's.
 */
import type { SourceMesh } from './contracts.mts';
import { limbResidual, limbThreshold, observedLimb, type LimbCamera, type LimbEdgePoint, type LimbImage, type LimbPixelMapping, type Residual } from './limb-refinement.mts';

export interface EpochOffsets { pointingSeconds: number; ephemerisSeconds: number }
/** One strip of the image: its pixels, its fixed distortion and its camera under a pair of epoch offsets. */
export interface RefinableStrip { id: string; image: LimbImage; pixelMapping: LimbPixelMapping; camera(offsets: EpochOffsets): LimbCamera }
export interface StripRefinementPolicy {
  method: 'mesh-limb-epochs';
  maximumPointingSeconds: number; maximumEphemerisSeconds: number; maximumResidualPixels: number;
  minimumControls: number; maximumControls?: number; searchPixels?: number; minimumSharpness?: number;
}


const unit = (v: readonly number[]): [number, number, number] => { const n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n]; };

export function validateStripRefinement(policy: StripRefinementPolicy) {
  const positive = (value: number | undefined) => value !== undefined && Number.isFinite(value) && value > 0;
  if (policy.method !== 'mesh-limb-epochs' || !positive(policy.maximumPointingSeconds) || policy.maximumPointingSeconds > 0.25 ||
      !positive(policy.maximumEphemerisSeconds) || policy.maximumEphemerisSeconds > 5 || !positive(policy.maximumResidualPixels) || policy.maximumResidualPixels > 5 ||
      !Number.isInteger(policy.minimumControls) || policy.minimumControls < 16 || policy.minimumControls > 5000 ||
      (policy.maximumControls !== undefined && (!Number.isInteger(policy.maximumControls) || policy.maximumControls < 2 * policy.minimumControls || policy.maximumControls > 20000)) ||
      (policy.searchPixels !== undefined && (!Number.isInteger(policy.searchPixels) || policy.searchPixels < 8 || policy.searchPixels > 512)) ||
      (policy.minimumSharpness !== undefined && (!Number.isFinite(policy.minimumSharpness) || policy.minimumSharpness < 0 || policy.minimumSharpness > 0.9))) throw new TypeError('Invalid strip epoch refinement.');
}

interface Control { strip: number; point: LimbEdgePoint }

export function refineStripEpochs(strips: readonly RefinableStrip[], mesh: SourceMesh, policy: StripRefinementPolicy) {
  validateStripRefinement(policy);
  const search = policy.searchPixels ?? 64, maximumPoints = policy.maximumControls ?? 1500, zero: EpochOffsets = { pointingSeconds: 0, ephemerisSeconds: 0 };
  // One threshold serves the image: every strip saw the same body against the same sky. A bounded sample of each strip sets it.
  const stride = Math.max(1, Math.ceil(strips.reduce((sum, strip) => sum + strip.image.width * strip.image.height, 0) / 1_000_000));
  const sample: number[] = [];
  for (const { image } of strips) { const accept = image.acceptPixel ?? (() => true); for (let i = 0; i < image.width * image.height; i += stride) if (accept(i)) sample.push(image.planes.IMAGE[i]); }
  const thresholding = limbThreshold(sample, () => true);
  const controls: Control[] = [];
  strips.forEach((strip, index) => { for (const point of observedLimb(strip.image, thresholding.threshold, Math.ceil(maximumPoints / strips.length), thresholding.bodyMean, policy.minimumSharpness ?? 0.15)) controls.push({ strip: index, point }); });
  controls.forEach((control, i) => { control.point.partition = i % 2 === 0 ? 'fit' : 'holdout'; });
  const normals = mesh.indices.map(indices => { const [a, b, c] = indices.map(i => mesh.positions[i]); return unit(cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]])); });
  const evaluate = (offsets: EpochOffsets, subset: readonly Control[], window: number) => {
    const cameras = new Map<number, LimbCamera>();
    return subset.map(({ strip, point }) => {
      let camera = cameras.get(strip);
      if (!camera) { camera = strips[strip].camera(offsets); cameras.set(strip, camera); }
      return limbResidual(point, camera, mesh, camera.positionKm.map(v => v * 1000), camera.sunDirection, window, normals, strips[strip].pixelMapping);
    });
  };
  const litMatched = (residuals: readonly (Residual | null)[], subset: readonly Control[]) => subset.filter((_, i) => residuals[i] !== null && residuals[i]!.lit);
  // Terminator edges meet the far, unlit limb and are dropped by the mesh lighting; what matches within the search window is limb.
  const usable = litMatched(evaluate(zero, controls, search), controls);
  const fitControls = usable.filter(control => control.point.partition === 'fit'), holdout = usable.filter(control => control.point.partition === 'holdout');
  if (fitControls.length < policy.minimumControls || holdout.length < policy.minimumControls) throw new Error(`Strip refinement found ${fitControls.length} fit and ${holdout.length} holdout limb points within ${search} px; ${policy.minimumControls} of each are required.`);
  const statistics = (residuals: readonly (Residual | null)[]) => {
    const values = residuals.filter((r): r is Residual => r !== null && r.lit).map(r => r.residual);
    return { count: values.length, of: residuals.length, rmsPixels: Math.sqrt(values.reduce((s, v) => s + v * v, 0) / Math.max(1, values.length)), meanPixels: values.reduce((s, v) => s + v, 0) / Math.max(1, values.length), maximumPixels: values.reduce((m, v) => Math.max(m, Math.abs(v)), 0) };
  };
  const before = { fit: statistics(evaluate(zero, fitControls, search)), holdout: statistics(evaluate(zero, holdout, search)) };
  // Levenberg-Marquardt over the two offsets with numeric derivatives and a Huber cost, then a re-fit without the outliers.
  const steps = [2e-4, 2e-2], asOffsets = (p: readonly number[]): EpochOffsets => ({ pointingSeconds: p[0], ephemerisSeconds: p[1] });
  const huber = (residuals: readonly (Residual | null)[], scale: number) => residuals.reduce((sum, r) => { if (!r) return sum + scale * scale; const a = Math.abs(r.residual); return sum + (a <= scale ? 0.5 * a * a : scale * (a - 0.5 * scale)); }, 0);
  let parameters = [0, 0], active = fitControls, window = search, scale = Math.max(1, search / 8);
  for (let pass = 0; pass < 2; pass++) {
    let lambda = 1e-3;
    for (let iteration = 0; iteration < 24; iteration++) {
      const base = evaluate(asOffsets(parameters), active, window), cost = huber(base, scale);
      const columns = steps.map((step, axis) => evaluate(asOffsets(parameters.map((v, i) => i === axis ? v + step : v)), active, window));
      const normal = [[0, 0], [0, 0]], rhs = [0, 0];
      let used = 0;
      for (let i = 0; i < active.length; i++) {
        const r = base[i]; if (!r || columns.some(column => column[i] === null)) continue;
        const weight = Math.abs(r.residual) <= scale ? 1 : scale / Math.abs(r.residual), j = columns.map((column, axis) => (column[i]!.residual - r.residual) / steps[axis]);
        for (let a = 0; a < 2; a++) { rhs[a] -= weight * j[a] * r.residual; for (let b = 0; b < 2; b++) normal[a][b] += weight * j[a] * j[b]; }
        used++;
      }
      if (used < policy.minimumControls / 2) throw new Error('Strip refinement lost its limb points during iteration.');
      let accepted = false, moved = 0;
      for (let attempt = 0; attempt < 6 && !accepted; attempt++) {
        const a = normal[0][0] * (1 + lambda), d = normal[1][1] * (1 + lambda), b = normal[0][1], determinant = a * d - b * b;
        if (!(Math.abs(determinant) > 1e-30)) throw new Error('Strip refinement is degenerate: the limb does not constrain both epochs.');
        const step = [(d * rhs[0] - b * rhs[1]) / determinant, (a * rhs[1] - b * rhs[0]) / determinant], trial = parameters.map((v, i) => v + step[i]);
        if (huber(evaluate(asOffsets(trial), active, window), scale) < cost) { parameters = trial; lambda = Math.max(1e-6, lambda / 4); accepted = true; moved = Math.abs(step[0]) / steps[0] + Math.abs(step[1]) / steps[1]; }
        else lambda *= 8;
      }
      if (!accepted || moved < 1e-3) break;
    }
    if (pass === 0) {
      const residuals = evaluate(asOffsets(parameters), active, window);
      const absolute = residuals.filter((r): r is Residual => r !== null).map(r => Math.abs(r.residual)).sort((a, b) => a - b);
      const cutoff = Math.max(0.5, 4 * 1.4826 * (absolute[absolute.length >> 1] ?? 0));
      window = Math.max(8, Math.min(window, Math.ceil(4 * cutoff))); scale = Math.max(1, cutoff / 2);
      active = active.filter((_, i) => residuals[i] !== null && residuals[i]!.lit && Math.abs(residuals[i]!.residual) <= cutoff);
      if (active.length < policy.minimumControls) throw new Error('Strip refinement rejected too many limb points as outliers.');
    }
  }
  const offsets = asOffsets(parameters), finalWindow = Math.max(4, 3 * policy.maximumResidualPixels);
  const after = { fit: statistics(evaluate(offsets, active, finalWindow)), holdout: statistics(evaluate(offsets, holdout, finalWindow)) };
  const holdoutMatched = after.holdout.count / Math.max(1, holdout.length);
  if (Math.abs(offsets.pointingSeconds) > policy.maximumPointingSeconds || Math.abs(offsets.ephemerisSeconds) > policy.maximumEphemerisSeconds)
    throw new Error(`Strip refinement moved the pointing epoch ${offsets.pointingSeconds.toFixed(4)} s and the ephemeris epoch ${offsets.ephemerisSeconds.toFixed(3)} s; the budget is ${policy.maximumPointingSeconds} s and ${policy.maximumEphemerisSeconds} s.`);
  if (after.holdout.rmsPixels > policy.maximumResidualPixels || after.holdout.count < policy.minimumControls || holdoutMatched < 0.6)
    throw new Error(`Strip refinement leaves ${after.holdout.rmsPixels.toFixed(3)} px RMS on ${after.holdout.count} of ${holdout.length} holdout points within ${finalWindow} px; budget ${policy.maximumResidualPixels} px on at least 60% of them.`);
  const report = { method: policy.method, threshold: thresholding.threshold, searchPixels: search, finalWindowPixels: finalWindow, holdoutMatchedFraction: holdoutMatched, strips: strips.length,
    edgePoints: { found: controls.length, lit: usable.length, fit: fitControls.length, holdout: holdout.length, retained: active.length },
    offsets, residuals: { before, after },
    budget: { maximumPointingSeconds: policy.maximumPointingSeconds, maximumEphemerisSeconds: policy.maximumEphemerisSeconds, maximumResidualPixels: policy.maximumResidualPixels, minimumControls: policy.minimumControls },
    limitations: 'Two epochs fitted to the lit limb of the retained mesh across every strip of one image: when the pointing is read and where along its path the spacecraft is taken. Optics, distortion, the interframe delay and the Sun keep their source values. Residuals are along-normal limb distances in pixels; terminator edges are excluded by the mesh lighting, remaining outliers by a robust re-fit.' };
  return { offsets, report };
}
