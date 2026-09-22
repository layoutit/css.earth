/**
 * The registration stage: every camera route is measured after it loads, the same way, and the numbers go into the
 * lens report instead of a body's prose.
 *
 * Two measurements, both advisory. The silhouette compares the limb the mesh projects with the contour the frame shows,
 * frame by frame, and reports the position-angle residual with the noise floor the frames themselves set: consecutive
 * exposures minutes apart see one geometry, so the scatter of their residuals is measurement, and what survives
 * subtracting it in quadrature is the systematic part a wrong camera would leave. The reference sweep turns the body
 * under each frame against a surface reference and reports the peak offset and the margin over both mirrors. The
 * reference is a mapped observation of the same body when the lens names one, and otherwise the lens's other frames.
 *
 * Hard failure stays where it was, on lit shape over sky in the format that loads the frame. This stage never throws
 * for a bad number; it records the number. A frame it cannot judge is reported with the reason.
 */
import { requireArray, requireRecord, requireString } from '../../sources/source-values.mts';
import { loadNativePhotograph } from '../terrestrial-layers/native-photograph-source.mts';
import { framesReference, observationCaster, outline, peakValue, prepareFrame, registrationSweep, reliefSweep, type PreparedFrame, type RegistrationImage, type RegistrationResult, type ReliefResult, type SurfaceReference } from '../terrestrial-layers/registration-sweeps.mts';
import type { FrameDetector, LoadContext, ObservationFrame } from './contract.mts';

export const REGISTRATION_STAGE = 'cssearth-registration-stage@1';

/**
 * The rule a frame must meet for its reference sweep to count as a verdict rather than noise: a real peak, clear of
 * both mirrors by ratio or by gap. A weaker peak also counts when it stands four times above both mirrors, because the
 * mirrors measure what the reference's own texture scores by chance: a relief-shaded mosaic seen under other lighting
 * correlates weakly with a frame it nonetheless places, and its mirrors score near nothing.
 */
export const DECISIVE = { minimumCorrelation: 0.15, minimumMirrorMargin: 1.5, minimumMirrorGap: 0.25, weakCorrelation: 0.05, weakMirrorMargin: 4, minimumFrames: 3 } as const;
/**
 * The rule a frame's outline must meet for its position angle to be defined: the contour at half the frame's peak
 * against the whole projected limb, as the gate that qualified the SPHERE bodies measured it. That comparison holds
 * only near opposition; past the phase-angle limit the contour is a crescent's, not the limb's, and the frame is left
 * to the reference sweep.
 */
export const SILHOUETTE = { edgeFraction: 0.5, minimumElongation: 1.2, pairWindowMinutes: 15, bins: 180, maximumPhaseDegrees: 30, reachFactor: 1.3, reachPixels: 3 } as const;

export interface SilhouetteFrame {
  id: string; startTime: string;
  /** Why the frame was not scored, or absent when it was. */
  skipped?: 'partial-disc' | 'round-outline' | 'no-outline' | 'high-phase';
  /** The solar phase angle at the camera, degrees. */
  phaseDegrees?: number;
  /** The projected outline's long-to-short axis ratio. */
  elongation: number;
  /** Observed contour width along the projected long axis over the projected width: the size check, defined for every whole disc. */
  widthRatio?: number;
  /** Position-angle residual in degrees, observed less projected, folded into (-90, 90]. */
  residualDegrees?: number;
}

export interface SilhouetteReport {
  rule: typeof SILHOUETTE;
  frames: SilhouetteFrame[];
  scored: number;
  /** Root mean square residual over the scored frames, degrees. */
  rmsDegrees: number | null;
  /** The frames' own measurement floor, from pairs within the window, degrees; null without a pair. */
  noiseFloorDegrees: number | null;
  /** The residual left after the floor is removed in quadrature, degrees; null without a floor. */
  systematicDegrees: number | null;
  pairs: number;
}

export interface ReferenceFrameReport extends Partial<RegistrationResult> { id: string; skipped?: string; decisive?: boolean }
export interface ReferenceReport {
  kind: 'observation' | 'frames' | 'none';
  /** The observation the lens named, or the frames that stood in, or why there was nothing. */
  observation?: string; referenceFrames?: number; reason?: string;
  shading: 'radial' | 'face';
  rule: typeof DECISIVE;
  frames: ReferenceFrameReport[];
  decisive: number;
  /** Median exact offset over the decisive frames, degrees; null with fewer decisive frames than the rule asks, because one or two peaks are not a verdict. */
  medianOffsetDegrees: number | null;
}

