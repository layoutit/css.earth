import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decodeOsirisGeo, decodeOsirisQuality, acceptOsirisQuality, fitCamera, project, sampleGeo, lommelSeeligerGain } from './osiris-geo.mjs';
import { sampleTrianglePoints, fitObservationLevels, selectObservation } from './observation-mosaic.mjs';
import { missingCoverageColor } from '../../../src/platform/prepare-missing-coverage.mjs';

const safePath = path => typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.split(/[\\/]/).includes('..');
const positive = value => Number.isFinite(value) && value > 0;
export function validateGeoSurfaceRecipe(recipe, geometry) {
  if (recipe.frames !== undefined) {
    const frames = recipe.frames, levels = recipe.levelMatching;
    if (!Array.isArray(frames) || frames.length < 2 || frames.length > 8 || recipe.path !== undefined ||
        recipe.qualityPath !== undefined || recipe.startTime !== undefined || recipe.selection !== 'lowest-emission' ||
        !levels || !Number.isInteger(levels.samplesPerTriangle) || levels.samplesPerTriangle < 4 || levels.samplesPerTriangle > 64 ||
        !Number.isInteger(levels.minimumPairs) || levels.minimumPairs < 64 || levels.minimumPairs > 10000 ||
        !positive(levels.maximumLogMad) || levels.maximumLogMad > .3 || !positive(levels.maximumGain) || levels.maximumGain < 1 || levels.maximumGain > 1.5 ||
        frames.some(frame => !frame || !/^[a-z][a-z0-9-]*$/.test(frame.id) || Object.keys(frame).some(key => !['id', 'path', 'qualityPath', 'startTime'].includes(key))) ||
        new Set(frames.map(frame => frame.id)).size !== frames.length || new Set(frames.flatMap(frame => [frame.path, frame.qualityPath])).size !== frames.length * 2) {
      throw new TypeError('Invalid source-bound georeferenced observation mosaic.');
    }
    for (const frame of frames) validateGeoSurfaceRecipe({ ...recipe, ...frame, id: recipe.id, frames: undefined, selection: undefined, levelMatching: undefined }, geometry);
    return;
  }
  if (recipe.selection !== undefined || recipe.levelMatching !== undefined) throw new TypeError('Invalid source-bound observation selection.');
  const policy = recipe.transfer, photometry = recipe.photometry;
  if (recipe.format !== 'osiris-geo' || !/^[a-z][a-z0-9-]*$/.test(recipe.id) || !/^[a-z][a-z0-9-]*$/.test(recipe.consumer) ||
      !safePath(recipe.path) || !safePath(recipe.qualityPath) || recipe.path === recipe.qualityPath ||
      !recipe.startTime || !recipe.filter || typeof recipe.allowLossy !== 'boolean' ||
      typeof recipe.metadata?.label !== 'string' || !recipe.metadata?.coverage ||
      !geometry || geometry.simplification?.method !== 'source-meshoptimizer' ||
      !positive(policy?.maximumSourceDistanceMeters) || policy.maximumSourceDistanceMeters > geometry.simplification.maximumErrorMeters ||
      !positive(policy?.maximumSeparationMeters) || policy.maximumSeparationMeters > 50 ||
      !positive(policy?.visibilityToleranceMeters) || policy.visibilityToleranceMeters > 1 ||
      !positive(policy?.maximumEmissionDegrees) || policy.maximumEmissionDegrees >= 90 ||
      photometry?.model !== 'lommel-seeliger' || photometry.referenceIncidenceDegrees !== 0 || photometry.referenceEmissionDegrees !== 0 ||
      !positive(photometry.maximumIncidenceDegrees) || photometry.maximumIncidenceDegrees >= 90 ||
      !positive(photometry.maximumEmissionDegrees) || photometry.maximumEmissionDegrees > policy.maximumEmissionDegrees ||
      !positive(photometry.maximumGain) || photometry.maximumGain > 3 ||
      !Array.isArray(recipe.displayPercentiles) || recipe.displayPercentiles.length !== 2 ||
      !recipe.displayPercentiles.every(Number.isFinite) || recipe.displayPercentiles[0] < 0 || recipe.displayPercentiles[1] > 100 ||
      recipe.displayPercentiles[0] >= recipe.displayPercentiles[1]) throw new TypeError('Invalid source-bound georeferenced observation recipe.');
}

/** Recover the controlled pinhole camera from archived XYZ/pixel pairs. A
 * disjoint holdout covers every remaining geometry-backed pixel. */
