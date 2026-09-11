import type { SurfaceOptions, SurfaceColorSample } from './contracts.mts';
import {parseOrthographicRecipe,parseSurfaceGeometry,decodeProfile} from './source-records.mts';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { decodeIsis2Qube } from './isis2-qube.mts';
import { missingCoverageColor } from '../../../src/platform/prepare-missing-coverage.mts';

const safePath = (p: unknown) => typeof p === 'string' && p.length > 0 && !p.startsWith('/') && !p.includes('\\') && !p.split('/').includes('..');
export function validateOrthographicObservation(value: unknown, sourceGeometry: unknown) {
  const recipe=decodeProfile(parseOrthographicRecipe,value,'Invalid source-registered orthographic observation.'),geometry=parseSurfaceGeometry(sourceGeometry);
  if (recipe.format !== 'isis2-orthographic' || !safePath(recipe.path) ||
      !Array.isArray(recipe.coordinatePaths) || recipe.coordinatePaths.length !== 3 || !recipe.coordinatePaths.every(safePath) ||
      new Set([recipe.path, ...recipe.coordinatePaths]).size !== 4 ||
      !/^[a-z][a-z0-9-]*$/.test(recipe.id) || !/^[a-z][a-z0-9-]*$/.test(recipe.consumer) ||
      geometry?.format !== 'image-plane-dem' || geometry.sourceTopology !== 'open' ||
      !Number.isFinite(recipe.maximumCoordinateErrorMeters) || recipe.maximumCoordinateErrorMeters <= 0 ||
      !Number.isFinite(recipe.maximumSourceDistanceMeters) || recipe.maximumSourceDistanceMeters <= 0 ||
      recipe.maximumSourceDistanceMeters > geometry.simplification.maximumErrorMeters ||
      !Array.isArray(recipe.grid?.pixelToSource) || recipe.grid.pixelToSource.length !== 4 || !recipe.grid.pixelToSource.every(Number.isFinite) ||
      recipe.grid.pixelToSource[0] <= 0 || recipe.grid.pixelToSource[2] >= 0 ||
      !Array.isArray(recipe.displayRange) || recipe.displayRange.length !== 2 || !recipe.displayRange.every(Number.isFinite) ||
      recipe.displayRange[1] <= recipe.displayRange[0] || !recipe.metadata?.label || !recipe.metadata?.coverage) {
    throw new TypeError('Invalid source-registered orthographic observation.');
  }
}

export async function loadOrthographicObservation({ sourceDirectory, source, recipe: value, radial, config }: Omit<SurfaceOptions,'radial'> & {radial:Pick<SurfaceOptions['radial'],'grid'>}) {
  const recipe=parseOrthographicRecipe(value);
  validateOrthographicObservation(recipe, config.geometry.radialTerrain);
  const paths = [recipe.path, ...recipe.coordinatePaths], entries = await source.validateGroup(recipe.consumer);
  if (entries.length !== paths.length || !paths.every(path => entries.some(entry => entry.path === path))) {
    throw new Error('Orthographic image and every coordinate component must be pinned together.');
  }
  const rasters = await Promise.all(paths.map(async path => decodeIsis2Qube(await readFile(resolve(sourceDirectory, path)), recipe.grid)));
  const [photo, x, y, z] = rasters, mesh = radial.grid;
  if (!mesh.imageGrid) throw new Error('Orthographic source mesh lacks its image grid.');
  const [sx, x0, sy, y0] = recipe.grid.pixelToSource, [low, high] = recipe.displayRange;
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
  const metersPerUnit = config.geometry.radiusKm * 1000 / config.geometry.radius;
  function samplePoint(point: readonly number[]): SurfaceColorSample {
    const missing = (reason: string) => ({ reason, color: missingCoverageColor(
      Math.atan2(point[1], point[0]) * 180 / Math.PI,
      Math.atan2(point[2], Math.hypot(point[0], point[1])) * 180 / Math.PI, 180 / config.raster.height) });
    const hit = mesh.closestPoint(point.map(v => v * metersPerUnit), recipe.maximumSourceDistanceMeters);
    if (!hit) return missing('source-distance');
    const px = (hit.point[0] - x0) / sx, py = (hit.point[1] - y0) / sy;
    const ix = Math.floor(px), iy = Math.floor(py), tx = px - ix, ty = py - iy;
    if (ix < 0 || iy < 0 || ix + 1 >= photo.width || iy + 1 >= photo.height) return missing('outside-image');
    const ids = [iy * photo.width + ix, iy * photo.width + ix + 1, (iy + 1) * photo.width + ix, (iy + 1) * photo.width + ix + 1];
    if (ids.some(i => !photo.valid[i])) return missing('incomplete-pixel-footprint');
    const [a, b, c, d] = ids.map(i => photo.data[i]);
    const value = a * (1 - tx) * (1 - ty) + b * tx * (1 - ty) + c * (1 - tx) * ty + d * tx * ty;
    const gray = Math.round(Math.max(0, Math.min(1, (value - low) / (high - low))) * 255);
    return { color: [gray, gray, gray], radiance: value, distanceMeters: hit.distanceMeters,
      separationMeters: maximumCoordinateErrorMeters, gain: 1, frameId: recipe.id, frameIndex: 0 };
  }
  const preview = (width: number, height: number) => {
    const rgb = Buffer.alloc(width * height * 3), missing = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const longitude = (x + .5) * 360 / width, latitude = 90 - (y + .5) * 180 / height;
      const hit = mesh.hit(longitude, latitude, true), index = y * width + x;
      if (!hit) { missing[index] = 1; continue; }
      const lon = longitude * Math.PI / 180, lat = latitude * Math.PI / 180, radius = hit.radius / metersPerUnit;
      const sample = samplePoint([radius * Math.cos(lat) * Math.cos(lon), radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat)]);
      rgb.set(sample.color, index * 3); missing[index] = sample.reason ? 1 : 0;
    }
    return { rgb, missing };
  };
  return { samplePoint, preview, report: {
    camera: { kind: 'orthographic', positionKm: [0, 0, 3556], pixelToSource: recipe.grid.pixelToSource },
    sourceIds: entries.map(entry => ({ id: entry.id, sha256: entry.expectedSha256 })),
    registration: { coordinatePixels, maximumCoordinateErrorMeters, completeSourcePostBijection: true,
      method: 'Every XYZ pixel identifies one released terrain post; every terrain post is accounted for.' },
    frames: [{ id: recipe.id, path: recipe.path }],
    display: { low, high, units: 'Mission orthophoto brightness; original illumination retained. No albedo interpretation.' },
    photometry: { model: 'retained-observation', maximumGain: 1 },
    limitations: 'Orthophoto from the rescued mission website, independently registered to the reviewed DEM. Radiometric calibration is not requalified.',
    previewPolicy: 'Unique source ray for flat previews; closest full-source point for retained triangles.' } };
}
