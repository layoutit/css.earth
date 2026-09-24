import { cross3 as cross } from '../../../src/platform/vector3.mts';
import type { SourceMesh } from './contracts.mts';
import { parseArchivedCamera, parseLimbRefinement } from './source-records.mts';

/**
 * Pointing refinement against the retained mesh. Archived and kernel cameras
 * carry the archive's pointing error: a fraction of a pixel for a solution tuned
 * to the images, tens of pixels for a reconstructed C-kernel. The observed limb
 * of the body is compared with the limb the mesh predicts through the camera,
 * and one small rotation of the camera is fitted so the two agree. Position,
 * focal length and the Sun direction are never changed. Every edge point is
 * assigned to a fit or a holdout partition; the holdout residuals and the
 * correction are reported and must stay within the recipe's budget. Terminator
 * and shadow edges are excluded because the mesh says the surface there is
 * unlit; remaining outliers are dropped by a robust re-fit.
 */
export interface LimbCamera { schema: string; matrix: number[][]; rayMatrix: number[][]; positionKm: number[]; sunDirection: number[] }
export interface LimbImage { width: number; height: number; planes: { IMAGE: ArrayLike<number> }; acceptPixel?(index: number): boolean }
/** Fixed detector distortion. Pointing refinement rotates rays after this mapping. */
export interface LimbPixelMapping {
  toPinhole(x: number, y: number): readonly number[];
  fromPinhole(x: number, y: number): readonly number[];
}
export interface LimbFrame extends LimbImage { camera: unknown; pixelMapping?: LimbPixelMapping }
export interface LimbEdgePoint { x: number; y: number; normal: [number, number]; partition: 'fit' | 'holdout' }
type Vec3 = [number, number, number];
type Matrix3 = [Vec3, Vec3, Vec3];

const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

const unit = (v: readonly number[]): Vec3 => { const n = Math.hypot(v[0], v[1], v[2]); return [v[0] / n, v[1] / n, v[2] / n]; };
const apply = (m: readonly (readonly number[])[], v: readonly number[]): Vec3 => [dot(m[0], v), dot(m[1], v), dot(m[2], v)];
const multiply = (a: readonly (readonly number[])[], b: readonly (readonly number[])[]): Matrix3 =>
  [0, 1, 2].map(i => [0, 1, 2].map(j => a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j])) as Matrix3;


/** Rotation matrix of a rotation vector (radians), Rodrigues form. */
export function rotationOf(omega: readonly number[]): Matrix3 {
  const angle = Math.hypot(omega[0], omega[1], omega[2]);
  if (angle < 1e-15) return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const [x, y, z] = omega.map(v => v / angle), c = Math.cos(angle), s = Math.sin(angle), t = 1 - c;
  return [[t * x * x + c, t * x * y - s * z, t * x * z + s * y], [t * x * y + s * z, t * y * y + c, t * y * z - s * x], [t * x * z - s * y, t * y * z + s * x, t * z * z + c]];
}

function invert(m: readonly (readonly number[])[]): Matrix3 {
  const [a, b, c] = m, p = cross(b, c), q = cross(c, a), r = cross(a, b), det = dot(a, p);
  if (!(Math.abs(det) > 1e-30)) throw new Error('Singular camera ray matrix.');
  return [[p[0] / det, q[0] / det, r[0] / det], [p[1] / det, q[1] / det, r[1] / det], [p[2] / det, q[2] / det, r[2] / det]];
}

/** The camera rotated by `omega` (body-frame rotation vector applied to its rays); position and Sun stay. */
export function rotateCamera(camera: LimbCamera, omega: readonly number[]): LimbCamera {
  const rayMatrix = multiply(rotationOf(omega), camera.rayMatrix);
  let projection = invert(rayMatrix);
  // Normalise as the fitted cameras are: unit third row, positive depth in front of the camera.
  const scale = Math.hypot(...projection[2]);
  projection = projection.map(row => row.map(v => v / scale)) as Matrix3;
  const forward = apply(rayMatrix, [0, 0, 1]); // any pixel's ray points in front of the camera
  if (dot(projection[2], forward) < 0) projection = projection.map(row => row.map(v => -v)) as Matrix3;
  const eye = camera.positionKm;
  return { schema: camera.schema, rayMatrix: rayMatrix.map(row => [...row]), matrix: projection.map(row => [...row, -dot(row, eye)]), positionKm: [...eye], sunDirection: [...camera.sunDirection] };
}

