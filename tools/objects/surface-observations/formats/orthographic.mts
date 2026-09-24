/** A registered orthophoto on an image-plane DEM. Every image pixel names one released terrain post, so no camera is needed. */
import type { ObservationFrame, SurfaceObservationFormat } from '../contract.mts';
import { decodeProfile, dimensions, parseSurfaceGeometry } from '../../terrestrial-layers/source-records.mts';
import { array, number, shape, text, requireArray, requireRecord } from '@cssearth/core';
import { OPTIONAL_LENS_KEYS, checkKeys, displayBasis, parseDisplay, validateEnvelope } from '../recipe.mts';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decodeIsis2Qube } from '../../terrestrial-layers/isis2-qube.mts';

const CONTEXT = 'orthographic observation';
const parseOrthographicLens = shape({ id: text, format: text, consumer: text, metadata: shape({ label: text, coverage: text }),
  frames: array(shape({ id: text, path: text, coordinatePaths: array(text) })), grid: shape({ ...dimensions, pixelToSource: array(number) }),
  maximumCoordinateErrorMeters: number, display: parseDisplay });
const lensPaths = (recipe: ReturnType<typeof parseOrthographicLens>) => recipe.frames.flatMap(frame => [frame.path, ...frame.coordinatePaths]);

function validateOrthographicRecipe(value: unknown, sourceGeometry: unknown) {
  checkKeys(value, ['id', 'format', 'consumer', 'metadata', 'frames', 'grid', 'maximumCoordinateErrorMeters', 'display'], [...OPTIONAL_LENS_KEYS], CONTEXT);
  for (const frame of requireArray(requireRecord(value).frames)) checkKeys(frame, ['id', 'path', 'coordinatePaths'], [], `${CONTEXT} frame`);
  const recipe = decodeProfile(parseOrthographicLens, value, 'Invalid source-registered orthographic observation.'), geometry = parseSurfaceGeometry(sourceGeometry);
  // An orthophoto is one registered image with its three coordinate cubes; it has no mosaic selection.
  validateEnvelope(recipe, lensPaths(recipe), { selections: [], displays: ['percentiles'], maximumFrames: 1, maximumLevelGain: 1, samplesPerTriangle: 'optional' }, CONTEXT);
  if (recipe.format !== 'isis2-orthographic' || recipe.frames[0].coordinatePaths.length !== 3 ||
      geometry?.format !== 'image-plane-dem' || geometry.sourceTopology !== 'open' ||
      !Number.isFinite(recipe.maximumCoordinateErrorMeters) || recipe.maximumCoordinateErrorMeters <= 0 ||
      !Array.isArray(recipe.grid?.pixelToSource) || recipe.grid.pixelToSource.length !== 4 || !recipe.grid.pixelToSource.every(Number.isFinite) ||
      recipe.grid.pixelToSource[0] <= 0 || recipe.grid.pixelToSource[2] >= 0) {
    throw new TypeError('Invalid source-registered orthographic observation.');
  }
}

export const orthographicFormat: SurfaceObservationFormat = {
  validate: validateOrthographicRecipe,
  paths: value => lensPaths(parseOrthographicLens(value)),
  async load(value, { sourceDirectory, radial }) {
    const recipe = parseOrthographicLens(value), frameRecipe = recipe.frames[0], mesh = radial.grid;
    const rasters = await Promise.all([frameRecipe.path, ...frameRecipe.coordinatePaths].map(async path => decodeIsis2Qube(await readFile(resolve(sourceDirectory, path)), recipe.grid)));
    const [photo, x, y, z] = rasters;
    if (!mesh.imageGrid) throw new Error('Orthographic source mesh lacks its image grid.');
    const [sx, x0, sy, y0] = recipe.grid.pixelToSource;
    let coordinatePixels = 0, maximumCoordinateErrorMeters = 0;
    const sourcePoints = new Map(mesh.positions.map((point, i) => [point.slice(0, 2).join(','), i]));
    const seen = new Set();
    for (let i = 0; i < photo.data.length; i++) {
      if (rasters.some(raster => raster.valid[i] !== photo.valid[i])) throw new Error('Orthographic observation masks disagree.');
      if (!photo.valid[i]) continue;
      const sourceId = sourcePoints.get([x.data[i], y.data[i]].join(','));
      const point = sourceId === undefined ? undefined : mesh.positions[sourceId];
      if (!point || seen.has(sourceId)) throw new Error('Orthographic coordinates do not identify unique source posts.');
      const error = Math.max(Math.abs(x.data[i] - (i % photo.width * sx + x0)),
        Math.abs(y.data[i] - (Math.floor(i / photo.width) * sy + y0)),
        Math.abs(z.data[i] + mesh.imageGrid.zOffsetMeters - point[2]));
      if (error > recipe.maximumCoordinateErrorMeters) throw new Error('Orthographic image registration exceeds source precision.');
      seen.add(sourceId); coordinatePixels++; maximumCoordinateErrorMeters = Math.max(maximumCoordinateErrorMeters, error);
    }
    if (seen.size !== mesh.positions.length) throw new Error('Orthographic XYZ does not cover every released source post.');
    const positionKm = [0, 0, 3556], camera = { kind: 'orthographic-registration', positionKm, pixelToSource: recipe.grid.pixelToSource };
    const frame: ObservationFrame = { id: frameRecipe.id, startTime: '', filter: '', positionKm, cameraKind: 'orthographic-registration', geometrySource: 'registered-posts',
      footprint: { pixelAngleMicroradians: NaN, nadirMedianMeters: Math.abs(sx), nadirMinimumMeters: Math.abs(sx), sampledPixels: coordinatePixels },
      sample: point => {
        const px = (point[0] - x0) / sx, py = (point[1] - y0) / sy;
        const ix = Math.floor(px), iy = Math.floor(py), tx = px - ix, ty = py - iy;
        if (ix < 0 || iy < 0 || ix + 1 >= photo.width || iy + 1 >= photo.height) return { reason: 'outside-detector' };
        const ids = [iy * photo.width + ix, iy * photo.width + ix + 1, (iy + 1) * photo.width + ix, (iy + 1) * photo.width + ix + 1];
        if (ids.some(i => !photo.valid[i])) return { reason: 'no-geometry' };
        const [a, b, c, d] = ids.map(i => photo.data[i]);
        return { radiance: a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty, gain: 1,
          separationMeters: maximumCoordinateErrorMeters, maximumEmissionDegrees: NaN, maximumIncidenceDegrees: NaN };
      },
      // The DEM is a height field seen from its own image plane; every registered post is visible to the orthophoto.
      visible: () => true,
      report: { id: frameRecipe.id, path: frameRecipe.path, camera, geometry: { source: 'registered-posts' },
        registration: { coordinatePixels, maximumCoordinateErrorMeters, completeSourcePostBijection: true,
          method: 'Every XYZ pixel identifies one released terrain post; every terrain post is accounted for.' } } };
    return { frames: [frame], exceeded: [], policy: { format: recipe.format,
      selection: 'single', samplesPerTriangle: 8, display: { range: 'surface-samples', percentiles: recipe.display.percentiles ?? [], units: 'Mission orthophoto brightness; original illumination retained. No albedo interpretation.', ...displayBasis(recipe.display) },
      photometry: { model: 'retained-observation', maximumGain: 1 }, retainsIllumination: true,
      limits: { maximumCoordinateErrorMeters: recipe.maximumCoordinateErrorMeters },
      limitations: 'Orthophoto from the rescued mission website, independently registered to the reviewed DEM. Radiometric calibration is not requalified.' } };
  },
};