/** The relief rule: a peak that stands clear of what a turn the size of the window scores. */
export const RELIEF_DECISIVE = { minimumCorrelation: 0.15, minimumProminence: 0.1 } as const;

/** The gate every registration measurement is judged against. */
export const VERDICT_DEGREES = 3;

/**
 * How far the furthest decisive offset sits from their median. A median is a location, not a measurement: offsets that
 * disagree by more than the gate have placed nothing, and their median can land anywhere, so such a set reaches no
 * verdict rather than agreeing or conflicting. The limb already states its own precision as a noise floor; this is the
 * same statement for a sweep, which has no repeat exposures to measure one from.
 */
export function offsetAgreementDegrees(frames: readonly { decisive?: boolean; exact?: { offsetDegrees: number } }[], minimumFrames: number) {
  const offsets = frames.filter(frame => frame.decisive).map(frame => frame.exact?.offsetDegrees)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (offsets.length < minimumFrames) return null;
  const sorted = [...offsets].sort((a, b) => a - b), median = sorted[Math.floor(sorted.length / 2)];
  return Math.max(...sorted.map(value => Math.abs(value - median)));
}
export interface ReliefFrameReport extends Partial<ReliefResult> { id: string; skipped?: string; decisive?: boolean }
export interface ReliefReport { rule: typeof RELIEF_DECISIVE & { minimumFrames: number }; frames: ReliefFrameReport[]; decisive: number; medianOffsetDegrees: number | null }
export interface RegistrationStageReport { stage: typeof REGISTRATION_STAGE; silhouette: SilhouetteReport; reference: ReferenceReport; relief: ReliefReport }

/** Whether a sweep result is a verdict under the decisive rule. */
export function isDecisive(result: RegistrationResult) {
  const strong = result.exact.correlation >= DECISIVE.minimumCorrelation && (result.mirrorMargin >= DECISIVE.minimumMirrorMargin || result.mirrorGap >= DECISIVE.minimumMirrorGap);
  const weak = result.exact.correlation >= DECISIVE.weakCorrelation && result.mirrorMargin >= DECISIVE.weakMirrorMargin;
  return strong || weak;
}

const asImage = ({ image }: FrameDetector): RegistrationImage => ({ width: image.width, height: image.height, values: image.values, reject: i => image.reject(i) });

/** The direction and width of the longest chord of a point set about a centre, over half a turn of trial angles. */
function longestAxis(points: readonly (readonly number[])[], cx: number, cy: number, bins: number) {
  let bestWidth = -1, bestAngle = 0, leastWidth = Infinity;
  for (let k = 0; k < bins; k++) {
    const angle = k * Math.PI / bins, c = Math.cos(angle), s = Math.sin(angle);
    let low = Infinity, high = -Infinity;
    for (const p of points) { const t = (p[0] - cx) * c + (p[1] - cy) * s; if (t < low) low = t; if (t > high) high = t; }
    const width = high - low;
    if (width > bestWidth) { bestWidth = width; bestAngle = angle; }
    if (width < leastWidth) leastWidth = width;
  }
  return { angleDegrees: bestAngle * 180 / Math.PI, width: bestWidth, elongation: bestWidth / leastWidth };
}

/** The solar phase angle at the camera: between the direction to the Sun and the direction to the camera, from the body. */
function phaseOf(camera: { positionMeters: readonly number[]; sunDirection: readonly number[] }) {
  const sun = camera.sunDirection, p = camera.positionMeters, r = Math.hypot(p[0], p[1], p[2]);
  if (!(r > 0)) return undefined;
  return Math.acos(Math.max(-1, Math.min(1, (p[0] * sun[0] + p[1] * sun[1] + p[2] * sun[2]) / r))) * 180 / Math.PI;
}

/** Whole seconds since the epoch of an ISO-like start time, or null when the frame states none this stage can read. */
function epochSeconds(startTime: string) {
  const parsed = Date.parse(startTime.replace(/Z?$/, 'Z'));
  return Number.isFinite(parsed) ? parsed / 1000 : null;
}