/** Otsu's threshold over the accepted finite values, on a 256-bin histogram between the 0.1 and 99.9 percentiles. */
export function otsuThreshold(values: ArrayLike<number>, accept: (index: number) => boolean) {
  const sample: number[] = [];
  for (let i = 0; i < values.length; i++) if (accept(i) && Number.isFinite(values[i])) sample.push(values[i]);
  if (sample.length < 64) throw new Error('Too few accepted pixels to threshold the limb.');
  sample.sort((a, b) => a - b);
  const low = sample[Math.floor(sample.length * 0.001)], high = sample[Math.min(sample.length - 1, Math.floor(sample.length * 0.999))];
  if (!(high > low)) throw new Error('Image has no contrast to threshold the limb.');
  const bins = 256, histogram = new Float64Array(bins);
  for (const v of sample) histogram[Math.max(0, Math.min(bins - 1, Math.floor((v - low) / (high - low) * bins)))]++;
  let total = sample.length, sumAll = 0; for (let b = 0; b < bins; b++) sumAll += b * histogram[b];
  let weightBackground = 0, sumBackground = 0, best = -1, threshold = 0;
  for (let b = 0; b < bins; b++) {
    weightBackground += histogram[b]; if (weightBackground === 0) continue;
    const weightForeground = total - weightBackground; if (weightForeground === 0) break;
    sumBackground += b * histogram[b];
    const meanBackground = sumBackground / weightBackground, meanForeground = (sumAll - sumBackground) / weightForeground;
    const between = weightBackground * weightForeground * (meanBackground - meanForeground) ** 2;
    if (between > best) { best = between; threshold = b + 1; }
  }
  return low + threshold / bins * (high - low);
}

/**
 * The limb threshold sits just above the space background, not between the two
 * brightness classes: the limb is an abrupt drop to background, while the
 * terminator fades into it, so a mid-level threshold would trace an isophote
 * inside the lit surface. Otsu's split separates the classes; the threshold is
 * the background mean plus five sigma or five percent of the class separation.
 */
export function limbThreshold(values: ArrayLike<number>, accept: (index: number) => boolean) {
  const split = otsuThreshold(values, accept);
  // Space dominates the class below the split, but dim surface near the terminator sits in it too: the median and the
  // median absolute deviation describe space where a mean and sigma would be pulled up by that surface.
  const below: number[] = []; let n1 = 0, s1 = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i]; if (!accept(i) || !Number.isFinite(v)) continue;
    if (v < split) below.push(v); else { n1++; s1 += v; }
  }
  if (below.length < 32 || n1 < 32) throw new Error('Image lacks a background or a body class to place the limb threshold.');
  below.sort((a, b) => a - b);
  const backgroundMedian = below[below.length >> 1], deviations = below.map(v => Math.abs(v - backgroundMedian)).sort((a, b) => a - b);
  const backgroundSigma = 1.4826 * deviations[deviations.length >> 1], bodyMean = s1 / n1;
  return { threshold: backgroundMedian + Math.max(5 * backgroundSigma, 0.05 * (bodyMean - backgroundMedian)), split, backgroundMedian, backgroundSigma, bodyMean };
}

/**
 * Sub-pixel edge points of the thresholded body against background connected to
 * space, with outward normals from the gradient. The limb is an abrupt drop, so
 * the surface two pixels inward is still bright; the terminator fades over many
 * pixels, so there it is barely above the threshold. `minimumSharpness` is that
 * inward brightness as a fraction of the body's mean brightness.
 */
