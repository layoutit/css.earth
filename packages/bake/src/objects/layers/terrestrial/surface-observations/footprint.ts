/** The footprint stage: sample a photograph at a surface point, and build a camera route's frame around it. */
import { castSourceRays } from './geometry.ts';
import type { SourceMesh } from '../../../geometry/index.ts';
import type { FootprintSample, ObservationCamera, ObservationFrame, ObservationImage, ObservationPhotometry, PixelGeometry, TransferLimits } from './contract.ts';
import { pixelAngle } from './cameras.ts';
import { contourDepth, contourDistances, type ContourDistances } from './contour.ts';

export interface FootprintSource { image: ObservationImage; camera: Pick<ObservationCamera, 'project'>; geometry: PixelGeometry; photometry: Pick<ObservationPhotometry, 'gain' | 'retainsIllumination'> }

/** Interpolate the detector pixels around a projected point. A contributor counts when it has a surface point, passes the archive's
 * quality verdict, faces the camera within the emission limit, lies on the sampled surface patch, is lit when the photometry normalizes
 * illumination and admits a photometric gain. Each counting contributor is normalized before interpolation, and the sample needs at
 * least half the bilinear weight. Dark calibrated pixels stay eligible; brightness never defines coverage. */
/** A separation limit that scales with the widest surfaced contributor's pixel diagonal. */
export interface FootprintSeparation { footprints: number; diagonal: (index: number) => number }
// Contributors of the sample in progress. Sampling is synchronous and never re-entered, so one set serves every call.
const usedIndex = new Float64Array(4), usedWeight = new Float64Array(4), usedGain = new Float64Array(4);
function interpolateUsed(values: ArrayLike<number>, used: number, weight: number) {
  let sum = 0;
  for (let u = 0; u < used; u++) sum = sum + values[usedIndex[u]] * usedGain[u] * usedWeight[u];
  return sum / weight;
}