export function calibrateGeoCamera(frame) {
  const points = [], pixels = [];
  for (let i = 0; i < frame.width * frame.height; i += 179) if (frame.valid(i)) {
    points.push(frame.xyz(i)); pixels.push([i % frame.width, Math.floor(i / frame.width)]);
  }
  const camera = fitCamera(points, pixels, frame.width, frame.height);
  let count = 0, maximum = 0, squared = 0;
  for (let i = 0; i < frame.width * frame.height; i++) if (i % 179 !== 0 && frame.valid(i)) {
    const p = project(camera.matrix, frame.xyz(i)), residual = Math.hypot(p[0] - i % frame.width, p[1] - Math.floor(i / frame.width));
    if (!Number.isFinite(residual) || p[2] <= 0) throw new Error('GEO camera has an invalid projection.');
    count++; maximum = Math.max(maximum, residual); squared += residual * residual;
  }
  if (count < points.length || maximum > .01) throw new Error('GEO camera does not explain independent holdout coordinates.');
  return { ...camera, fitPixels: points.length, holdoutPixels: count,
    maximumResidualPixels: maximum, rmsResidualPixels: Math.sqrt(squared / count) };
}

async function loadSingleGeoObservationSurface({ sourceDirectory, source, recipe, radial, config }) {
  validateGeoSurfaceRecipe(recipe, config.geometry.radialTerrain);
  const entries = await source.validateGroup(recipe.consumer);
  if (entries.length !== 2 || ![recipe.path, recipe.qualityPath].every(path => entries.some(e => e.path === path))) {
    throw new Error('GEO observation must consume its exact pinned image and quality companion.');
  }
  const frame = decodeOsirisGeo(await readFile(resolve(sourceDirectory, recipe.path)));
  if (frame.startTime !== recipe.startTime || frame.filter !== recipe.filter) throw new Error('GEO observation identity changed.');
  frame.quality = { ...decodeOsirisQuality(await readFile(resolve(sourceDirectory, recipe.qualityPath)), frame), allowLossy: recipe.allowLossy };
  const camera = calibrateGeoCamera(frame), corrected = [];
  const sourceCoverage = { geometryPixels: 0, qualityRejectedPixels: 0, photometryRejectedPixels: 0, acceptedPixels: 0, acceptedLossyPixels: 0 };
  for (let i = 0; i < frame.width * frame.height; i++) if (frame.valid(i)) {
    sourceCoverage.geometryPixels++;
    if (!acceptOsirisQuality(frame.quality.flags[i], recipe.allowLossy)) { sourceCoverage.qualityRejectedPixels++; continue; }
    const gain = lommelSeeligerGain(frame.planes.INCIDENCE_ANGLE_IMAGE[i], frame.planes.EMISSION_ANGLE_IMAGE[i], recipe.photometry);
    if (gain === null) { sourceCoverage.photometryRejectedPixels++; continue; }
    corrected.push(frame.planes.IMAGE[i] * gain); sourceCoverage.acceptedPixels++;
    if (frame.quality.flags[i] & 8) sourceCoverage.acceptedLossyPixels++;
  }
  corrected.sort((a, b) => a - b);
  const [low, high] = recipe.displayPercentiles.map(p => corrected[Math.min(corrected.length - 1, Math.floor(corrected.length * p / 100))]);
  if (!(high > low)) throw new Error('GEO observation has no qualified display contrast.');
  const metersPerUnit = config.geometry.radiusKm * 1000 / config.geometry.radius;
  const eye = camera.positionKm.map(n => n * 1000), policy = { ...recipe.transfer, photometry: recipe.photometry };
  const report = { camera, sourceCoverage, quality: frame.quality.report, photometry: { ...recipe.photometry,
    formula: 'D=2*cos(i)/(cos(i)+cos(e)); linear radiance divided by D before interpolation; reference D(0,0)=1.',
    applicationLighting: 'Uniform flood displays normalized imagery; Shadows applies the existing fixed-epoch Sun bank.',
    limitations: 'No phase correction, Hapke roughness correction or cast-shadow recovery. Relative display brightness, not measured albedo.' },
    display: { percentiles: recipe.displayPercentiles, low, high, units: 'relative disk-normalized radiance; linear grayscale display' },
    sourceIds: entries.map(e => ({ id: e.id, sha256: e.expectedSha256 })),
    previewPolicy: 'Radial preview with ambiguous intersections withheld; retained triangle atlas uses closest original source point in 3D.' };
  function samplePoint(displayPoint) {
    const point = displayPoint.map(n => n * metersPerUnit);
    const missing = reason => ({ reason, color: missingCoverageColor(Math.atan2(point[1], point[0]) * 180 / Math.PI,
      Math.atan2(point[2], Math.hypot(point[0], point[1])) * 180 / Math.PI, 180 / config.raster.height) });
    const preliminary = sampleGeo(frame, camera.matrix, point.map(n => n / 1000),
      { ...policy, maximumSeparationMeters: policy.maximumSourceDistanceMeters + policy.maximumSeparationMeters });
    if (preliminary.reason) return missing(preliminary.reason);
    const hit = radial.grid.closestPoint(point, policy.maximumSourceDistanceMeters);
    if (!hit) return missing('source-distance');
    const sampled = sampleGeo(frame, camera.matrix, hit.point.map(n => n / 1000), policy);
    if (sampled.reason) return missing(sampled.reason);
    const delta = hit.point.map((n, i) => n - eye[i]), distance = Math.hypot(...delta);
    const ray = radial.grid.intersect(eye, delta.map(n => n / distance), distance + policy.visibilityToleranceMeters);
    if (!ray || Math.abs(ray.radius - distance) > policy.visibilityToleranceMeters) return missing('occluded');
    const gray = Math.round(Math.max(0, Math.min(1, (sampled.radiance - low) / (high - low))) * 255);
    return { color: [gray, gray, gray], distanceMeters: hit.distanceMeters, separationMeters: sampled.separationMeters, gain: sampled.gain,
      radiance: sampled.radiance, maximumEmissionDegrees: sampled.maximumEmissionDegrees };
  }
  const preview = (width, height) => previewGeoSurface(samplePoint, radial, config, width, height);
  return { samplePoint, preview, report };
}

