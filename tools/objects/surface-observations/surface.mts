/** The shared surface transfer: from qualified frames to the atlas sampler, the flat preview and the report. */
import type { RadialSurface, SurfaceColorSample, SurfaceConfig } from '../terrestrial-layers/contracts.mts';
import type { SourceInput } from '../../../src/platform/source-manifest.mts';
import type { FootprintSample, ObservationFrame, SurfacePolicy } from './contract.mts';
import { missingCoverageColor } from '../../../src/platform/prepare-missing-coverage.mts';
import { fitObservationLevels, sampleTrianglePoints, selectObservation } from './levels.mts';
import { qualifiedFace } from './geometry.mts';
import { bandColorByte, bandColorEvidence } from '../color-transfer.mts';

export const SURFACE_OBSERVATION_REPORT = 'cssearth-surface-observation-report@1';
const PREVIEW_POLICY = 'The flat preview samples unique radial intersections only; the retained triangle atlas samples the closest full-source surface point in 3D.';
const sub = (a: readonly number[], b: readonly number[]) => a.map((n, i) => n - b[i]);
const cross = (a: readonly number[], b: readonly number[]) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

type Missing = { reason: string; color: number[]; radiance?: never; maximumEmissionDegrees?: never; maximumIncidenceDegrees?: never };
type Accepted = Extract<FootprintSample, { reason?: undefined }> & { distanceMeters: number };

export interface SurfaceObservationReport { schema: string; format: string; camera: { kind: string; positionKm: readonly number[] | null; viewingDirection?: readonly number[] }; frames: Record<string, unknown>[]; [key: string]: unknown }
export interface SurfaceObservation {
  samplePoint(point: readonly number[]): SurfaceColorSample;
  preview(width: number, height: number): { rgb: Buffer; missing: Uint8Array };
  report: SurfaceObservationReport;
}

export function createSurfaceObservation({ frames, policy, radial, config, entries }: { frames: readonly ObservationFrame[]; policy: SurfacePolicy; radial: RadialSurface; config: SurfaceConfig; entries: readonly SourceInput[] }): SurfaceObservation {
  if (!frames.length || (policy.selection === 'single') !== (frames.length === 1)) throw new Error('A surface observation selects among its frames only when it has several.');
  const mesh = radial.grid, metersPerUnit = config.geometry.radiusKm * 1000 / config.geometry.radius;
  const missing = (point: readonly number[], reason: string): Missing => ({ reason, color: missingCoverageColor(Math.atan2(point[1], point[0]) * 180 / Math.PI,
    Math.atan2(point[2], Math.hypot(point[0], point[1])) * 180 / Math.PI, 180 / config.raster.height) });
  // One closest source point per displayed point serves every frame; each frame then checks its own footprint and visibility.
  const sampleAll = (displayPoint: readonly number[]) => {
    const point = displayPoint.map(n => n * metersPerUnit);
    const early = policy.precheckDisplayPoint ? frames.map(frame => frame.sample(point, policy.maximumSourceDistanceMeters)) : undefined;
    const hit = early?.every(sample => sample.reason !== undefined) ? null : mesh.closestPoint(point, policy.maximumSourceDistanceMeters);
    const values = frames.map((frame, i): Missing | Accepted => {
      const precheck = early?.[i];
      if (precheck && precheck.reason !== undefined) return missing(point, precheck.reason);
      if (!hit) return missing(point, 'source-distance');
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
  const points = sampleTrianglePoints(radial.faces, policy.samplesPerTriangle), samples = points.map(point => sampleAll(point).values);
  if (frames.length > 1 && !policy.levelMatching) throw new Error('A multi-frame observation needs its level-matching budget.');
  const levels = frames.length === 1 || !policy.levelMatching ? { gains: [1], pairs: [] }
    : fitObservationLevels(frames.map((_, i) => samples.map(values => values[i])), policy.levelMatching);
  let low: number, high: number;
  if (policy.display.range === 'authored') ({ low, high } = policy.display);
  else if (policy.display.range === 'reference-pixels') {
    const range = frames[0].pixelRange;
    if (!range) throw new Error('A pixel-percentile display needs the reference frame\'s pixel range.');
    ({ low, high } = range);
  } else {
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
    const { point, values } = sampleAll(displayPoint), index = choose(values), first = values[0];
    if (index < 0) return frames.length === 1 && first.reason !== undefined ? first : missing(point, 'no-qualified-observation');
    const value = values[index];
    if (value.reason !== undefined) return value;
    const gain = levels.gains[index], radiance = value.radiance * gain, level = (v: number) => Math.round(Math.max(0, Math.min(1, (v - low) / (high - low))) * 255), gray = level(radiance);
    const colorDisplay = policy.display.range === 'authored' ? policy.display.colorDisplay : undefined;
    if (Boolean(value.color) !== Boolean(colorDisplay)) throw new Error('Color samples require their source-bound display policy.');
    if (colorDisplay?.kind === 'provider-rgb' && (gain !== 1 || value.gain !== 1 || low !== 0 || high !== 255)) throw new Error('Published RGB must retain its original display levels.');
    // The shared footprint and level matching retain floats; encode the selected bands once here.
    return { ...value, color: value.color && colorDisplay ? value.color.map(channel => colorDisplay.kind === 'provider-rgb' ? level(channel) : bandColorByte(channel * gain,colorDisplay)) : [gray, gray, gray], radiance, frameId: frames[index].id, frameIndex: index };
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
    camera: { kind: frames[0].cameraKind, positionKm: frames[0].positionKm, ...(frames[0].viewingDirection ? { viewingDirection: frames[0].viewingDirection } : {}) },
    frames: frames.map(frame => frame.report), limits: policy.limits, photometry: policy.photometry, selection: policy.selection,
    levelMatching: frames.length > 1 ? { ...policy.levelMatching, ...levels, sampledPoints: points.length } : null,
    display: { range: display.range, ...(display.range === 'authored' ? {} : { percentiles: display.percentiles }), low, high, units: display.units,
      ...(display.range === 'reference-pixels' ? { referenceFrame: frames[0].id } : {}), ...(display.range === 'authored' && display.colorDisplay ? { colorDisplay: display.colorDisplay.kind === 'provider-rgb' ? display.colorDisplay : bandColorEvidence(display.colorDisplay) } : {}) },
    areaCoverage, sourceIds: entries.map(entry => ({ id: entry.id, sha256: entry.expectedSha256 })), previewPolicy: PREVIEW_POLICY,
    ...(policy.limitations ? { limitations: policy.limitations } : {}) };
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
  return { samplePoint, preview, report };
}
