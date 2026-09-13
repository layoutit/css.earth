/** The footprint stage: sample a photograph at a surface point, and build a camera route's frame around it. */
import type { SourceMesh } from '../terrestrial-layers/contracts.mts';
import type { FootprintSample, ObservationCamera, ObservationFrame, ObservationImage, ObservationPhotometry, PixelGeometry, TransferLimits } from './contract.mts';
import { pixelAngle } from './cameras.mts';

export interface FootprintSource { image: ObservationImage; camera: Pick<ObservationCamera, 'project'>; geometry: PixelGeometry; photometry: Pick<ObservationPhotometry, 'gain' | 'retainsIllumination'> }

/** Interpolate the detector pixels around a projected point. A contributor counts when it has a surface point, passes the archive's
 * quality verdict, faces the camera within the emission limit, lies on the sampled surface patch, is lit when the photometry normalizes
 * illumination and admits a photometric gain. Each counting contributor is normalized before interpolation, and the sample needs at
 * least half the bilinear weight. Dark calibrated pixels stay eligible; brightness never defines coverage. */
export function sampleFootprint({ image, camera, geometry, photometry }: FootprintSource, point: readonly number[],
  { maximumSeparationMeters, maximumEmissionDegrees }: { maximumSeparationMeters: number | ((ids: readonly number[]) => number); maximumEmissionDegrees: number }): FootprintSample {
  const projected = camera.project(point);
  if (!projected || !(projected[2] > 0)) return { reason: 'behind-camera' };
  const [x, y] = projected, { width, height } = image;
  if (!Number.isFinite(x + y) || x < 0 || y < 0 || x >= width - 1 || y >= height - 1) return { reason: 'outside-detector' };
  const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy;
  const ids = [iy * width + ix, iy * width + ix + 1, (iy + 1) * width + ix, (iy + 1) * width + ix + 1];
  const weights = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty], emissionLimit = maximumEmissionDegrees * Math.PI / 180;
  const surfaced = ids.filter(i => geometry.reject(i) === null);
  const limit = typeof maximumSeparationMeters === 'number' ? maximumSeparationMeters : surfaced.length ? maximumSeparationMeters(surfaced) : NaN;
  const used: { index: number; weight: number; gain: number }[] = [];
  let weight = 0, separationMeters = 0, failure: { reason: string; weight: number; separationMeters?: number } | undefined;
  ids.forEach((index, k) => {
    let reason = geometry.reject(index) ?? image.reject(index), separation: number | undefined, gain: number | null = null;
    if (reason === null) { const emission = geometry.emission(index); if (!Number.isFinite(emission) || emission < 0 || emission > emissionLimit) reason = 'grazing'; }
    // A contributor on another surface, across a neck or a limb, is left out rather than mixed in.
    if (reason === null) { separation = geometry.distanceMeters(index, point); if (separation > limit) reason = 'geometry-mismatch'; }
    // A normalizing model cannot recover surface the Sun does not reach, so a shadowed contributor is left out rather than brightened.
    if (reason === null && !photometry.retainsIllumination && geometry.shadowed?.(index)) reason = 'shadowed';
    if (reason === null) { gain = photometry.gain(geometry.incidence(index), geometry.emission(index), geometry.phase(index)); if (gain === null) reason = 'photometry'; }
    if (reason === null && gain !== null) { used.push({ index, weight: weights[k], gain }); weight += weights[k]; separationMeters = Math.max(separationMeters, separation ?? 0); }
    else if (reason !== null && (!failure || weights[k] > failure.weight)) failure = { reason, weight: weights[k], ...(separation === undefined ? {} : { separationMeters: separation }) };
  });
  if (weight < .5) return failure ? { reason: failure.reason, ...(failure.separationMeters === undefined ? {} : { separationMeters: failure.separationMeters }) } : { reason: 'no-geometry' };
  const interpolate = (value: (index: number) => number) => used.reduce((sum, contributor) => sum + value(contributor.index) * contributor.gain * contributor.weight, 0) / weight;
  return { radiance: interpolate(i => image.values[i]) * (image.radianceFactor?.factor ?? 1), separationMeters,
    ...(image.colorValues ? { color: image.colorValues.map(plane => interpolate(i => plane[i])) } : {}),
    gain: Math.max(...used.map(contributor => contributor.gain)), maximumEmissionDegrees: Math.max(...used.map(contributor => geometry.emission(contributor.index))) * 180 / Math.PI,
    maximumIncidenceDegrees: Math.max(...used.map(contributor => geometry.incidence(contributor.index))) * 180 / Math.PI };
}