export function observedLimb(frame: LimbImage, threshold: number, maximumPoints: number, bodyMean: number, minimumSharpness = 0.15): LimbEdgePoint[] {
  const { width, height } = frame, values = frame.planes.IMAGE, accept = frame.acceptPixel ?? (() => true);
  const value = (x: number, y: number) => values[y * width + x];
  const onBody = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && accept(y * width + x) && Number.isFinite(value(x, y)) && value(x, y) >= threshold;
  const background = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height && accept(y * width + x) && Number.isFinite(value(x, y)) && value(x, y) < threshold;
  const points: LimbEdgePoint[] = [];
  const neighbours: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  // Only background connected to space counts: shadows and craters enclosed by the body are not limb.
  const space = new Uint8Array(width * height), queue: number[] = [];
  const seed = (x: number, y: number) => { const i = y * width + x; if (!space[i] && background(x, y)) { space[i] = 1; queue.push(i); } };
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if (!background(x, y)) continue;
    if (x === 0 || y === 0 || x === width - 1 || y === height - 1 || neighbours.some(([dx, dy]) => !accept((y + dy) * width + x + dx) || !Number.isFinite(value(x + dx, y + dy)))) seed(x, y);
  }
  while (queue.length) { const i = queue.pop()!, x = i % width, y = (i - x) / width; for (const [dx, dy] of neighbours) if (x + dx >= 0 && y + dy >= 0 && x + dx < width && y + dy < height) seed(x + dx, y + dy); }
  const outerBackground = (x: number, y: number) => space[y * width + x] === 1;
  for (let y = 1; y < height - 1; y++) for (let x = 1; x < width - 1; x++) {
    if (!onBody(x, y)) continue;
    // Isolated bright pixels in space are noise, not body: an edge pixel keeps at least two body neighbours.
    if (neighbours.filter(([dx, dy]) => onBody(x + dx, y + dy)).length < 2) continue;
    const outward = neighbours.find(([dx, dy]) => outerBackground(x + dx, y + dy));
    if (!outward) continue;
    const deeper = value(x - 2 * outward[0], y - 2 * outward[1]);
    if (!onBody(x - 2 * outward[0], y - 2 * outward[1]) || deeper - threshold < minimumSharpness * (bodyMean - threshold)) continue;
    // The threshold crossing between the body pixel and its background neighbour, along the local gradient.
    const gx = (Number.isFinite(value(x + 1, y)) && accept(y * width + x + 1) ? value(x + 1, y) : value(x, y)) - (Number.isFinite(value(x - 1, y)) && accept(y * width + x - 1) ? value(x - 1, y) : value(x, y));
    const gy = (Number.isFinite(value(x, y + 1)) && accept((y + 1) * width + x) ? value(x, y + 1) : value(x, y)) - (Number.isFinite(value(x, y - 1)) && accept((y - 1) * width + x) ? value(x, y - 1) : value(x, y));
    const gradient = Math.hypot(gx, gy);
    const normal: [number, number] = gradient > 0 ? [-gx / gradient, -gy / gradient] : outward;
    // The edge pixel's brightness against its inward neighbour is its fractional coverage: the limb crosses the
    // pixel at coverage minus one half along the outward direction. Without a body neighbour inward, fall back to
    // the threshold crossing toward the background neighbour.
    const inward = value(x - outward[0], y - outward[1]), coverage = onBody(x - outward[0], y - outward[1]) && inward > threshold ? Math.max(0, Math.min(1, value(x, y) / inward)) : null;
    const vo = value(x + outward[0], y + outward[1]), t = coverage !== null ? coverage - 0.5 : Math.max(0, Math.min(1, (value(x, y) - threshold) / (value(x, y) - vo)));
    points.push({ x: x + t * outward[0], y: y + t * outward[1], normal, partition: 'fit' });
  }
  // Sample across the entire raster-ordered list. A floored stride followed by
  // truncation drops the lower limb when the count is not a budget multiple.
  const kept = points.length <= maximumPoints ? points : Array.from({ length: maximumPoints }, (_, i) => points[Math.floor((i + 0.5) * points.length / maximumPoints)]);
  kept.forEach((point, i) => { point.partition = i % 2 === 0 ? 'fit' : 'holdout'; });
  return kept;
}

export interface Residual { residual: number; lit: boolean }

/**
 * Signed distance (pixels, along the outward normal) from an observed edge
 * point to the mesh limb through `camera`; null when no limb lies within
 * `search` pixels. A terminator edge is recognised at the limb it reaches: the
 * search from a terminator runs across the night side and meets the far limb
 * where the surface faces away from the Sun.
 */
