/** Automatic 2D ellipse hypotheses. Geometry is fitted to image ridges, never authored per nebula. */
import { fitEllipse, ellipsePoint, supportedArcs, radialError, tau, type Ellipse, type Arc, type Point } from './ellipse.ts';
import { ridgeEvidence, type RidgeField } from './ridges.ts';
import { contourField, extractContours } from './contours.ts';
import { readDetectionSettings, type DetectionSettings } from './settings.ts';
export type { DetectionSettings } from './settings.ts';
export interface DetectionProgress { onProgress?(completed: number, total: number): void }
export interface ShapeCandidate extends Ellipse { id: string; score: number; coverage: number; supportedArcs: Arc[]; groupId?: string }
export interface ShapeGroup { id: string; members: string[]; center: Point }
interface Scored extends Ellipse { score: number; coverage: number; supported: boolean[]; pixels: number[] }
function random(seed: number) { let state = seed >>> 0; return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }; }

function evaluate(ellipse: Ellipse, field: RidgeField, count: number, sensitivity: number): Scored {
  const c = Math.cos(ellipse.angleRadians), s = Math.sin(ellipse.angleRadians), supported: boolean[] = [], pixels: number[] = [];
  const tolerance = Math.max(1.5, Math.min(field.width, field.height) / 200);
  let sum = 0, covered = 0;
  for (let i = 0; i < count; i++) {
    const t = (i + .5) * tau / count, [x, y] = ellipsePoint(ellipse, t);
    const gx = Math.cos(t) / ellipse.radii[0], gy = Math.sin(t) / ellipse.radii[1], length = Math.hypot(gx, gy);
    const evidence = ridgeEvidence(field, x, y, (gx * c - gy * s) / length, (gx * s + gy * c) / length, tolerance);
    const ok = evidence.strength >= .3 / sensitivity; supported.push(ok); pixels.push(ok ? evidence.pixel : -1);
    if (ok) covered++;
    sum += evidence.strength;
  }
  const coverage = covered / count;
  // Unobserved sectors count against support; bright short fragments cannot alone score as a complete ring.
  return { ...ellipse, coverage, score: sum / count * Math.sqrt(coverage), supported, pixels };
}
function plausible(e: Ellipse | null, width: number, height: number, minimum: number): e is Ellipse {
  return e !== null && [...e.center, ...e.radii, e.angleRadians].every(Number.isFinite) &&
    e.radii[1] >= minimum && e.radii[0] >= e.radii[1] && e.radii[0] <= Math.max(width, height) * .85 && e.radii[1] / e.radii[0] >= .3 &&
    e.center[0] >= -.15 * width && e.center[0] <= 1.15 * width && e.center[1] >= -.15 * height && e.center[1] <= 1.15 * height;
}
function sameEllipse(a: Ellipse, b: Ellipse): boolean {
  if (Math.hypot(a.center[0] - b.center[0], a.center[1] - b.center[1]) > Math.min(a.radii[1], b.radii[1]) * .16) return false;
  let error = 0;
  for (let i = 0; i < 24; i++) error += radialError(b, ellipsePoint(a, i * tau / 24));
  return error / 24 < Math.max(4, Math.min(a.radii[1], b.radii[1]) * .065);
}
function refine(initial: Scored, field: RidgeField, minimum: number, sensitivity: number): Scored {
  let best = evaluate(initial, field, 180, sensitivity);
  // Refit consensus points first, then coordinate search on the actual oriented-ridge objective.
  const inliers: Point[] = best.pixels.filter(p => p >= 0).map(p => [p % field.width + .5, Math.floor(p / field.width) + .5]);
  const fitted = fitEllipse(inliers, Math.max(field.width, field.height));
  if (plausible(fitted, field.width, field.height, minimum)) {
    const score = evaluate(fitted, field, 180, sensitivity); if (score.score > best.score) best = score;
  }
  for (const step of [4, 2, 1, .5]) for (let round = 0; round < 2; round++) for (let axis = 0; axis < 5; axis++) for (const sign of [-1, 1]) {
    const e: Ellipse = { center: [...best.center], radii: [...best.radii], angleRadians: best.angleRadians };
    if (axis < 2) e.center[axis] += sign * step;
    else if (axis < 4) e.radii[axis - 2] += sign * step;
    else e.angleRadians = (e.angleRadians + sign * step / e.radii[0] + Math.PI) % Math.PI;
    if (!plausible(e, field.width, field.height, minimum)) continue;
    const score = evaluate(e, field, 180, sensitivity); if (score.score > best.score) best = score;
  }
  return evaluate(best, field, 360, sensitivity);
}

