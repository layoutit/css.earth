import { cross3 as cross } from '@cssearth/core';
/** The shared surface transfer: from qualified frames to the atlas sampler, the flat preview and the report. */
import type { RadialSurface, SurfaceColorSample, SurfaceConfig } from '../terrestrial-layers/contracts.mts';
import type { SourceInput } from '../../../src/platform/source-manifest.mts';
import type { FootprintSample, ObservationFrame, SurfacePolicy } from './contract.mts';
import { missingCoverageColor } from '@cssearth/bake/raster';
import { edgeWeights, finestOnSurface, fitObservationLevels, sampleTrianglePoints, selectObservation } from './levels.mts';
import { qualifiedFace } from './geometry.mts';
import { bandColorByte, bandColorEvidence, interpolatePalette, linearToSrgb } from '../color-transfer.mts';

export const SURFACE_OBSERVATION_REPORT = 'cssearth-surface-observation-report@1';
const EDGE_WEIGHTED_AVERAGE = { method: 'Every frame that qualifies at a point contributes its levelled value, weighted by how deep inside its usable disc the point lies (zero at the limb, the terminator and the emission limit, one at the deepest pixel) over its pixel area at the target; so a frame fades out at its edge instead of stopping there.',
  after: 'Fétick et al. 2019, A&A 623, A6, section 4.4, https://doi.org/10.1051/0004-6361/201834749: epochs averaged with weights that fall toward the limb, the contour itself excluded.' };
