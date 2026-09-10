import type { SurfaceOptions, SurfaceColorSample, GeoFrame, GeoObservationFrame, RadialSurface, SurfaceConfig } from './contracts.mts';
import type {SourceInput} from '../../../src/platform/source-manifest.mts';
import {parseGeoRecipe,parseSurfaceGeometry,parseGeoCameraClosure,decodeProfile} from './source-records.mts';
import {requireRecord,requireString} from '../../source-values.mts';
type GeoRecipe = ReturnType<typeof parseGeoRecipe>;
import { validateEncounterRecipe, loadEncounterSurface } from './encounter-surface.mts';
import { validateOrthographicObservation, loadOrthographicObservation } from './image-dem-observation.mts';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decodeOsirisGeo, decodeOsirisQuality, acceptOsirisQuality, fitCamera, project, sampleGeo, diskGain } from './osiris-geo.mts';
import { sampleTrianglePoints, fitObservationLevels, selectObservation } from './observation-mosaic.mts';
import { missingCoverageColor } from '../../../src/platform/prepare-missing-coverage.mts';
import { decodeAmicaGeo } from './amica-geo.mts';
import { decodeOsirisReflectance, attachSourceGeometry } from './archived-camera.mts';
import { decodeLlorri } from './llorri-geo.mts';

const safePath = (path: unknown) => typeof path === 'string' && path.length > 0 && !path.startsWith('/') && !path.split(/[\\/]/).includes('..');
const positive = (value: number) => Number.isFinite(value) && value > 0;
const archivedCamera = (recipe: {format:string}) => ['osiris-camera', 'llorri-camera'].includes(recipe.format);
const framePaths = (recipe: Pick<GeoRecipe,"format"|"path"|"labelPath"|"originalPath"|"flatPath"|"cameraPath"|"qualityPath">): string[] => ( recipe.format === 'amica-gaskell'
  ? [recipe.path, recipe.labelPath, recipe.originalPath, recipe.flatPath]
  : archivedCamera(recipe) ? [recipe.path, recipe.cameraPath] : [recipe.path, recipe.qualityPath]).map(path=>requireString(path,'source-bound observation path'));