export function sampleFootprint({ image, camera, geometry, photometry }: FootprintSource, point: readonly number[],
  { maximumSeparationMeters, maximumEmissionDegrees }: { maximumSeparationMeters: number | FootprintSeparation | ((ids: readonly number[]) => number); maximumEmissionDegrees: number }): FootprintSample {
  const projected = camera.project(point);
  if (!projected || !(projected[2] > 0)) return { reason: 'behind-camera' };
  const [x, y] = projected, { width, height } = image;
  if (!Number.isFinite(x + y) || x < 0 || y < 0 || x >= width - 1 || y >= height - 1) return { reason: 'outside-detector' };
  const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy;
  // Four contributors in bilinear order, walked with scalars: this runs for every texel of every frame, so it allocates only what it returns.
  const i0 = iy * width + ix, i1 = i0 + 1, i2 = i0 + width, i3 = i0 + width + 1;
  const w0 = (1 - tx) * (1 - ty), w1 = tx * (1 - ty), w2 = (1 - tx) * ty, w3 = tx * ty, emissionLimit = maximumEmissionDegrees * Math.PI / 180;
  let limit: number;
  if (typeof maximumSeparationMeters === 'number') limit = maximumSeparationMeters;
  else if (typeof maximumSeparationMeters === 'function') limit = separationLimit(maximumSeparationMeters, [i0, i1, i2, i3], geometry);
  else {
    // The widest diagonal among contributors with a surface point, taken in contributor order as the array form takes it.
    let widest = -Infinity, surfaced = false;
    for (let k = 0; k < 4; k++) {
      const index = k === 0 ? i0 : k === 1 ? i1 : k === 2 ? i2 : i3;
      if (geometry.reject(index) === null) { surfaced = true; widest = Math.max(widest, maximumSeparationMeters.diagonal(index)); }
    }
    limit = surfaced ? maximumSeparationMeters.footprints * widest : NaN;
  }
  let used = 0, weight = 0, separationMeters = 0, failureReason: string | undefined, failureWeight = 0, failureSeparation: number | undefined;
  for (let k = 0; k < 4; k++) {
    const index = k === 0 ? i0 : k === 1 ? i1 : k === 2 ? i2 : i3, contributorWeight = k === 0 ? w0 : k === 1 ? w1 : k === 2 ? w2 : w3;
    let reason = geometry.reject(index) ?? image.reject(index), separation: number | undefined, gain: number | null = null;
    if (reason === null) { const emission = geometry.emission(index); if (!Number.isFinite(emission) || emission < 0 || emission > emissionLimit) reason = 'grazing'; }
    // A contributor on another surface, across a neck or a limb, is left out rather than mixed in.
    if (reason === null) { separation = geometry.distanceMeters(index, point); if (separation > limit) reason = 'geometry-mismatch'; }
    // A normalizing model cannot recover surface the Sun does not reach, so a shadowed contributor is left out rather than brightened.
    if (reason === null && !photometry.retainsIllumination && geometry.shadowed?.(index)) reason = 'shadowed';
    if (reason === null) { gain = photometry.gain(geometry.incidence(index), geometry.emission(index), geometry.phase(index)); if (gain === null) reason = 'photometry'; }
    if (reason === null && gain !== null) {
      usedIndex[used] = index; usedWeight[used] = contributorWeight; usedGain[used] = gain; used++;
      weight += contributorWeight; separationMeters = Math.max(separationMeters, separation ?? 0);
    } else if (reason !== null && (failureReason === undefined || contributorWeight > failureWeight)) {
      failureReason = reason; failureWeight = contributorWeight; failureSeparation = separation;
    }
  }
  if (weight < .5) return failureReason !== undefined ? { reason: failureReason, ...(failureSeparation === undefined ? {} : { separationMeters: failureSeparation }) } : { reason: 'no-geometry' };
  let gain = -Infinity, emission = -Infinity, incidence = -Infinity;
  for (let u = 0; u < used; u++) {
    gain = Math.max(gain, usedGain[u]); emission = Math.max(emission, geometry.emission(usedIndex[u])); incidence = Math.max(incidence, geometry.incidence(usedIndex[u]));
  }
  return { radiance: interpolateUsed(image.values, used, weight) * (image.radianceFactor?.factor ?? 1), separationMeters,
    ...(image.colorValues ? { color: image.colorValues.map(plane => interpolateUsed(plane, used, weight)) } : {}),
    gain, maximumEmissionDegrees: emission * 180 / Math.PI, maximumIncidenceDegrees: incidence * 180 / Math.PI };
}

/** Sample a sky field at a surface point. A reconstructed image is a brightness field over its whole frame: a pixel holds the
 * field's value whether or not that pixel's own ray meets the body. Near the limb the four pixels around a projected point straddle
 * the silhouette, and asking each for a surface point of its own left the last pixel of the disc in holes (Betelgeuse cast to 88
 * degrees: black fans at both poles, 2026-10-03). So the point is held to the emission limit by its own normal, and every pixel
 * that passes the archive's verdict contributes; the sample still needs at least half the bilinear weight. */
