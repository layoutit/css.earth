/** The shared surface transfer: from qualified frames to the atlas sampler, the flat preview and the report. */
import type { RadialSurface, SurfaceColorSample, SurfaceConfig } from '../terrestrial-layers/contracts.mts';
import type { SourceInput } from '../../../src/platform/source-manifest.mts';
import type { FootprintSample, ObservationFrame, SurfacePolicy } from './contract.mts';
import { missingCoverageColor } from '../../../src/platform/prepare-missing-coverage.mts';
import { fitObservationLevels, sampleTrianglePoints, selectObservation } from './levels.mts';
import { qualifiedFace } from './geometry.mts';
import { bandColorByte, bandColorEvidence, interpolatePalette, linearToSrgb } from '../color-transfer.mts';

export const SURFACE_OBSERVATION_REPORT = 'cssearth-surface-observation-report@1';
const PREVIEW_POLICY = 'The flat preview samples unique radial intersections only; the retained triangle atlas samples the closest full-source surface point in 3D.';
const sub = (a: readonly number[], b: readonly number[]) => a.map((n, i) => n - b[i]);
const cross = (a: readonly number[], b: readonly number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

type Missing = { reason: string; color: number[]; radiance?: never; maximumEmissionDegrees?: never; maximumIncidenceDegrees?: never };
type Accepted = Extract<FootprintSample, { reason?: undefined }> & { distanceMeters: number };

export interface SurfaceObservationReport { schema: string; format: string; camera: { kind: string; positionKm: readonly number[] }; frames: Record<string, unknown>[]; [key: string]: unknown }
export interface SurfaceObservation {
  samplePoint(point: readonly number[]): SurfaceColorSample;
  preview(width: number, height: number): { rgb: Buffer; missing: Uint8Array };
  report: SurfaceObservationReport;
  /** The photograph already carries its acquisition lighting; the atlas must not light it again. */
  retainsIllumination: boolean;
}

/**
 * The level fit's refusal with the frames named. Frames it would adjust beyond its budget are named against the first
 * frame, which anchors the display, and against the median frame; with seasons, against their own season's first and
 * median frames. A dim first frame puts every other frame over budget; the median shows which frames disagree with the
 * rest. Frames no accepted overlap joins are named by group. Any other error passes through unchanged.
 */
export function namedLevelRefusal(error: unknown, ids: readonly string[], maximumGain: number): unknown {
  const cause = error instanceof Error && typeof error.cause === 'object' && error.cause !== null ? error.cause as { gains?: unknown; groups?: unknown; seasons?: unknown } : null;
  if (!(error instanceof Error)) return error;
  const groups = Array.isArray(cause?.groups) && cause.groups.every(group => Array.isArray(group) && group.every(i => Number.isInteger(i) && i >= 0 && i < ids.length)) ? cause.groups as number[][] : null;
  if (groups) return new Error(`${error.message} Groups no accepted overlap joins: ${groups.map(group => group.map(i => ids[i]).join(', ')).join(' | ')}.`, { cause: error.cause });
  const gains = Array.isArray(cause?.gains) && cause.gains.length === ids.length && cause.gains.every(gain => typeof gain === 'number') ? cause.gains as number[] : null;
  if (!gains) return error;
  const seasons = Array.isArray(cause?.seasons) && cause.seasons.length === ids.length ? cause.seasons as number[] : ids.map(() => 0);
  const beyond = (ratio: number) => !Number.isFinite(ratio) || ratio > maximumGain || ratio < 1 / maximumGain;
  const seasonal = new Set(seasons).size > 1, first = seasonal ? 'its season\'s first frame\'s level' : 'the first frame\'s level', middle = seasonal ? 'its season\'s median frame\'s' : 'the median frame\'s';
  const named = ids.flatMap((id, i) => {
    const members = gains.filter((_, j) => seasons[j] === seasons[i]), median = [...members].sort((a, b) => a - b)[Math.floor(members.length / 2)], anchor = gains[seasons.indexOf(seasons[i])];
    return beyond(gains[i] / anchor) || beyond(gains[i] / median) ? [`${id} ${(gains[i] / anchor).toFixed(2)}× ${first}, ${(gains[i] / median).toFixed(2)}× ${middle}`] : [];
  });
  return new Error(`${error.message} Beyond the ${maximumGain}× budget: ${named.join('; ')}.`, { cause: error.cause });
}

export function createSurfaceObservation({ frames, policy, radial, config, entries }: { frames: readonly ObservationFrame[]; policy: SurfacePolicy; radial: RadialSurface; config: SurfaceConfig; entries: readonly SourceInput[] }): SurfaceObservation {
  if (policy.display.basis === 'source' && !entries.some(entry => entry.id === policy.display.sourceId)) throw new Error(`A source-based display names ${policy.display.sourceId}, which the lens does not consume.`);
  if (!frames.length || (policy.selection === 'single') !== (frames.length === 1)) throw new Error('A surface observation selects among its frames only when it has several.');
  const mesh = radial.grid, metersPerUnit = config.geometry.radiusKm * 1000 / config.geometry.radius;
  const missing = (point: readonly number[], reason: string): Missing => ({ reason, color: missingCoverageColor(Math.atan2(point[1], point[0]) * 180 / Math.PI,
    Math.atan2(point[2], Math.hypot(point[0], point[1])) * 180 / Math.PI, 180 / config.raster.height, config.raster.missingCoverage) });
  // One closest source point per displayed point serves every frame; each frame then checks its own footprint and visibility. The display
  // mesh simplifies this source mesh, so the closest point lies on the displayed point's own surface; only an exact tie between distinct
  // surface points leaves it undecided.
  const sampleAll = (displayPoint: readonly number[]) => {
    const point = displayPoint.map(n => n * metersPerUnit), hit = mesh.closestPoint(point);
    const values = frames.map((frame): Missing | Accepted => {
      if (!hit) return missing(point, 'ambiguous-source-point');
      if (!qualifiedFace(mesh, hit.faceId)) return missing(point, 'unconstrained-source-shape');
      const sample = frame.sample(hit.point);
      if (sample.reason !== undefined) return missing(point, sample.reason);
      if (!frame.visible(hit.point)) return missing(point, 'occluded');
      return { ...sample, distanceMeters: hit.distanceMeters };
    });
    return { point, values };
  };
  const scale = (i: number) => frames[i].nominalPixelScaleMeters ?? frames[i].footprint.nadirMedianMeters;
  // Frames sharing one viewing direction tie on emission; recipe order then ranks them. Brightness never chooses a frame.
  const choose = (values: readonly (Missing | Accepted)[]) => policy.selection === 'single' ? (values[0].reason === undefined ? 0 : -1)
    : policy.selection === 'recipe-order' ? values.findIndex(value => value.reason === undefined)
    : policy.selection === 'finest-resolution' ? values.reduce((best, value, i) => value.reason === undefined && (best < 0 || scale(i) < scale(best)) ? i : best, -1)
    : selectObservation(values);
  // A selection that ranks frames in a fixed order can stop at the first accepted frame: it is the frame choose() picks from all of them
  // (finest-resolution keeps the lowest index among equal scales). Only lowest-emission and single frames sample every frame.
  const rank = policy.selection === 'recipe-order' ? frames.map((_, i) => i)
    : policy.selection === 'finest-resolution' && frames.every((_, i) => Number.isFinite(scale(i))) ? frames.map((_, i) => i).sort((a, b) => scale(a) - scale(b) || a - b) : null;
  const sampleFirst = (displayPoint: readonly number[], order: readonly number[]) => {
    const point = displayPoint.map(n => n * metersPerUnit), hit = mesh.closestPoint(point);
    if (hit && qualifiedFace(mesh, hit.faceId)) for (const i of order) {
      const frame = frames[i], sample = frame.sample(hit.point);
      if (sample.reason === undefined && frame.visible(hit.point)) return { point, index: i, value: { ...sample, distanceMeters: hit.distanceMeters } as Missing | Accepted };
    }
    return { point, index: -1, value: undefined };
  };
  // Estimated faces complete an open source surface that no photograph observed, so their sample points stay withheld.
  const points = sampleTrianglePoints(radial.faces, policy.samplesPerTriangle);
  const samples = points.map((point, i) => radial.faces[Math.floor(i / policy.samplesPerTriangle)].estimated
    ? frames.map((): Missing | Accepted => missing(point.map(n => n * metersPerUnit), 'estimated-geometry')) : sampleAll(point).values);
  if (frames.length > 1 && !policy.levelMatching) throw new Error('A multi-frame observation needs its level-matching budget.');
  const fit = (levelMatching: NonNullable<typeof policy.levelMatching>) => {
    try { return fitObservationLevels(frames.map((_, i) => samples.map(values => values[i])), levelMatching, policy.levelSeasons); }
    catch (error) { throw namedLevelRefusal(error, frames.map(frame => frame.id), levelMatching.maximumGain); }
  };
  const levels = frames.length === 1 || !policy.levelMatching ? { gains: [1], pairs: [] } : fit(policy.levelMatching);
  let low: number, high: number;
  if (policy.display.range === 'stated-range') ({ low, high } = policy.display);
  else {
    const values: number[] = [];
    for (const atPoint of samples) {
      const i = choose(atPoint);
      if (i < 0) continue;
      const sample = atPoint[i];
      if (sample.reason === undefined) values.push(sample.radiance * levels.gains[i]);
    }
    values.sort((a, b) => a - b);
    [low, high] = policy.display.percentiles.map(p => values[Math.min(values.length - 1, Math.floor(values.length * p / 100))]);
    if (!(high > low)) throw new Error('Surface observation has no qualified radiance range.');
  }
  const samplePoint = (displayPoint: readonly number[]): SurfaceColorSample => {
    let point: readonly number[], index: number, value: Missing | Accepted | undefined;
    if (rank) ({ point, index, value } = sampleFirst(displayPoint, rank));
    else {
      const all = sampleAll(displayPoint), first = all.values[0];
      ({ point } = all); index = choose(all.values); value = all.values[index];
      if (index < 0 && frames.length === 1 && first.reason !== undefined) return first;
    }
    if (index < 0 || value === undefined) return missing(point, 'no-qualified-observation');
    if (value.reason !== undefined) return value;
    // The stretch is linear in the observed quantity; grey is sRGB-encoded like the colour bands, and a palette indexes the linear fraction.
    const gain = levels.gains[index], radiance = value.radiance * gain, fraction = Math.max(0, Math.min(1, (radiance - low) / (high - low)));
    const colorDisplay = policy.display.range === 'stated-range' ? policy.display.colorDisplay : undefined;
    if (Boolean(value.color) !== Boolean(colorDisplay)) throw new Error('Floating color samples require their source-bound band display policy.');
    // The shared footprint and level matching retain floats; encode the selected bands once here.
    const palette = policy.display.palette;
    return { ...value, color: value.color && colorDisplay ? value.color.map(channel => bandColorByte(channel * gain,colorDisplay))
      : palette ? interpolatePalette(palette, fraction) : Array(3).fill(Math.round(255 * linearToSrgb(fraction))), radiance, frameId: frames[index].id, frameIndex: index };
  };
  const sourceSquareMeters: Record<string, number> = {};
  const areaCoverage = { method: 'Deterministic equal-area barycentric samples on every retained triangle; excludes atlas bleed', samplesPerTriangle: policy.samplesPerTriangle,
    totalSquareMeters: 0, acceptedSquareMeters: 0, sourceSquareMeters, acceptedFraction: 0 };
  let k = 0;
  for (const face of radial.faces) {
    const [a, b, c] = face.vertices, area = Math.hypot(...cross(sub(b, a), sub(c, a))) / 2 * metersPerUnit ** 2, weight = area / policy.samplesPerTriangle;
    areaCoverage.totalSquareMeters += area;
    for (let j = 0; j < policy.samplesPerTriangle; j++) {
      const i = choose(samples[k++]);
      if (i < 0) continue;
      areaCoverage.acceptedSquareMeters += weight;
      sourceSquareMeters[frames[i].id] = (sourceSquareMeters[frames[i].id] ?? 0) + weight;
    }
  }
  areaCoverage.acceptedFraction = areaCoverage.acceptedSquareMeters / areaCoverage.totalSquareMeters;
  const { display } = policy;
  const report: SurfaceObservationReport = { schema: SURFACE_OBSERVATION_REPORT, format: policy.format,
    camera: { kind: frames[0].cameraKind, positionKm: frames[0].positionKm },
    frames: frames.map(frame => frame.report), limits: policy.limits, photometry: policy.photometry, selection: policy.selection,
    levelMatching: frames.length > 1 ? { ...policy.levelMatching, ...levels, sampledPoints: points.length } : null,
    display: { range: display.range, ...(display.range === 'stated-range' ? {} : { percentiles: display.percentiles }), low, high, units: display.units, ...(display.palette ? { palette: display.palette } : {}),
      basis: display.basis, ...(display.sourceId === undefined ? {} : { sourceId: display.sourceId }),
      ...(display.range === 'stated-range' && display.colorDisplay ? { colorDisplay: bandColorEvidence(display.colorDisplay) } : {}) },
    areaCoverage, sourceIds: entries.map(entry => ({ id: entry.id, sha256: entry.expectedSha256 })), previewPolicy: PREVIEW_POLICY,
    ...(policy.bandAlignment ? { bandAlignment: policy.bandAlignment } : {}), ...(policy.registration ? { registration: policy.registration } : {}), ...(policy.limitations ? { limitations: policy.limitations } : {}) };
  const preview = (width: number, height: number) => {
    const rgb = Buffer.alloc(width * height * 3), missingPixels = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const lon = (x + .5) * 360 / width, lat = 90 - (y + .5) * 180 / height, index = y * width + x, hit = mesh.hit(lon, lat, true);
      if (!hit) { missingPixels[index] = 1; continue; }
      const longitude = lon * Math.PI / 180, latitude = lat * Math.PI / 180, r = hit.radius / metersPerUnit;
      const sample = samplePoint([r * Math.cos(latitude) * Math.cos(longitude), r * Math.cos(latitude) * Math.sin(longitude), r * Math.sin(latitude)]);
      rgb.set(sample.color, index * 3); missingPixels[index] = sample.reason ? 1 : 0;
    }
    return { rgb, missing: missingPixels };
  };
  return { samplePoint, preview, report, retainsIllumination: policy.retainsIllumination };
}