export function validateGeoSurfaceRecipe(value: unknown, sourceGeometry: unknown) {
  const format=requireRecord(value).format;
  if (format === 'isis2-orthographic') return validateOrthographicObservation(value, sourceGeometry);
  if (format === 'encounter-fits') return validateEncounterRecipe(value, sourceGeometry);
  const recipe=decodeProfile(parseGeoRecipe,value,'Invalid source-bound georeferenced observation recipe.'),geometry=parseSurfaceGeometry(sourceGeometry);
  if (recipe.frames !== undefined) {
    const frames = recipe.frames, levels = recipe.levelMatching;
    const ownedPaths = Array.isArray(frames) ? frames.flatMap(frame => framePaths({ ...recipe, ...frame })
      .filter(path => recipe.format !== 'amica-gaskell' || path !== recipe.flatPath)) : [];
    if (!Array.isArray(frames) || frames.length < 2 || frames.length > 8 || recipe.path !== undefined ||
        recipe.qualityPath !== undefined || recipe.labelPath !== undefined || recipe.originalPath !== undefined || recipe.startTime !== undefined || recipe.selection !== 'lowest-emission' ||
        !levels || !Number.isInteger(levels.samplesPerTriangle) || levels.samplesPerTriangle === undefined || levels.samplesPerTriangle < 4 || levels.samplesPerTriangle > 64 ||
        !Number.isInteger(levels.minimumPairs) || levels.minimumPairs < 64 || levels.minimumPairs > 10000 ||
        !positive(levels.maximumLogMad) || levels.maximumLogMad > .3 || !positive(levels.maximumGain) || levels.maximumGain < 1 || levels.maximumGain > 1.5 ||
        frames.some(frame => !frame || !/^[a-z][a-z0-9-]*$/.test(frame.id) || Object.keys(frame).some(key => !['id', 'path', 'qualityPath', 'labelPath', 'originalPath', 'startTime'].includes(key))) ||
        new Set(frames.map(frame => frame.id)).size !== frames.length || new Set(ownedPaths).size !== ownedPaths.length) {
      throw new TypeError('Invalid source-bound georeferenced observation mosaic.');
    }
    for (const frame of frames) validateGeoSurfaceRecipe({ ...recipe, ...frame, id: recipe.id, frames: undefined, selection: undefined, levelMatching: undefined }, geometry);
    return;
  }
  if (recipe.selection !== undefined || recipe.levelMatching !== undefined) throw new TypeError('Invalid source-bound observation selection.');
  const policy = recipe.transfer, photometry = recipe.photometry;
  const paths = framePaths(recipe), amica = recipe.format === 'amica-gaskell', controlled = archivedCamera(recipe);
  const validPhotometry = photometry && (photometry.model === 'lommel-seeliger' ||
    (recipe.format === 'osiris-camera' && photometry.model === 'minnaert' &&
      Number.isFinite(photometry.coefficient) && photometry.coefficient !== undefined && photometry.coefficient >= .5 && photometry.coefficient <= 1 &&
      Number.isFinite(photometry.phaseCoefficientPerDegree) && photometry.phaseCoefficientPerDegree !== undefined && photometry.phaseCoefficientPerDegree >= 0 && photometry.phaseCoefficientPerDegree <= .01) ||
    (recipe.format === 'llorri-camera' && photometry.model === 'retained-observation' && photometry.maximumGain === 1));
  if (!['osiris-geo', 'amica-gaskell', 'osiris-camera', 'llorri-camera'].includes(recipe.format) || !/^[a-z][a-z0-9-]*$/.test(recipe.id) || !/^[a-z][a-z0-9-]*$/.test(recipe.consumer) ||
      !paths.every(safePath) || new Set(paths).size !== paths.length ||
      (amica ? recipe.qualityPath !== undefined || recipe.allowLossy !== true || recipe.filter !== 'V'
        : recipe.labelPath !== undefined || recipe.originalPath !== undefined || recipe.flatPath !== undefined) ||
      (controlled ? recipe.qualityPath !== undefined : recipe.cameraPath !== undefined) ||
      !recipe.startTime || !recipe.filter || typeof recipe.allowLossy !== 'boolean' ||
      typeof recipe.metadata?.label !== 'string' || !recipe.metadata?.coverage ||
      !geometry || geometry.simplification?.method !== 'source-meshoptimizer' ||
      !positive(policy?.maximumSourceDistanceMeters) || policy.maximumSourceDistanceMeters > geometry.simplification.maximumErrorMeters ||
      !positive(policy?.maximumSeparationMeters) || policy.maximumSeparationMeters > (controlled ? 600 : 50) ||
      !positive(policy?.visibilityToleranceMeters) || policy.visibilityToleranceMeters > 1 ||
      !positive(policy?.maximumEmissionDegrees) || policy.maximumEmissionDegrees >= 90 ||
      !validPhotometry || photometry.referenceIncidenceDegrees !== 0 || photometry.referenceEmissionDegrees !== 0 ||
      !positive(photometry.maximumIncidenceDegrees) || photometry.maximumIncidenceDegrees >= 90 ||
      !positive(photometry.maximumEmissionDegrees) || photometry.maximumEmissionDegrees > policy.maximumEmissionDegrees ||
      !positive(photometry.maximumGain) || photometry.maximumGain > 3 ||
      !Array.isArray(recipe.displayPercentiles) || recipe.displayPercentiles.length !== 2 ||
      !recipe.displayPercentiles.every(Number.isFinite) || recipe.displayPercentiles[0] < 0 || recipe.displayPercentiles[1] > 100 ||
      recipe.displayPercentiles[0] >= recipe.displayPercentiles[1]) throw new TypeError('Invalid source-bound georeferenced observation recipe.');
}