/** The limb the mesh projects against the contour the frame shows, for every frame that carries a camera. */
export function silhouetteRegistration(frames: readonly ObservationFrame[]): SilhouetteReport {
  const rows: SilhouetteFrame[] = [];
  for (const frame of frames) {
    const detector = frame.detector;
    if (!detector) continue;
    const { camera, mesh } = detector, image = asImage(detector), { width, height } = image;
    const phaseDegrees = phaseOf(camera);
    if (phaseDegrees !== undefined && phaseDegrees > SILHOUETTE.maximumPhaseDegrees) { rows.push({ id: frame.id, startTime: frame.startTime, skipped: 'high-phase', phaseDegrees, elongation: NaN }); continue; }
    const projected: number[][] = [];
    let partial = false;
    for (const position of mesh.positions) {
      const p = camera.project(position);
      if (!p || !(p[2] === undefined || p[2] > 0)) continue;
      if (p[0] < 0 || p[1] < 0 || p[0] > width - 1 || p[1] > height - 1) partial = true;
      projected.push([p[0], p[1]]);
    }
    if (!projected.length) { rows.push({ id: frame.id, startTime: frame.startTime, phaseDegrees, skipped: 'no-outline', elongation: NaN }); continue; }
    // The contour is read about the projected disc's own centre and only within its reach, so a ring, a companion or a
    // star in the same frame is not mistaken for the body's outline.
    const cx = projected.reduce((sum, p) => sum + p[0], 0) / projected.length, cy = projected.reduce((sum, p) => sum + p[1], 0) / projected.length;
    const reach = outline(width, height, () => false, cx, cy, SILHOUETTE.bins);
    for (const p of projected) { const bin = ((Math.round(Math.atan2(p[1] - cy, p[0] - cx) / (2 * Math.PI) * SILHOUETTE.bins) % SILHOUETTE.bins) + SILHOUETTE.bins) % SILHOUETTE.bins, d = Math.hypot(p[0] - cx, p[1] - cy); if (d > reach[bin]) reach[bin] = d; }
    const farthest = Math.max(...reach), within = (x: number, y: number) => { const bin = ((Math.round(Math.atan2(y - cy, x - cx) / (2 * Math.PI) * SILHOUETTE.bins) % SILHOUETTE.bins) + SILHOUETTE.bins) % SILHOUETTE.bins; return Math.hypot(x - cx, y - cy) <= (reach[bin] || farthest) * SILHOUETTE.reachFactor + SILHOUETTE.reachPixels; };
    const peak = peakValue(image), edge = peak * SILHOUETTE.edgeFraction;
    const observed: number[][] = [];
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const i = y * width + x; if (image.values[i] > edge && !image.reject?.(i) && within(x, y)) observed.push([x, y]); }
    if (observed.length < 16) { rows.push({ id: frame.id, startTime: frame.startTime, phaseDegrees, skipped: 'no-outline', elongation: NaN }); continue; }
    const model = longestAxis(projected, cx, cy, SILHOUETTE.bins);
    if (partial || observed.some(([x, y]) => x === 0 || y === 0 || x === width - 1 || y === height - 1)) { rows.push({ id: frame.id, startTime: frame.startTime, skipped: 'partial-disc', elongation: model.elongation }); continue; }
    const seen = longestAxis(observed, cx, cy, SILHOUETTE.bins);
    const widthRatio = model.width / seen.width;
    // Position angle is only defined when the projection is out of round; near an end-on phase the long axis is noise.
    if (model.elongation < SILHOUETTE.minimumElongation) { rows.push({ id: frame.id, startTime: frame.startTime, skipped: 'round-outline', elongation: model.elongation, widthRatio }); continue; }
    const residual = ((seen.angleDegrees - model.angleDegrees + 90) % 180 + 180) % 180 - 90;
    rows.push({ id: frame.id, startTime: frame.startTime, phaseDegrees, elongation: model.elongation, widthRatio, residualDegrees: residual });
  }
  const scored = rows.filter(row => row.residualDegrees !== undefined);
  const rms = scored.length ? Math.sqrt(scored.reduce((sum, row) => sum + (row.residualDegrees ?? 0) ** 2, 0) / scored.length) : null;
  // Consecutive exposures within the window see one geometry; the scatter of their residual differences is the measurement floor.
  const pairs: number[] = [];
  const timed = rows.map(row => ({ row, seconds: epochSeconds(row.startTime) })).filter(entry => entry.seconds !== null).sort((a, b) => (a.seconds ?? 0) - (b.seconds ?? 0));
  for (let i = 1; i < timed.length; i++) {
    const a = timed[i - 1].row, b = timed[i].row, gap = ((timed[i].seconds ?? 0) - (timed[i - 1].seconds ?? 0)) / 60;
    if (gap > 0 && gap < SILHOUETTE.pairWindowMinutes && a.residualDegrees !== undefined && b.residualDegrees !== undefined) pairs.push((b.residualDegrees - a.residualDegrees) / Math.SQRT2);
  }
  const noise = pairs.length ? Math.sqrt(pairs.reduce((sum, x) => sum + x * x, 0) / pairs.length) : null;
  const systematic = rms !== null && noise !== null ? Math.sqrt(Math.max(0, rms * rms - noise * noise)) : null;
  return { rule: SILHOUETTE, frames: rows, scored: scored.length, rmsDegrees: rms, noiseFloorDegrees: noise, systematicDegrees: systematic, pairs: pairs.length };
}