export function sampleSkyField({ image, camera, photometry }: { image: ObservationImage; camera: Pick<ObservationCamera, 'project' | 'positionMeters'>; photometry: Pick<ObservationPhotometry, 'gain'> },
  point: readonly number[], normal: readonly number[],
  { maximumEmissionDegrees }: { maximumEmissionDegrees: number }): FootprintSample {
  const projected = camera.project(point);
  if (!projected || !(projected[2] > 0)) return { reason: 'behind-camera' };
  const [x, y] = projected, { width, height } = image;
  if (!Number.isFinite(x + y) || x < 0 || y < 0 || x >= width - 1 || y >= height - 1) return { reason: 'outside-detector' };
  const eye = camera.positionMeters, d0 = eye[0] - point[0], d1 = eye[1] - point[1], d2 = eye[2] - point[2];
  const cosine = (normal[0] * d0 + normal[1] * d1 + normal[2] * d2) / (Math.hypot(d0, d1, d2) * Math.hypot(normal[0], normal[1], normal[2]));
  const emission = Math.acos(Math.max(-1, Math.min(1, cosine)));
  if (!Number.isFinite(emission) || emission > maximumEmissionDegrees * Math.PI / 180) return { reason: 'grazing' };
  // A self-luminous field is seen along its own emission direction: incidence equals emission and the phase is zero.
  const gain = photometry.gain(emission, emission, 0);
  if (gain === null) return { reason: 'photometry' };
  const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy, i0 = iy * width + ix;
  let used = 0, weight = 0, failureReason: string | undefined, failureWeight = 0;
  for (let k = 0; k < 4; k++) {
    const index = k === 0 ? i0 : k === 1 ? i0 + 1 : k === 2 ? i0 + width : i0 + width + 1;
    const contributorWeight = k === 0 ? (1 - tx) * (1 - ty) : k === 1 ? tx * (1 - ty) : k === 2 ? (1 - tx) * ty : tx * ty, reason = image.reject(index);
    if (reason === null) { usedIndex[used] = index; usedWeight[used] = contributorWeight; usedGain[used] = gain; used++; weight += contributorWeight; }
    else if (failureReason === undefined || contributorWeight > failureWeight) { failureReason = reason; failureWeight = contributorWeight; }
  }
  if (weight < .5) return { reason: failureReason ?? 'no-geometry' };
  const degrees = emission * 180 / Math.PI;
  return { radiance: interpolateUsed(image.values, used, weight) * (image.radianceFactor?.factor ?? 1), separationMeters: 0,
    ...(image.colorValues ? { color: image.colorValues.map(plane => interpolateUsed(plane, used, weight)) } : {}),
    gain, maximumEmissionDegrees: degrees, maximumIncidenceDegrees: degrees };
}

/** A footprint-scaled separation limit over the contributors that have a surface point, or NaN when none has. */
function separationLimit(limit: (ids: readonly number[]) => number, ids: readonly number[], geometry: PixelGeometry) {
  const surfaced = ids.filter(i => geometry.reject(i) === null);
  return surfaced.length ? limit(surfaced) : NaN;
}

export interface CameraFrameOptions {
  id: string; image: ObservationImage; camera: ObservationCamera; geometry: PixelGeometry; photometry: ObservationPhotometry;
  limits: TransferLimits; mesh: Pick<SourceMesh, 'intersect' | 'closestPoint' | 'positions' | 'indices' | 'faceProvenance' | 'constraintFlags'>;
  /** The image is a brightness field over its whole frame (a reconstruction), sampled at the point itself (`sampleSkyField`). */
  skyField?: boolean;
  report?: Record<string, unknown>;
}