/** Same projected center is a geometric relationship, not proof of a common physical shell or axis. */
export function groupShapes(candidates: ShapeCandidate[]): ShapeGroup[] {
  const groups: ShapeGroup[] = [], used = new Set<string>();
  for (const candidate of candidates) {
    if (used.has(candidate.id)) continue;
    const members = candidates.filter(other => !used.has(other.id) && Math.hypot(candidate.center[0] - other.center[0], candidate.center[1] - other.center[1]) <
      Math.min(candidate.radii[1], other.radii[1]) * .15);
    if (members.length < 2) continue;
    const id = `center-${groups.length + 1}`, center: Point = [0, 0];
    for (const member of members) { used.add(member.id); member.groupId = id; center[0] += member.center[0] / members.length; center[1] += member.center[1] / members.length; }
    groups.push({ id, members: members.map(member => member.id), center });
  }
  return groups;
}

export function detectShapes(rgb: Uint8Array, width: number, height: number, settings: Partial<DetectionSettings> = {}, options: DetectionProgress = {}) {
  const config = readDetectionSettings(settings);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 32 || height < 32 || width * height > 1_000_000 || rgb.length !== width * height * 3)
    throw new TypeError('Geometry detection requires a complete RGB raster of 32px or greater, bounded to one million pixels.');
  const rng = random(config.seed), minimum = Math.min(width, height) * config.minRadiusFraction;
  const contours = extractContours(rgb, width, height, minimum, config.sensitivity), refined: Scored[] = [];
  const total = contours.length + 1;
  options.onProgress?.(0, total);
  let validProposals = 0;
  // Fit connected boundaries separately. Unrelated patches must never combine into invented arc support.
  for (const [contourIndex, contour] of contours.entries()) {
    const field = contourField(contour, width, height), points = field.points, pool: Scored[] = [];
    const iterations = Math.max(100, Math.floor(config.iterations / Math.max(1, contours.length)));
    for (let i = 0; i < iterations; i++) {
      const sample: Point[] = [];
      if (i === 0) for (const p of points) sample.push([p.x, p.y]);
      else for (let j = 0; j < 5; j++) { const p = points[Math.floor(rng() * points.length)]!; sample.push([p.x, p.y]); }
      const ellipse = fitEllipse(sample, Math.max(width, height));
      if (!plausible(ellipse, width, height, minimum)) continue;
      validProposals++;
      const scored = evaluate(ellipse, field, 72, config.sensitivity);
      if (scored.coverage < .3 || scored.score < .15 / config.sensitivity) continue;
      const duplicate = pool.findIndex(candidate => sameEllipse(candidate, scored));
      if (duplicate >= 0) { if (scored.score > pool[duplicate]!.score) pool[duplicate] = scored; }
      else pool.push(scored);
      pool.sort((a, b) => b.score - a.score); if (pool.length > 2) pool.length = 2;
    }
    options.onProgress?.(contourIndex + .5, total);
    for (const [index, candidate] of pool.entries()) {
      refined.push(refine(candidate, field, minimum, config.sensitivity));
      options.onProgress?.(contourIndex + .5 + (index + 1) / (2 * pool.length), total);
    }
    options.onProgress?.(contourIndex + 1, total);
  }
  refined.sort((a, b) => b.score - a.score);
  const accepted: Scored[] = [];
  for (const candidate of refined) {
    if (candidate.coverage < .35 || candidate.score < .18 / config.sensitivity || accepted.some(previous => sameEllipse(previous, candidate))) continue;
    accepted.push(candidate); if (accepted.length === config.maxCandidates) break;
  }
  const candidates: ShapeCandidate[] = accepted.map((candidate, i) => ({ id: `ellipse-${i + 1}`, center: candidate.center, radii: candidate.radii,
    angleRadians: candidate.angleRadians, score: candidate.score, coverage: candidate.coverage, supportedArcs: supportedArcs(candidate.supported) }));
  options.onProgress?.(total, total);
  return { candidates, groups: groupShapes(candidates), diagnostics: { settings: config, contours: contours.length,
    validProposals, fittedCandidates: refined.length, method: 'multiscale connected luminance contours; deterministic five-point conic RANSAC; gradient-normal refinement',
    interpretation: 'Projected ellipse candidates and shared centers only. Scores measure image support, not probability, physical membership, symmetry in depth or recovered 3D geometry.' } };
}