export function limbResidual(point: LimbEdgePoint, camera: LimbCamera, mesh: SourceMesh, eye: readonly number[], sun: readonly number[], search: number, normals: readonly Vec3[], pixelMapping?: LimbPixelMapping): Residual | null {
  const ray = (s: number) => {
    const x = point.x + s * point.normal[0], y = point.y + s * point.normal[1];
    const [px, py] = pixelMapping ? pixelMapping.toPinhole(x, y) : [x, y];
    if (![px, py].every(Number.isFinite)) throw new Error('Invalid detector-to-pinhole pixel mapping.');
    return unit(apply(camera.rayMatrix, [px, py, 1]));
  };
  let lit = true;
  // The hit nearest the transition decides: the far limb reached from a terminator edge faces away from the Sun.
  const hits = (s: number) => { const hit = mesh.intersect(eye, ray(s)); if (hit) lit = dot(normals[hit.faceId], sun) > 0; return hit; };
  // Probe outward (or inward) at doubling distances up to `search` itself, then bracket the transition.
  const probes: number[] = []; for (let s = 0.5; s < search; s *= 2) probes.push(s); probes.push(search);
  let inside = 0, outside: number | null = null, insideHit = hits(0);
  if (insideHit) { for (const s of probes) { if (!hits(s)) { outside = s; break; } inside = s; } }
  else { let previous = 0; for (const s of probes) { const hit = hits(-s); if (hit) { insideHit = hit; outside = -previous; inside = -s; break; } previous = s; } }
  if (outside === null || !insideHit) return null;
  // Bisect the hit/miss transition to a sixty-fourth of the bracket.
  let miss: number = outside;
  for (let i = 0; i < 6; i++) { const mid = (inside + miss) / 2; if (hits(mid)) inside = mid; else miss = mid; }
  return { residual: (inside + miss) / 2, lit };
}