const PREVIEW_POLICY = 'The flat preview samples unique radial intersections only; the retained triangle atlas samples the closest full-source surface point in 3D.';
const sub = (a: readonly number[], b: readonly number[]) => a.map((n, i) => n - b[i]);


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
    const point = displayPoint.map(n => n * metersPerUnit), hit = mesh.closestPoint(point), source = hit?.point;
    const values = frames.map((frame): Missing | Accepted => {
      if (!hit) return missing(point, 'ambiguous-source-point');
      if (!qualifiedFace(mesh, hit.faceId)) return missing(point, 'unconstrained-source-shape');
      const sample = frame.sample(hit.point);
      if (sample.reason !== undefined) return missing(point, sample.reason);
      if (!frame.visible(hit.point)) return missing(point, 'occluded');
      return { ...sample, distanceMeters: hit.distanceMeters };
    });
    return { point, source, values };
  };
  const scale = (i: number) => frames[i].nominalPixelScaleMeters ?? frames[i].footprint.nadirMedianMeters;
  const scales = frames.map((_, i) => scale(i));
  const blended = policy.selection === 'edge-weighted-average';
  if ((policy.selection === 'finest-resolution' || blended) && scales.some(value => !(value > 0))) throw new Error(`A ${policy.selection} observation needs every frame's pixel scale.`);
  if (blended && frames.some(frame => !frame.contourDepth)) throw new Error('An edge-weighted average needs every frame\'s depth inside its disc.');
  // A qualifying sample always lies at least half a pixel inside its disc: the footprint's contributors are usable pixels.
  const blend = (values: readonly (Missing | Accepted)[], source: readonly number[] | undefined) =>
    edgeWeights(values.map(value => value.reason === undefined && source !== undefined), i => source ? frames[i].contourDepth?.(source) ?? 0 : 0, scales);
  const levelled = (values: readonly (Missing | Accepted)[], { weights, total }: { weights: readonly number[]; total: number }) =>
    weights.reduce((sum, weight, i) => { const value = values[i]; return weight > 0 && value.reason === undefined ? sum + weight * value.radiance * levels.gains[i] : sum; }, 0) / total;
  // Finest-resolution ties keep the frame with the finer pixel scale, then the earlier one in the recipe.
  const byScale = frames.map((_, i) => i).sort((a, b) => scales[a] - scales[b] || a - b);
  // Frames sharing one viewing direction tie on emission; recipe order then ranks them. Brightness never chooses a frame.
  const choose = (values: readonly (Missing | Accepted)[]) => policy.selection === 'single' ? (values[0].reason === undefined ? 0 : -1)
    : policy.selection === 'recipe-order' ? values.findIndex(value => value.reason === undefined)
    : policy.selection === 'finest-resolution' ? finestOnSurface(byScale, scales, i => { const value = values[i]; return value.reason === undefined ? value : undefined; }).index
    : selectObservation(values);
  // Recipe order stops at the first accepted frame and finest resolution once no remaining frame can be finer; each picks
  // the frame choose() picks from all of them. Only lowest-emission and single frames sample every frame.
  const sampleOrdered = (displayPoint: readonly number[]) => {
    const point = displayPoint.map(n => n * metersPerUnit), hit = mesh.closestPoint(point);
    const accepted = (i: number): Accepted | undefined => {
      if (!hit || !qualifiedFace(mesh, hit.faceId)) return undefined;
      const frame = frames[i], sample = frame.sample(hit.point);
      return sample.reason === undefined && frame.visible(hit.point) ? { ...sample, distanceMeters: hit.distanceMeters } : undefined;
    };
    if (policy.selection === 'finest-resolution') return { point, ...finestOnSurface(byScale, scales, accepted) };
    for (let i = 0; i < frames.length; i++) { const value = accepted(i); if (value) return { point, index: i, value }; }
    return { point, index: -1, value: undefined };
  };
  // Estimated faces complete an open source surface that no photograph observed, so their sample points stay withheld.
  const points = sampleTrianglePoints(radial.faces, policy.samplesPerTriangle);
  const sampled = points.map((point, i) => radial.faces[Math.floor(i / policy.samplesPerTriangle)].estimated
    ? { source: undefined, values: frames.map((): Missing | Accepted => missing(point.map(n => n * metersPerUnit), 'estimated-geometry')) } : sampleAll(point));
  const samples = sampled.map(({ values }) => values);
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
    if (blended) for (const { source, values: atPoint } of sampled) { const mix = blend(atPoint, source); if (mix) values.push(levelled(atPoint, mix)); }
    else for (const atPoint of samples) {
      const i = choose(atPoint);
      if (i < 0) continue;
      const sample = atPoint[i];
      if (sample.reason === undefined) values.push(sample.radiance * levels.gains[i]);
    }
    values.sort((a, b) => a - b);
    [low, high] = policy.display.percentiles.map(p => values[Math.min(values.length - 1, Math.floor(values.length * p / 100))]);
    if (!(high > low)) throw new Error('Surface observation has no qualified radiance range.');
  }
  const colorDisplay = policy.display.range === 'stated-range' ? policy.display.colorDisplay : undefined, palette = policy.display.palette;
  // The stretch is linear in the observed quantity; grey is sRGB-encoded like the colour bands, and a palette indexes the linear fraction.
  const displayColor = (radiance: number) => {
    const fraction = Math.max(0, Math.min(1, (radiance - low) / (high - low)));
    return palette ? interpolatePalette(palette, fraction) : Array(3).fill(Math.round(255 * linearToSrgb(fraction)));
  };
  const blendPoint = (displayPoint: readonly number[]): SurfaceColorSample => {
    const { point, source, values } = sampleAll(displayPoint), mix = blend(values, source);
    if (!mix) return missing(point, 'no-qualified-observation');
    const radiance = levelled(values, mix), contributors = values.filter((value, i): value is Accepted => mix.weights[i] > 0 && value.reason === undefined);
    const color = contributors[0].color && colorDisplay
      ? contributors[0].color.map((_, channel) => bandColorByte(values.reduce((sum, value, i) => mix.weights[i] > 0 && value.reason === undefined && value.color
        ? sum + mix.weights[i] * value.color[channel] * levels.gains[i] : sum, 0) / mix.total, colorDisplay))
      : displayColor(radiance);
    if (Boolean(contributors[0].color) !== Boolean(colorDisplay)) throw new Error('Floating color samples require their source-bound band display policy.');
    const most = (key: 'separationMeters' | 'gain' | 'maximumEmissionDegrees' | 'maximumIncidenceDegrees') => Math.max(...contributors.map(value => value[key]));
    return { color, radiance, distanceMeters: contributors[0].distanceMeters, separationMeters: most('separationMeters'), gain: most('gain'),
      maximumEmissionDegrees: most('maximumEmissionDegrees'), maximumIncidenceDegrees: most('maximumIncidenceDegrees'), frameId: frames[mix.index].id, frameIndex: mix.index };
  };
  const samplePoint = (displayPoint: readonly number[]): SurfaceColorSample => {
    if (blended) return blendPoint(displayPoint);
    let point: readonly number[], index: number, value: Missing | Accepted | undefined;
    if (policy.selection === 'recipe-order' || policy.selection === 'finest-resolution') ({ point, index, value } = sampleOrdered(displayPoint));
    else {
      const all = sampleAll(displayPoint), first = all.values[0];
      ({ point } = all); index = choose(all.values); value = all.values[index];
      if (index < 0 && frames.length === 1 && first.reason !== undefined) return first;
    }
    if (index < 0 || value === undefined) return missing(point, 'no-qualified-observation');
    if (value.reason !== undefined) return value;
    const gain = levels.gains[index], radiance = value.radiance * gain;
    if (Boolean(value.color) !== Boolean(colorDisplay)) throw new Error('Floating color samples require their source-bound band display policy.');
    // The shared footprint and level matching retain floats; encode the selected bands once here.
    return { ...value, color: value.color && colorDisplay ? value.color.map(channel => bandColorByte(channel * gain,colorDisplay))
      : displayColor(radiance), radiance, frameId: frames[index].id, frameIndex: index };
  };
  const sourceSquareMeters: Record<string, number> = {};
  const areaCoverage = { method: 'Deterministic equal-area barycentric samples on every retained triangle; excludes atlas bleed', samplesPerTriangle: policy.samplesPerTriangle,
    totalSquareMeters: 0, acceptedSquareMeters: 0, sourceSquareMeters, acceptedFraction: 0,
    ...(blended ? { sourceSquareMetersMethod: 'Each frame is credited with its share of the averaging weight at every sample.' } : {}) };
  let k = 0;
  for (const face of radial.faces) {
    const [a, b, c] = face.vertices, area = Math.hypot(...cross(sub(b, a), sub(c, a))) / 2 * metersPerUnit ** 2, weight = area / policy.samplesPerTriangle;
    areaCoverage.totalSquareMeters += area;
    for (let j = 0; j < policy.samplesPerTriangle; j++) {
      // A blend credits each frame with its share of the weight; a choice credits the chosen frame.
      const { source, values } = sampled[k++], mix = blended ? blend(values, source) : null, i = blended ? mix?.index ?? -1 : choose(values);
      if (i < 0) continue;
      areaCoverage.acceptedSquareMeters += weight;
      if (mix) mix.weights.forEach((share, f) => { if (share > 0) sourceSquareMeters[frames[f].id] = (sourceSquareMeters[frames[f].id] ?? 0) + weight * share / mix.total; });
      else sourceSquareMeters[frames[i].id] = (sourceSquareMeters[frames[i].id] ?? 0) + weight;
    }
  }
  areaCoverage.acceptedFraction = areaCoverage.acceptedSquareMeters / areaCoverage.totalSquareMeters;
  const { display } = policy;
  const report: SurfaceObservationReport = { schema: SURFACE_OBSERVATION_REPORT, format: policy.format,
    camera: { kind: frames[0].cameraKind, positionKm: frames[0].positionKm },
    frames: frames.map(frame => frame.report), limits: policy.limits, photometry: policy.photometry, selection: policy.selection, ...(blended ? { blending: EDGE_WEIGHTED_AVERAGE } : {}),
    levelMatching: frames.length > 1 ? { ...policy.levelMatching, ...levels, sampledPoints: points.length } : null,
    display: { range: display.range, ...(display.range === 'stated-range' ? {} : { percentiles: display.percentiles }), low, high, units: display.units, ...(display.palette ? { palette: display.palette } : {}),
      basis: display.basis, ...(display.sourceId === undefined ? {} : { sourceId: display.sourceId }),
      ...(display.range === 'stated-range' && display.colorDisplay ? { colorDisplay: bandColorEvidence(display.colorDisplay) } : {}) },
    areaCoverage, sourceIds: entries.map(entry => ({ id: entry.id })), previewPolicy: PREVIEW_POLICY,
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
