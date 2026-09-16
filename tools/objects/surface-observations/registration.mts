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
import { requireArray, requireRecord, requireString } from '../../source-values.mts';
import { loadNativePhotograph } from '../terrestrial-layers/native-photograph-source.mts';
import { framesReference, observationCaster, peakValue, registrationSweep, type RegistrationImage, type RegistrationResult, type SurfaceReference } from '../terrestrial-layers/observer-registration.mts';
import type { FrameDetector, LoadContext, ObservationFrame } from './contract.mts';

export const REGISTRATION_STAGE = 'cssearth-registration-stage@1';

/** The rule a frame must meet for its reference sweep to count as a verdict rather than noise: a real peak, and clear of both mirrors by ratio or by gap. */
export const DECISIVE = { minimumCorrelation: 0.15, minimumMirrorMargin: 1.5, minimumMirrorGap: 0.25, minimumFrames: 3 } as const;
/** The rule a frame's outline must meet for its position angle to be defined: the contour at half the frame's peak against the whole projected limb, as the gate that qualified the SPHERE bodies measured it. */
export const SILHOUETTE = { edgeFraction: 0.5, minimumElongation: 1.2, pairWindowMinutes: 15, bins: 180 } as const;

export interface SilhouetteFrame {
  id: string; startTime: string;
  /** Why the frame was not scored, or absent when it was. */
  skipped?: 'partial-disc' | 'round-outline' | 'no-outline';
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

export interface RegistrationStageReport { stage: typeof REGISTRATION_STAGE; silhouette: SilhouetteReport; reference: ReferenceReport }

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
    const projected: number[][] = [];
    let partial = false;
    for (const position of mesh.positions) {
      const p = camera.project(position);
      if (!p || !(p[2] === undefined || p[2] > 0)) continue;
      if (p[0] < 0 || p[1] < 0 || p[0] > width - 1 || p[1] > height - 1) partial = true;
      projected.push([p[0], p[1]]);
    }
    const peak = peakValue(image), edge = peak * SILHOUETTE.edgeFraction;
    const observed: number[][] = [];
    let cx = 0, cy = 0;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) { const i = y * width + x; if (image.values[i] > edge && !image.reject?.(i)) { observed.push([x, y]); cx += x; cy += y; } }
    if (!projected.length || observed.length < 16) { rows.push({ id: frame.id, startTime: frame.startTime, skipped: 'no-outline', elongation: NaN }); continue; }
    cx /= observed.length; cy /= observed.length;
    const model = longestAxis(projected, cx, cy, SILHOUETTE.bins);
    if (partial || observed.some(([x, y]) => x === 0 || y === 0 || x === width - 1 || y === height - 1)) { rows.push({ id: frame.id, startTime: frame.startTime, skipped: 'partial-disc', elongation: model.elongation }); continue; }
    const seen = longestAxis(observed, cx, cy, SILHOUETTE.bins);
    const widthRatio = model.width / seen.width;
    // Position angle is only defined when the projection is out of round; near an end-on phase the long axis is noise.
    if (model.elongation < SILHOUETTE.minimumElongation) { rows.push({ id: frame.id, startTime: frame.startTime, skipped: 'round-outline', elongation: model.elongation, widthRatio }); continue; }
    const residual = ((seen.angleDegrees - model.angleDegrees + 90) % 180 + 180) % 180 - 90;
    rows.push({ id: frame.id, startTime: frame.startTime, elongation: model.elongation, widthRatio, residualDegrees: residual });
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

/** Each frame turned under a reference: a named observation of the body, or the lens's other frames. */
export async function referenceRegistration(frames: readonly ObservationFrame[], context: LoadContext, observationId?: string): Promise<ReferenceReport> {
  const carried = frames.filter((frame): frame is ObservationFrame & { detector: FrameDetector } => !!frame.detector);
  const rows: ReferenceFrameReport[] = [], offsets: number[] = [];
  const judge = (frame: ObservationFrame & { detector: FrameDetector }, reference: SurfaceReference, shading: 'radial' | 'face') => {
    try {
      const result = registrationSweep(asImage(frame.detector), observationCaster(frame.detector.camera), frame.detector.mesh, reference, { shading });
      const decisive = result.exact.correlation >= DECISIVE.minimumCorrelation && (result.mirrorMargin >= DECISIVE.minimumMirrorMargin || result.mirrorGap >= DECISIVE.minimumMirrorGap);
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
    for (const frame of carried) judge(frame, reference, 'radial');
    return finish({ kind: 'observation', observation: observationId, shading: 'radial', rule: DECISIVE });
  }
  if (carried.length < 2) return finish({ kind: 'none', reason: carried.length ? 'one frame and no reference observation' : 'no frame carries a camera', shading: 'face', rule: DECISIVE });
  const hour = 3600;
  for (const frame of carried) {
    const seconds = epochSeconds(frame.startTime);
    // Frames more than an hour away see a turned body; if none exist the rest stand in and can only judge handedness.
    const far = carried.filter(other => other !== frame && (seconds === null || epochSeconds(other.startTime) === null || Math.abs((epochSeconds(other.startTime) ?? 0) - seconds) > hour));
    const others = far.length ? far : carried.filter(other => other !== frame);
    const reference = framesReference(others.map(other => ({ image: asImage(other.detector), camera: observationCaster(other.detector.camera) })), frame.detector.mesh);
    judge(frame, reference, 'face');
  }
  return finish({ kind: 'frames', referenceFrames: carried.length, shading: 'face', rule: DECISIVE });
}

/** The stage for one lens, or null when no frame carries a camera to measure. */
export async function registrationStage(frames: readonly ObservationFrame[], recipe: Record<string, unknown>, context: LoadContext): Promise<RegistrationStageReport | null> {
  if (!frames.some(frame => frame.detector)) return null;
  const reference = recipe.reference === undefined ? undefined : requireString(requireRecord(recipe.reference).observation, 'reference observation');
  return { stage: REGISTRATION_STAGE, silhouette: silhouetteRegistration(frames), reference: await referenceRegistration(frames, context, reference) };
}