/** The mapped observation a lens names as its reference, as a luminance sampler in the body frame. */
async function observationReference(context: LoadContext, observationId: string): Promise<SurfaceReference> {
  const raster = requireRecord(context.config.raster), observations = requireArray(raster.observations).map(value => requireRecord(value));
  const observation = observations.find(entry => entry.id === observationId);
  if (!observation) throw new Error(`The lens names reference observation ${observationId}, which the recipe does not state.`);
  const manifest = context.source.manifest;
  if (!manifest) throw new Error('The reference observation needs the source manifest.');
  const inputs = requireArray(manifest.inputs).map(value => requireRecord(value)), entry = inputs.find(input => input.lensId === observationId);
  if (!entry) throw new Error(`Reference observation ${observationId} has no pinned source.`);
  const photograph = await loadNativePhotograph(context.sourceDirectory, entry, observation.validity), rgb = [0, 0, 0];
  return { sample: (longitude, latitude) => photograph.sample(longitude, latitude, rgb) ? 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2] : null };
}

/** Frames prepared once: reduced to the ray budget and cast, for every sweep the stage runs. */
type Prepared = { frame: ObservationFrame & { detector: FrameDetector }; prepared: PreparedFrame; seconds: number | null };
function prepareAll(frames: readonly ObservationFrame[], rows: { id: string; skipped?: string }[]): Prepared[] {
  const out: Prepared[] = [];
  for (const frame of frames) {
    if (!frame.detector) continue;
    try { out.push({ frame: frame as ObservationFrame & { detector: FrameDetector }, prepared: prepareFrame(asImage(frame.detector), observationCaster(frame.detector.camera), frame.detector.mesh), seconds: epochSeconds(frame.startTime) }); }
    catch (error) { rows.push({ id: frame.id, skipped: (error as Error).message }); }
  }
  return out;
}

/** Each frame turned under a reference: a named observation of the body, or the lens's other frames. */
export async function referenceRegistration(frames: readonly ObservationFrame[], context: LoadContext, observationId?: string, prepared?: Prepared[]): Promise<ReferenceReport> {
  const rows: ReferenceFrameReport[] = [], offsets: number[] = [];
  const carried = prepared ?? prepareAll(frames, rows);
  const judge = ({ frame, prepared }: Prepared, reference: SurfaceReference, shading: 'radial' | 'face') => {
    try {
      const result = registrationSweep(prepared, frame.detector.mesh, reference, { shading });
      const decisive = isDecisive(result);
      if (decisive) offsets.push(result.exact.offsetDegrees);
      rows.push({ id: frame.id, ...result, decisive });
    } catch (error) { rows.push({ id: frame.id, skipped: (error as Error).message }); }
  };
  const finish = (report: Omit<ReferenceReport, 'frames' | 'decisive' | 'medianOffsetDegrees'>): ReferenceReport => {
    const sorted = [...offsets].sort((a, b) => a - b);
    return { ...report, frames: rows, decisive: offsets.length, medianOffsetDegrees: sorted.length >= DECISIVE.minimumFrames ? sorted[Math.floor(sorted.length / 2)] : null };
  };
  if (observationId) {
    const reference = await observationReference(context, observationId);
    for (const entry of carried) judge(entry, reference, 'radial');
    return finish({ kind: 'observation', observation: observationId, shading: 'radial', rule: DECISIVE });
  }
  if (carried.length < 2) return finish({ kind: 'none', reason: carried.length ? 'one frame and no reference observation' : 'no frame carries a camera', shading: 'face', rule: DECISIVE });
  const hour = 3600;
  for (const entry of carried) {
    // Frames more than an hour away see a turned body; if none exist the rest stand in and can only judge handedness.
    const far = carried.filter(other => other !== entry && (entry.seconds === null || other.seconds === null || Math.abs(other.seconds - entry.seconds) > hour));
    const others = far.length ? far : carried.filter(other => other !== entry);
    judge(entry, framesReference(others.map(other => other.prepared)), 'face');
  }
  return finish({ kind: 'frames', referenceFrames: carried.length, shading: 'face', rule: DECISIVE });
}