/** Assemble a camera route's frame: count its pixels, measure its footprint and bind sampling and visibility to its limits. */
export function cameraFrame(options: CameraFrameOptions): ObservationFrame {
  const { id, image, camera, geometry, photometry, limits, mesh, skyField = false, report = {} } = options;
  const angle = pixelAngle(camera, image.width, image.height);
  const nadir: number[] = [], rejectedPixels: Record<string, number> = {};
  let geometryPixels = 0, acceptedPixels = 0, acceptedLossyPixels = 0;
  for (let i = 0; i < image.width * image.height; i++) {
    if (geometry.reject(i) !== null) continue;
    if (geometryPixels++ % 97 === 0) nadir.push(geometry.rangeMeters(i) * angle);
    const rejected = image.reject(i);
    if (rejected !== null) { rejectedPixels[rejected] = (rejectedPixels[rejected] ?? 0) + 1; continue; }
    const gain = photometry.gain(geometry.incidence(i), geometry.emission(i), geometry.phase(i));
    if (gain === null) { rejectedPixels.photometry = (rejectedPixels.photometry ?? 0) + 1; continue; }
    acceptedPixels++;
    if (image.lossy?.(i)) acceptedLossyPixels++;
  }
  nadir.sort((a, b) => a - b);
  const footprint = { pixelAngleMicroradians: angle * 1e6, nadirMedianMeters: nadir[Math.floor(nadir.length / 2)] ?? NaN, nadirMinimumMeters: nadir[0] ?? NaN, sampledPixels: nadir.length };
  // A contributor on a continuous surface lies within one pixel diagonal of the sampled point; the diagonal stretches with emission up to the dataset's limit.
  const emissionLimit = limits.maximumEmissionDegrees * Math.PI / 180;
  const diagonal = (i: number) => geometry.rangeMeters(i) * angle * Math.sqrt(1 + 1 / Math.cos(Math.min(geometry.emission(i), emissionLimit)) ** 2);
  const { maximumSeparationMeters, maximumSeparationFootprints } = limits;
  const separation: number | FootprintSeparation = maximumSeparationFootprints === undefined ? maximumSeparationMeters ?? NaN : { footprints: maximumSeparationFootprints, diagonal };
  const eye = camera.positionMeters, tolerance = limits.visibilityToleranceMeters;
  // The usable disc is what the footprint accepts from a pixel on its own: a surface point, the archive's verdict, the emission limit
  // and a photometric gain. Measured once, on first use, for a dataset that weights its frames by it.
  let contour: ContourDistances | undefined;
  const usable = (i: number) => geometry.reject(i) === null && image.reject(i) === null && geometry.emission(i) <= emissionLimit &&
    photometry.gain(geometry.incidence(i), geometry.emission(i), geometry.phase(i)) !== null;
  return { id, startTime: image.startTime, filter: image.filter, positionKm: camera.positionKm, cameraKind: camera.kind, geometrySource: geometry.source,
    nominalPixelScaleMeters: camera.nominalPixelScaleMeters, footprint, detector: { image, camera, mesh },
    withCamera: turned => cameraFrame({ ...options, camera: turned, geometry: castSourceRays(turned, mesh, image.width, image.height) }),
    sample: skyField
      ? point => { const hit = mesh.closestPoint(point); return hit ? sampleSkyField({ image, camera, photometry }, point, hit.normal, { maximumEmissionDegrees: limits.maximumEmissionDegrees }) : { reason: 'no-geometry' }; }
      : point => sampleFootprint({ image, camera, geometry, photometry }, point, { maximumSeparationMeters: separation, maximumEmissionDegrees: limits.maximumEmissionDegrees }),
    contourDepth: point => {
      contour ??= contourDistances(image.width, image.height, usable);
      const projected = camera.project(point);
      return projected && projected[2] > 0 ? contourDepth(contour, projected[0], projected[1]) : 0;
    },
    visible: point => {
      const d0 = point[0] - eye[0], d1 = point[1] - eye[1], d2 = point[2] - eye[2], distance = Math.hypot(d0, d1, d2);
      // A double carries 53 bits: at a telescope's distance the metre tolerance sits below the last place of the range itself, so the
      // test admits sixteen units in that place, twenty kilometres from 168 parsecs, still a hundred-millionth of a stellar radius.
      const slack = Math.max(tolerance, distance * 2 ** -48), hit = mesh.intersect(eye, [d0 / distance, d1 / distance, d2 / distance], distance + slack);
      return !!hit && Math.abs(hit.radius - distance) <= slack;
    },
    report: { id, startTime: image.startTime, filter: image.filter, camera: { kind: camera.kind, ...camera.report }, geometry: geometry.report, quality: image.report,
      pixels: { geometryPixels, acceptedPixels, acceptedLossyPixels, rejectedPixels }, footprint,
      ...(image.radianceFactor ? { radiometry: { ...image.radianceFactor, formula: 'I/F = pi * solarDistanceAu^2 * radiance / solarFlux; OSIRIS calibration HISTORY.' } } : {}), ...report } };
}