export function refineCameraByLimb(frame: LimbFrame, mesh: SourceMesh, policy: unknown, trace?: (event: Record<string, unknown>) => void) {
  const p = parseLimbRefinement(policy), original = parseArchivedCamera(frame.camera) as LimbCamera;
  if (p.method !== 'mesh-limb') throw new Error(`Unsupported camera refinement: ${p.method}`);
  const search = p.searchPixels ?? 64, maximumPoints = p.maximumControls ?? 600;
  const thresholding = limbThreshold(frame.planes.IMAGE, frame.acceptPixel ?? (() => true));
  const threshold = p.threshold ?? thresholding.threshold;
  const points = observedLimb(frame, threshold, maximumPoints, thresholding.bodyMean, p.minimumSharpness ?? 0.15);
  const eye = original.positionKm.map(v => v * 1000), sun = original.sunDirection;
  const normals = mesh.indices.map(indices => { const [a, b, c] = indices.map(i => mesh.positions[i]); return unit(cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]])); });
  const evaluate = (camera: LimbCamera, subset: LimbEdgePoint[], window = search) => subset.map(point => limbResidual(point, camera, mesh, eye, sun, window, normals, frame.pixelMapping));
  // Limb edges all sit at the pointing error from their predicted limb, while terminator and shadow edges spread out to
  // the far limb: the smallest window that matches enough edges is dominated by the limb. Unlit matches never enter.
  // Grow the window until enough edges match and the count plateaus: limb edges arrive together once the window
  // passes the pointing error, while stray matches trickle in with every doubling.
  let window = 4, initial = evaluate(original, points, window);
  const matchedIn = (residuals: (Residual | null)[]) => points.filter((_, i) => residuals[i] !== null && residuals[i]!.lit);
  const matched = () => matchedIn(initial);
  const enough = (residuals: (Residual | null)[]) => { const m = matchedIn(residuals); return m.filter(point => point.partition === 'fit').length >= p.minimumControls && m.filter(point => point.partition === 'holdout').length >= p.minimumControls; };
  while (window < search) {
    const next = Math.min(search, window * 2), trial = evaluate(original, points, next);
    if (enough(initial) && matchedIn(trial).length <= 1.25 * matched().length) break;
    window = next; initial = trial;
  }
  const usable = matched();
  trace?.({ stage: 'matched', window, edges: points.length, usable: usable.length });
  const partition = (name: 'fit' | 'holdout') => usable.filter(point => point.partition === name);
  const fitPoints = partition('fit'), holdoutPoints = partition('holdout');
  if (fitPoints.length < p.minimumControls || holdoutPoints.length < p.minimumControls) throw new Error(`Limb refinement found ${fitPoints.length} fit and ${holdoutPoints.length} holdout edge points within ${window} px; ${p.minimumControls} of each are required.`);
  const statistics = (residuals: (Residual | null)[]) => {
    const values = residuals.filter((r): r is Residual => r !== null && r.lit).map(r => r.residual);
    return { count: values.length, of: residuals.length, rmsPixels: Math.sqrt(values.reduce((s, v) => s + v * v, 0) / Math.max(1, values.length)), maximumPixels: values.reduce((m, v) => Math.max(m, Math.abs(v)), 0), meanPixels: values.reduce((s, v) => s + v, 0) / Math.max(1, values.length) };
  };
  const before = { fit: statistics(evaluate(original, fitPoints, window)), holdout: statistics(evaluate(original, holdoutPoints, window)) };
  // Levenberg-Marquardt on the rotation vector with numeric derivatives and a Huber cost, then a robust re-fit
  // without the outliers. Steps are capped at the match window so a poor derivative cannot throw the limb away.
  let omega: Vec3 = [0, 0, 0], active = fitPoints, camera = original;
  const nativeRay = (x: number, y: number) => {
    const [px, py] = frame.pixelMapping ? frame.pixelMapping.toPinhole(x, y) : [x, y];
    if (![px, py].every(Number.isFinite)) throw new Error('Invalid detector-to-pinhole pixel mapping.');
    return unit(apply(original.rayMatrix, [px, py, 1]));
  };
  const midRay = nativeRay((frame.width - 1) / 2, (frame.height - 1) / 2), nextRay = nativeRay((frame.width + 1) / 2, (frame.height - 1) / 2);
  const radiansPerPixel = Math.acos(Math.max(-1, Math.min(1, dot(midRay, nextRay)))), delta = 0.5 * radiansPerPixel;
  const huber = (residuals: (Residual | null)[], scale: number) => residuals.reduce((sum, r) => { if (!r) return sum + scale * scale; const a = Math.abs(r.residual); return sum + (a <= scale ? 0.5 * a * a : scale * (a - 0.5 * scale)); }, 0);
  let scale = Math.max(1, window / 4);
  for (let pass = 0; pass < 2; pass++) {
    let lambda = 1e-3;
    for (let iteration = 0; iteration < 20; iteration++) {
      camera = rotateCamera(original, omega);
      const base = evaluate(camera, active, window), cost = huber(base, scale);
      const columns = [0, 1, 2].map(axis => { const step: Vec3 = [...omega]; step[axis] += delta; return evaluate(rotateCamera(original, step), active, window); });
      const normal = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], rhs = [0, 0, 0];
      let used = 0;
      for (let i = 0; i < active.length; i++) {
        const r = base[i]; if (!r || columns.some(column => column[i] === null)) continue;
        const weight = Math.abs(r.residual) <= scale ? 1 : scale / Math.abs(r.residual);
        const j = columns.map(column => (column[i]!.residual - r.residual) / delta);
        for (let a = 0; a < 3; a++) { rhs[a] -= weight * j[a] * r.residual; for (let b = 0; b < 3; b++) normal[a][b] += weight * j[a] * j[b]; }
        used++;
      }
      if (used < 12) throw new Error('Limb refinement lost its fit points during iteration.');
      let accepted = false;
      for (let attempt = 0; attempt < 6 && !accepted; attempt++) {
        const damped = normal.map((row, a) => row.map((v, b) => a === b ? v * (1 + lambda) : v));
        let step: Vec3;
        try { step = apply(invert(damped), rhs); } catch { throw new Error('Limb refinement is degenerate: the edge points do not constrain a rotation.'); }
        const length = Math.hypot(...step), limit = window * radiansPerPixel;
        if (length > limit) step = step.map(v => v * limit / length) as Vec3;
        const trial: Vec3 = [omega[0] + step[0], omega[1] + step[1], omega[2] + step[2]];
        if (huber(evaluate(rotateCamera(original, trial), active, window), scale) < cost) { omega = trial; lambda = Math.max(1e-6, lambda / 4); accepted = true; if (length < 1e-8) iteration = 20; }
        else lambda *= 8;
      }
      trace?.({ stage: 'iteration', pass, iteration, used, cost, accepted, omegaMicroradians: omega.map(v => v * 1e6), lambda });
      if (!accepted) break;
    }
    if (pass === 0) {
      // Once the limb is matched, a tight window and a robust cut drop the edges that were never limb.
      const residuals = evaluate(rotateCamera(original, omega), active, window);
      const absolute = residuals.filter((r): r is Residual => r !== null).map(r => Math.abs(r.residual)).sort((a, b) => a - b);
      const mad = absolute[absolute.length >> 1] ?? 0, cutoff = Math.max(0.5, 4 * mad);
      window = Math.max(8, Math.min(window, Math.ceil(4 * cutoff)));
      scale = Math.max(1, cutoff / 2);
      const before = active.length;
      active = active.filter((_, i) => residuals[i] !== null && residuals[i]!.lit && Math.abs(residuals[i]!.residual) <= cutoff);
      trace?.({ stage: 'cut', mad, cutoff, window, before, after: active.length, unmatched: residuals.filter(r => r === null).length, unlit: residuals.filter(r => r !== null && !r.lit).length });
      if (active.length < p.minimumControls) throw new Error('Limb refinement rejected too many edge points as outliers.');
    }
  }
  camera = rotateCamera(original, omega);
  // Final residuals within a tight window: edges that were never limb find no limb there and are counted, not fitted.
  const finalWindow = Math.max(4, 3 * p.maximumResidualPixels);
  const after = { fit: statistics(evaluate(camera, active, finalWindow)), holdout: statistics(evaluate(camera, holdoutPoints, finalWindow)) };
  const holdoutMatched = after.holdout.count / Math.max(1, holdoutPoints.length);
  const correctionDegrees = Math.hypot(...omega) * 180 / Math.PI;
  // The boresight shift in pixels: the original centre ray, projected through the refined camera.
  const centre = [(frame.width - 1) / 2, (frame.height - 1) / 2], centreRay = nativeRay(centre[0], centre[1]);
  const rangeKm = Math.hypot(...original.positionKm), far = original.positionKm.map((v, k) => v + centreRay[k] * rangeKm);
  const h = camera.matrix.map(row => dot(row, far) + row[3]);
  const shifted = frame.pixelMapping ? frame.pixelMapping.fromPinhole(h[0] / h[2], h[1] / h[2]) : [h[0] / h[2], h[1] / h[2]];
  if (![shifted[0], shifted[1]].every(Number.isFinite)) throw new Error('Invalid pinhole-to-detector pixel mapping.');
  const shift = Math.hypot(shifted[0] - centre[0], shifted[1] - centre[1]);
  if (correctionDegrees > p.maximumCorrectionDegrees) throw new Error(`Limb refinement of ${correctionDegrees.toFixed(4)}° exceeds the ${p.maximumCorrectionDegrees}° budget.`);
  // A fit that settled on stray edges leaves most genuine holdout edges unmatched; three in five must lie within the final window.
  if (after.holdout.rmsPixels > p.maximumResidualPixels || after.holdout.count < p.minimumControls || holdoutMatched < 0.6) throw new Error(`Limb refinement leaves ${after.holdout.rmsPixels.toFixed(3)} px RMS on ${after.holdout.count} of ${holdoutPoints.length} holdout points within ${finalWindow} px; budget ${p.maximumResidualPixels} px on at least 60% of them.`);
  const report = { method: p.method, ...(frame.pixelMapping ? { pixelCoordinates: 'native detector; fixed distortion applied before ray rotation' } : {}), threshold, matchWindowPixels: window, finalWindowPixels: finalWindow, holdoutMatchedFraction: holdoutMatched, thresholding: { declared: p.threshold !== undefined, otsuSplit: thresholding.split, backgroundMedian: thresholding.backgroundMedian, backgroundSigma: thresholding.backgroundSigma, bodyMean: thresholding.bodyMean, minimumSharpness: p.minimumSharpness ?? 0.15 }, searchPixels: search,
    edgePoints: { found: points.length, lit: usable.length, fit: fitPoints.length, holdout: holdoutPoints.length, retained: active.length, unlitOrUnmatched: points.length - usable.length },
    correction: { rotationVectorMicroradians: omega.map(v => v * 1e6), degrees: correctionDegrees, boresightShiftPixels: shift },
    residuals: { before, after }, budget: { maximumCorrectionDegrees: p.maximumCorrectionDegrees, maximumResidualPixels: p.maximumResidualPixels, minimumControls: p.minimumControls },
    limitations: 'One rotation of the camera fitted to the lit limb of the retained mesh; range, focal length and Sun direction keep their source values. Residuals are along-normal limb distances in pixels; terminator and shadow edges are excluded by the mesh lighting, remaining outliers by a robust re-fit.' };
  return { camera, report };
}