export interface CameraFrameOptions {
  id: string; image: ObservationImage; camera: ObservationCamera; geometry: PixelGeometry; photometry: ObservationPhotometry;
  limits: TransferLimits; mesh: Pick<SourceMesh, 'intersect'>;
  /** Give the frame its own display range from its qualified pixels, for routes that display by pixel percentiles. */
  displayPercentiles?: readonly number[];
  report?: Record<string, unknown>;
}

/** Assemble a camera route's frame: count its pixels, measure its footprint and bind sampling and visibility to its limits. */
export function cameraFrame({ id, image, camera, geometry, photometry, limits, mesh, displayPercentiles, report = {} }: CameraFrameOptions): ObservationFrame {
  const angle = pixelAngle(camera, image.width, image.height), factor = image.radianceFactor?.factor ?? 1;
  const values: number[] = [], nadir: number[] = [], rejectedPixels: Record<string, number> = {};
  let geometryPixels = 0, acceptedPixels = 0, acceptedLossyPixels = 0;
  for (let i = 0; i < image.width * image.height; i++) {
    if (geometry.reject(i) !== null) continue;
    if (geometryPixels++ % 97 === 0) nadir.push(geometry.rangeMeters(i) * angle);
    const rejected = image.reject(i);
    if (rejected !== null) { rejectedPixels[rejected] = (rejectedPixels[rejected] ?? 0) + 1; continue; }
    const gain = photometry.gain(geometry.incidence(i), geometry.emission(i), geometry.phase(i));
    if (gain === null) { rejectedPixels.photometry = (rejectedPixels.photometry ?? 0) + 1; continue; }
    if (displayPercentiles) values.push(image.values[i] * gain * factor);
    acceptedPixels++;
    if (image.lossy?.(i)) acceptedLossyPixels++;
  }
  let pixelRange: { low: number; high: number } | undefined;
  if (displayPercentiles) {
    values.sort((a, b) => a - b);
    const [low, high] = displayPercentiles.map(p => values[Math.min(values.length - 1, Math.floor(values.length * p / 100))]);
    if (!(high > low)) throw new Error(`Observation frame ${id} has no qualified display contrast.`);
    pixelRange = { low, high };
  }
  nadir.sort((a, b) => a - b);
  const footprint = { pixelAngleMicroradians: angle * 1e6, nadirMedianMeters: nadir[Math.floor(nadir.length / 2)] ?? NaN, nadirMinimumMeters: nadir[0] ?? NaN, sampledPixels: nadir.length };
  // A contributor on a continuous surface lies within one pixel diagonal of the sampled point; the diagonal stretches with emission up to the lens's limit.
  const emissionLimit = limits.maximumEmissionDegrees * Math.PI / 180;
  const diagonal = (i: number) => geometry.rangeMeters(i) * angle * Math.sqrt(1 + 1 / Math.cos(Math.min(geometry.emission(i), emissionLimit)) ** 2);
  const { maximumSeparationMeters, maximumSeparationFootprints } = limits;
  const separation = maximumSeparationFootprints === undefined ? maximumSeparationMeters ?? NaN : (ids: readonly number[]) => maximumSeparationFootprints * Math.max(...ids.map(diagonal));
  const eye = camera.positionMeters, tolerance = limits.visibilityToleranceMeters;
  return { id, startTime: image.startTime, filter: image.filter, positionKm: camera.positionKm, cameraKind: camera.kind, geometrySource: geometry.source,
    nominalPixelScaleMeters: camera.nominalPixelScaleMeters, pixelRange, footprint,
    sample: point => sampleFootprint({ image, camera, geometry, photometry }, point, { maximumSeparationMeters: separation, maximumEmissionDegrees: limits.maximumEmissionDegrees }),
    visible: point => {
      const delta = point.map((n, i) => n - eye[i]), distance = Math.hypot(...delta), hit = mesh.intersect(eye, delta.map(n => n / distance), distance + tolerance);
      return !!hit && Math.abs(hit.radius - distance) <= tolerance;
    },
    report: { id, startTime: image.startTime, filter: image.filter, camera: { kind: camera.kind, ...camera.report }, geometry: geometry.report, quality: image.report,
      pixels: { geometryPixels, acceptedPixels, acceptedLossyPixels, rejectedPixels }, footprint, ...(pixelRange ? { display: pixelRange } : {}),
      ...(image.radianceFactor ? { radiometry: { ...image.radianceFactor, formula: 'I/F = pi * solarDistanceAu^2 * radiance / solarFlux; OSIRIS calibration HISTORY.' } } : {}), ...report } };
}