function previewGeoSurface(samplePoint, radial, config, width, height) {
  const metersPerUnit = config.geometry.radiusKm * 1000 / config.geometry.radius;
  const rgb = Buffer.alloc(width * height * 3), missing = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const lon = (x + .5) * 360 / width, lat = 90 - (y + .5) * 180 / height;
    const hit = radial.grid.hit(lon, lat, true), index = y * width + x;
    if (!hit) { missing[index] = 1; continue; }
    const longitude = lon * Math.PI / 180, latitude = lat * Math.PI / 180, r = hit.radius / metersPerUnit;
    const point = [r * Math.cos(latitude) * Math.cos(longitude), r * Math.cos(latitude) * Math.sin(longitude), r * Math.sin(latitude)];
    const sample = samplePoint(point); rgb.set(sample.color, index * 3); missing[index] = sample.reason ? 1 : 0;
  }
  return { rgb, missing };
}

export async function loadGeoObservationSurface(options) {
  const { sourceDirectory, source, recipe, radial, config } = options;
  validateGeoSurfaceRecipe(recipe, config.geometry.radialTerrain);
  if (!recipe.frames) return loadSingleGeoObservationSurface(options);
  const entries = await source.validateGroup(recipe.consumer), paths = recipe.frames.flatMap(frame => [frame.path, frame.qualityPath]);
  if (entries.length !== paths.length || !paths.every(path => entries.some(entry => entry.path === path))) throw new Error('Mosaic must consume every exact pinned image and quality companion.');
  const observations = [];
  for (const frame of recipe.frames) {
    observations.push(await loadSingleGeoObservationSurface({ sourceDirectory, radial, config,
      recipe: { ...recipe, ...frame, id: recipe.id, frames: undefined, selection: undefined, levelMatching: undefined },
      source: { validateGroup: async () => entries.filter(entry => [frame.path, frame.qualityPath].includes(entry.path)) } }));
  }
  const points = sampleTrianglePoints(radial.faces, recipe.levelMatching.samplesPerTriangle);
  const samples = observations.map(observation => points.map(point => observation.samplePoint(point)));
  const levels = fitObservationLevels(samples, recipe.levelMatching);
  const display = observations[0].report.display;
  const report = { camera: observations[0].report.camera,
    frames: observations.map((observation, index) => ({ id: recipe.frames[index].id, startTime: recipe.frames[index].startTime,
      filter: recipe.filter, ...observation.report })),
    sourceIds: entries.map(entry => ({ id: entry.id, sha256: entry.expectedSha256 })),
    selection: recipe.selection, levelMatching: { ...recipe.levelMatching, ...levels, sampledPoints: points.length },
    display: { ...display, referenceFrame: recipe.frames[0].id },
    previewPolicy: observations[0].report.previewPolicy };
  const samplePoint = point => {
    const values = observations.map(observation => observation.samplePoint(point)), index = selectObservation(values);
    if (index < 0) return { ...values[0], reason: 'no-qualified-observation' };
    const value = values[index], radiance = value.radiance * levels.gains[index];
    const gray = Math.round(Math.max(0, Math.min(1, (radiance - display.low) / (display.high - display.low))) * 255);
    return { ...value, color: [gray, gray, gray], radiance, frameId: recipe.frames[index].id, frameIndex: index };
  };
  return { samplePoint, report, preview: (width, height) => previewGeoSurface(samplePoint, radial, config, width, height) };
}