/**
 * Each frame turned under the body's own relief. Needs no map and no other frame: an irregular mesh's shading alone
 * places a frame, or fails to. A smooth mesh predicts nothing after the smooth part is removed, and says so.
 */
export function reliefRegistration(frames: readonly ObservationFrame[], prepared?: Prepared[]): ReliefReport {
  const rows: ReliefFrameReport[] = [], offsets: number[] = [];
  for (const entry of prepared ?? prepareAll(frames, rows)) {
    try {
      const result = reliefSweep(entry.prepared, entry.frame.detector.mesh);
      const decisive = result.exact.correlation >= RELIEF_DECISIVE.minimumCorrelation && result.prominence >= RELIEF_DECISIVE.minimumProminence;
      if (decisive) offsets.push(result.exact.offsetDegrees);
      rows.push({ id: entry.frame.id, ...result, decisive });
    } catch (error) { rows.push({ id: entry.frame.id, skipped: (error as Error).message }); }
  }
  const sorted = [...offsets].sort((a, b) => a - b);
  return { rule: { ...RELIEF_DECISIVE, minimumFrames: DECISIVE.minimumFrames }, frames: rows, decisive: offsets.length, medianOffsetDegrees: sorted.length >= DECISIVE.minimumFrames ? sorted[Math.floor(sorted.length / 2)] : null };
}

/** The stage for one lens, or null when no frame carries a camera to measure. */
export async function registrationStage(frames: readonly ObservationFrame[], recipe: Record<string, unknown>, context: LoadContext): Promise<RegistrationStageReport | null> {
  if (!frames.some(frame => frame.detector)) return null;
  const reference = recipe.reference === undefined ? undefined : requireString(requireRecord(recipe.reference).observation, 'reference observation');
  // Every frame is reduced and cast once here; the reference sweep and the relief sweep both read that cast.
  const skipped: { id: string; skipped?: string }[] = [], prepared = prepareAll(frames, skipped);
  const referenceReport = await referenceRegistration(frames, context, reference, prepared), reliefReport = reliefRegistration(frames, prepared);
  referenceReport.frames.unshift(...skipped); reliefReport.frames.unshift(...skipped);
  return { stage: REGISTRATION_STAGE, silhouette: silhouetteRegistration(frames), reference: referenceReport, relief: reliefReport };
}

/**
 * Which reference a lens lets turn its cameras about the pole (`by`), whether the silhouette may tilt them about the
 * line of sight (`tilt`), and how far the other decisive references may disagree before a turn is declined.
 */
export interface RefinementRecipe { by?: 'relief' | 'frames' | 'map'; tilt?: 'silhouette'; agreementDegrees: number }
export function parseRefinement(value: unknown): RefinementRecipe {
  const record = requireRecord(value), by = record.by, tilt = record.tilt, agreement = record.agreementDegrees ?? 3;
  if (by !== undefined && by !== 'relief' && by !== 'frames' && by !== 'map') throw new TypeError('A refinement is by relief, frames or map.');
  if (tilt !== undefined && tilt !== 'silhouette') throw new TypeError('A tilt comes from the silhouette.');
  if (by === undefined && tilt === undefined) throw new TypeError('A refinement names a turn reference, a tilt, or both.');
  if (typeof agreement !== 'number' || !(agreement > 0) || agreement > 30) throw new TypeError('A refinement states the agreement it asks of the other references, in degrees, under thirty.');
  if (Object.keys(record).some(key => !['by', 'tilt', 'agreementDegrees'].includes(key))) throw new TypeError('A refinement names only its references and its agreement.');
  return { ...(by ? { by } : {}), ...(tilt ? { tilt } : {}), agreementDegrees: agreement };
}