/** Recover the controlled pinhole camera from archived XYZ/pixel pairs. A
 * disjoint holdout covers every remaining geometry-backed pixel. */
export function calibrateGeoCamera(frame: GeoFrame) {
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

async function loadSingleGeoObservationSurface({ sourceDirectory, source, recipe:value, radial, config }: SurfaceOptions) {
  const recipe=parseGeoRecipe(value);
  validateGeoSurfaceRecipe(recipe, config.geometry.radialTerrain);
  const entries = await source.validateGroup(recipe.consumer);
  const paths = framePaths(recipe);
  if (entries.length !== paths.length || !paths.every(path => entries.some(e => e.path === path))) {
    throw new Error('GEO observation must consume its exact pinned image and quality companion.');
  }
  const read = (path: string|undefined) => readFile(resolve(sourceDirectory, requireString(path)));
  const camera = archivedCamera(recipe) ? parseGeoCameraClosure(JSON.parse((await read(recipe.cameraPath)).toString("utf8"))) : null;
  if (camera) {
    const pins = source.manifest?.inputs;
    if (!pins || camera.meshSha256 !== pins.find(e => e.path === config.geometry.radialTerrain.path)?.expectedSha256 ||
        !Array.isArray(camera.provenance) || camera.provenance.length < 3) throw new Error('Camera lacks its exact source-mesh closure.');
    for (const entry of camera.provenance) {
      if (!safePath(entry.path) || !pins.some(e => e.path === entry.path && e.expectedSha256 === entry.sha256)) throw new Error('Camera source provenance changed.');
      await source.validatePath(entry.path);
    }
  }
  const frame: GeoObservationFrame = camera ? attachSourceGeometry(recipe.format === 'llorri-camera'
    ? decodeLlorri(await read(recipe.path), camera)
    : decodeOsirisReflectance(await read(recipe.path), camera, recipe.allowLossy), radial.grid)
    : recipe.format === 'amica-gaskell' ? decodeAmicaGeo(await read(recipe.path),
    (await read(recipe.labelPath)).toString('ascii'), await read(recipe.originalPath), await read(recipe.flatPath))
    : decodeOsirisGeo(await read(recipe.path));
  if (frame.startTime !== recipe.startTime || frame.filter !== recipe.filter) throw new Error('GEO observation identity changed.');
  if (recipe.format === 'osiris-geo') frame.quality = { ...decodeOsirisQuality(await read(recipe.qualityPath), {...frame,label:requireString(requireRecord(frame).label)}), allowLossy: recipe.allowLossy };
  return prepareGeoFrameSurface({ frame, recipe, radial, config, entries });
}

export function prepareGeoFrameSurface({ frame, recipe:value, radial, config, entries }: {frame:GeoObservationFrame;recipe:unknown;radial:RadialSurface;config:SurfaceConfig;entries:readonly SourceInput[]}) {
  const recipe=parseGeoRecipe(value);
  const camera = frame.camera ?? calibrateGeoCamera(frame), corrected: number[] = [];
  const sourceCoverage = { geometryPixels: 0, qualityRejectedPixels: 0, photometryRejectedPixels: 0, acceptedPixels: 0, acceptedLossyPixels: 0 };
  for (let i = 0; i < frame.width * frame.height; i++) if (frame.valid(i)) {
    sourceCoverage.geometryPixels++;
    if (frame.acceptPixel ? !frame.acceptPixel(i) : !frame.quality || !acceptOsirisQuality(frame.quality.flags[i], recipe.allowLossy)) { sourceCoverage.qualityRejectedPixels++; continue; }
    const gain = diskGain(frame.planes.INCIDENCE_ANGLE_IMAGE[i], frame.planes.EMISSION_ANGLE_IMAGE[i], recipe.photometry, frame.planes.PHASE_ANGLE_IMAGE?.[i]);
    if (gain === null) { sourceCoverage.photometryRejectedPixels++; continue; }
    corrected.push(frame.planes.IMAGE[i] * gain); sourceCoverage.acceptedPixels++;
    if (frame.quality ? frame.quality.flags[i] & 8 : frame.isLossyPixel ? frame.isLossyPixel(i) : frame.qualityReport?.outputMode === 'LOSSY') sourceCoverage.acceptedLossyPixels++;
  }
  corrected.sort((a, b) => a - b);
  const [low, high] = recipe.displayPercentiles.map(p => corrected[Math.min(corrected.length - 1, Math.floor(corrected.length * p / 100))]);
  if (!(high > low)) throw new Error('GEO observation has no qualified display contrast.');
  const metersPerUnit = config.geometry.radiusKm * 1000 / config.geometry.radius;
  const eye = camera.positionKm.map(n => n * 1000), policy = { ...recipe.transfer, photometry: recipe.photometry };
  const report = { camera, sourceCoverage, quality: frame.quality?.report ?? frame.qualityReport, photometry: { ...recipe.photometry,
    formula: recipe.photometry.model === 'retained-observation' ? 'Original acquisition illumination retained; no photometric disk correction.' : recipe.photometry.model === 'minnaert'
      ? 'D=cos(i)^k*cos(e)^(k-1); k=coefficient+phaseCoefficientPerDegree*phaseDegrees; linear reflectance divided by D before interpolation; D(0,0)=1.'
      : 'D=2*cos(i)/(cos(i)+cos(e)); linear radiance divided by D before interpolation; reference D(0,0)=1.',
    applicationLighting: recipe.photometry.model === 'retained-observation'
      ? 'Uniform flood displays the acquisition illumination; Shadows applies the existing fixed-epoch Sun bank.'
      : recipe.format === 'osiris-camera' ? 'Uniform flood displays the prepared observation; Shadows applies the existing fixed-epoch Sun bank.'
      : 'Uniform flood displays normalized imagery; Shadows applies the existing fixed-epoch Sun bank.',
    limitations: 'No phase correction, Hapke roughness correction or cast-shadow recovery. Relative display brightness, not measured albedo.' },
    display: { percentiles: recipe.displayPercentiles, low, high, units: recipe.format === 'amica-gaskell'
      ? 'relative flat-fielded detector brightness with approximate disk normalization; linear grayscale display'
      : recipe.format === 'llorri-camera' ? 'relative DN/s with original illumination; linear grayscale display'
      : recipe.format === 'osiris-camera' ? 'relative disk-normalized I/F; linear grayscale display'
      : 'relative disk-normalized radiance; linear grayscale display' },
    sourceIds: entries.map(e => ({ id: e.id, sha256: e.expectedSha256 })),
    previewPolicy: 'Radial preview with ambiguous intersections withheld; retained triangle atlas uses closest original source point in 3D.' };
  function samplePoint(displayPoint: readonly number[]): SurfaceColorSample {
    const point = displayPoint.map(n => n * metersPerUnit);
    const missing = (reason: string) => ({ reason, color: missingCoverageColor(Math.atan2(point[1], point[0]) * 180 / Math.PI,
      Math.atan2(point[2], Math.hypot(point[0], point[1])) * 180 / Math.PI, 180 / config.raster.height) });
    const preliminary = sampleGeo(frame, camera.matrix, point.map(n => n / 1000),
      { ...policy, maximumSeparationMeters: policy.maximumSourceDistanceMeters + policy.maximumSeparationMeters });
    if (preliminary.reason) return missing(preliminary.reason);
    const hit = radial.grid.closestPoint(point, policy.maximumSourceDistanceMeters);
    if (!hit) return missing('source-distance');
    const sampled = sampleGeo(frame, camera.matrix, hit.point.map(n => n / 1000), policy);
    if (sampled.reason !== undefined) return missing(sampled.reason);
    const delta = hit.point.map((n, i) => n - eye[i]), distance = Math.hypot(...delta);
    const ray = radial.grid.intersect(eye, delta.map(n => n / distance), distance + policy.visibilityToleranceMeters);
    if (!ray || Math.abs(ray.radius - distance) > policy.visibilityToleranceMeters) return missing('occluded');
    const gray = Math.round(Math.max(0, Math.min(1, (sampled.radiance - low) / (high - low))) * 255);
    return { color: [gray, gray, gray], distanceMeters: hit.distanceMeters, separationMeters: sampled.separationMeters, gain: sampled.gain,
      radiance: sampled.radiance, maximumEmissionDegrees: sampled.maximumEmissionDegrees };
  }
  const preview = (width: number, height: number) => previewGeoSurface(samplePoint, radial, config, width, height);
  return { samplePoint, preview, report };
}

function previewGeoSurface(samplePoint: (point:readonly number[])=>SurfaceColorSample, radial: RadialSurface, config: SurfaceConfig, width: number, height: number) {
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

export async function loadGeoObservationSurface(options: SurfaceOptions) {
  const format=requireRecord(options.recipe).format;
  if (format === 'isis2-orthographic') return loadOrthographicObservation(options);
  if (format === 'encounter-fits') return loadEncounterSurface(options);
  const { sourceDirectory, source, radial, config } = options;
  const recipe=parseGeoRecipe(options.recipe);
  validateGeoSurfaceRecipe(recipe, config.geometry.radialTerrain);
  if (!recipe.frames) return loadSingleGeoObservationSurface(options);
  const frames=recipe.frames;
  const entries = await source.validateGroup(recipe.consumer), paths = [...new Set(frames.flatMap(frame => framePaths({ ...recipe, ...frame })))];
  if (entries.length !== paths.length || !paths.every(path => entries.some(entry => entry.path === path))) throw new Error('Mosaic must consume every exact pinned image and quality companion.');
  const observations: Awaited<ReturnType<typeof loadSingleGeoObservationSurface>>[] = [];
  for (const frame of frames) {
    observations.push(await loadSingleGeoObservationSurface({ sourceDirectory, radial, config,
      recipe: { ...recipe, ...frame, id: recipe.id, frames: undefined, selection: undefined, levelMatching: undefined },
      source: { ...source, validateGroup: async () => entries.filter(entry => framePaths({ ...recipe, ...frame }).includes(entry.path)) } }));
  }
  if(!recipe.levelMatching || recipe.levelMatching.samplesPerTriangle===undefined)throw new Error("Missing source-bound mosaic level matching.");
  const points = sampleTrianglePoints(radial.faces, recipe.levelMatching.samplesPerTriangle);
  const samples = observations.map(observation => points.map(point => observation.samplePoint(point)));
  const levels = fitObservationLevels(samples, recipe.levelMatching);
  const display = observations[0].report.display;
  const report = { camera: observations[0].report.camera,
    frames: observations.map((observation, index) => ({ id: frames[index].id, startTime: frames[index].startTime,
      filter: recipe.filter, ...observation.report })),
    sourceIds: entries.map(entry => ({ id: entry.id, sha256: entry.expectedSha256 })),
    selection: recipe.selection, levelMatching: { ...recipe.levelMatching, ...levels, sampledPoints: points.length },
    display: { ...display, referenceFrame: frames[0].id },
    previewPolicy: observations[0].report.previewPolicy };
  const samplePoint = (point: readonly number[]): SurfaceColorSample => {
    const values = observations.map(observation => observation.samplePoint(point)), index = selectObservation(values);
    if (index < 0) return { color:values[0].color, reason: 'no-qualified-observation' };
    const value = values[index];if(value.reason!==undefined)return value;
    const radiance = value.radiance * levels.gains[index];
    const gray = Math.round(Math.max(0, Math.min(1, (radiance - display.low) / (display.high - display.low))) * 255);
    return { ...value, color: [gray, gray, gray], radiance, frameId: frames[index].id, frameIndex: index };
  };
  return { samplePoint, report, preview: (width: number, height: number) => previewGeoSurface(samplePoint, radial, config, width, height) };
}