/** The rule a tilt must meet: enough scored frames, and a median residual that stands above the frames' own floor. */
export const TILT = { minimumScored: 3 } as const;
export interface TiltDecision { applied: boolean; tiltDegrees: number | null; reason: string; scored: number; medianResidualDegrees: number | null; noiseFloorDegrees: number | null }

/** Whether the silhouette may tilt the lens: the median of its scored residuals, when there are enough and the floor does not swallow it. */
export function tiltDecision(stage: RegistrationStageReport): TiltDecision {
  const residuals = stage.silhouette.frames.map(frame => frame.residualDegrees).filter((r): r is number => r !== undefined).sort((a, b) => a - b);
  const median = residuals.length ? residuals[Math.floor(residuals.length / 2)] : null, floor = stage.silhouette.noiseFloorDegrees;
  const base = { scored: residuals.length, medianResidualDegrees: median, noiseFloorDegrees: floor };
  if (median === null || residuals.length < TILT.minimumScored) return { ...base, applied: false, tiltDegrees: null, reason: `the silhouette scored ${residuals.length} frames, fewer than ${TILT.minimumScored}` };
  if (floor !== null && Math.abs(median) <= floor) return { ...base, applied: false, tiltDegrees: null, reason: `the median residual ${median.toFixed(2)}° is within the frames' floor of ${floor.toFixed(2)}°` };
  return { ...base, applied: true, tiltDegrees: median, reason: 'scored and above the floor' };
}

export interface RefinementDecision { by: RefinementRecipe['by']; applied: boolean; turnDegrees: number | null; reason: string; medians: Record<string, number | null> }

/**
 * Whether the named reference may turn the lens: it must be decisive over the rule's count of frames, and every other
 * reference that is decisive must put its median within the stated agreement. A conflict is reported, not resolved.
 */
export function refinementDecision(stage: RegistrationStageReport, recipe: RefinementRecipe): RefinementDecision {
  if (!recipe.by) throw new TypeError('A turn decision needs the reference the refinement names.');
  const medians: Record<string, number | null> = { relief: stage.relief.medianOffsetDegrees, [stage.reference.kind === 'observation' ? 'map' : 'frames']: stage.reference.medianOffsetDegrees };
  const named = medians[recipe.by];
  if (named === undefined || named === null) return { by: recipe.by, applied: false, turnDegrees: null, reason: `the ${recipe.by} reference is not decisive over ${DECISIVE.minimumFrames} frames`, medians };
  for (const [name, median] of Object.entries(medians)) {
    if (name === recipe.by || median === null) continue;
    if (Math.abs(median - named) > recipe.agreementDegrees) return { by: recipe.by, applied: false, turnDegrees: null, reason: `the ${name} reference puts the turn at ${median}°, more than ${recipe.agreementDegrees}° from the ${recipe.by} reference's ${named}°`, medians };
  }
  return { by: recipe.by, applied: true, turnDegrees: named, reason: 'decisive and unopposed', medians };
}

/**
 * Whether a correction earned its place: measured again, a turn must bring the reference it came from closer to zero,
 * and a tilt must lower the silhouette residual it came from. A correction that does neither is reverted and the
 * provider's camera stands; the report says which, and by how much it missed.
 */
export function refinementKept(before: RegistrationStageReport, after: RegistrationStageReport, by: RefinementRecipe['by'] | undefined, tilted: boolean) {
  const verdict: { turn?: { kept: boolean; reason: string }; tilt?: { kept: boolean; reason: string } } = {};
  if (by) {
    const pick = (stage: RegistrationStageReport) => by === 'relief' ? stage.relief.medianOffsetDegrees : stage.reference.medianOffsetDegrees;
    const was = pick(before), now = pick(after);
    const kept = now === null ? true : was === null ? true : Math.abs(now) < Math.abs(was);
    verdict.turn = { kept, reason: now === null ? `the ${by} reference is no longer decisive after the turn; the turn stands on the first measurement` : kept ? `the ${by} median moved from ${was}° to ${now}°` : `the ${by} median did not move toward zero (${was}° to ${now}°)` };
  }
  if (tilted) {
    const was = before.silhouette.rmsDegrees, now = after.silhouette.rmsDegrees;
    const kept = was !== null && now !== null && now < was;
    verdict.tilt = { kept, reason: kept ? `the limb residual fell from ${was?.toFixed(2)}° to ${now?.toFixed(2)}°` : `the limb residual did not fall (${was?.toFixed(2)}° to ${now?.toFixed(2)}°)` };
  }
  return verdict;
}
