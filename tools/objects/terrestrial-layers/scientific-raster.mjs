import { resolve } from 'node:path';
import { fromFile } from 'geotiff';
import {loadIsis3Raster} from './isis3-raster.mjs';
import { paintMissingCoverage } from '../../../src/platform/prepare-missing-coverage.mjs';
import {composeCorrectedColor} from './photometric-observations.mjs';
import { loadPdsScalarGrid } from './pds-scalar-grid.mjs';
import { loadShapeScalarGrid } from './obj-shape.mjs';

/** Interpolate the authored numeric scale; source units remain unchanged. */
export function colorForValue(value, { minimum, maximum, colors }) {
  const t = Math.max(0, Math.min(1, (value - minimum) / (maximum - minimum))) * (colors.length - 1);
  const i = Math.min(colors.length - 2, Math.floor(t)), fraction = t - i;
  const rgb = hex => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
  const a = rgb(colors[i]), b = rgb(colors[i + 1]);
  return a.map((v, c) => Math.round(v + (b[c] - v) * fraction));
}

/** Local finite differences on the source's own reference sphere. */
export function terrainBrightness(source, longitude, latitude, step, relief) {
  const west = source.sample((longitude - step + 360) % 360, latitude);
  const east = source.sample((longitude + step) % 360, latitude);
  const north = source.sample(longitude, latitude + step);
  const south = source.sample(longitude, latitude - step);
  if ([west, east, north, south].some(value => value === null)) return 1;
  const distance = relief.referenceRadiusMeters * step * Math.PI / 180;
  const heightToMeters = relief.heightToMeters ?? 1;
  const eastSlope = (east - west) * heightToMeters / (2 * distance * Math.cos(latitude * Math.PI / 180));
  const northSlope = (north - south) * heightToMeters / (2 * distance);
  const [eastLight, northLight, upLight] = relief.lightDirection;
  const illumination = Math.max(0, (-eastLight * eastSlope - northLight * northSlope + upLight)
    / Math.hypot(eastSlope, northSlope, 1));
  return (relief.ambient + (1 - relief.ambient) * illumination)
    / (relief.ambient + (1 - relief.ambient) * upLight);
}

/** Sample the measured grid before applying the authored unit/datum conversion. */
export function sampleScienceGrid(data, grid, px, py, { sampling = 'nearest', valueTransform } = {}) {
  if (px < 0 || py < 0 || px >= grid.width || py >= grid.height) return null;
  const valueAt = (x, y) => {
    const value = data[y * grid.width + x];
    return !Number.isFinite(value) || value === grid.noData || Math.abs(value) > (grid.specialValueMagnitude ?? Infinity) ? null : value;
  };
  let value;
  if (sampling === 'bilinear') {
    // The edge pixel covers its complete cell, but never extends outside the raster.
    const x = Math.max(0, Math.min(grid.width - 1, px - 0.5));
    const y = Math.max(0, Math.min(grid.height - 1, py - 0.5));
    const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(x0 + 1, grid.width - 1), y1 = Math.min(y0 + 1, grid.height - 1);
    const values = [valueAt(x0, y0), valueAt(x1, y0), valueAt(x0, y1), valueAt(x1, y1)];
    if (values.some(v => v === null)) return null;
    const dx = x - x0, dy = y - y0;
    value = values[0] * (1 - dx) * (1 - dy) + values[1] * dx * (1 - dy) +
      values[2] * (1 - dx) * dy + values[3] * dx * dy;
  } else value = valueAt(Math.floor(px), Math.floor(py));
  return value === null ? null : value * (valueTransform?.scale ?? 1) + (valueTransform?.offset ?? 0);
}

/** Spherical source projections, in meters; no display geometry is derived here. */
export function scienceMapPoint(longitude, latitude, grid) {
  const radians = Math.PI / 180, radius = grid.referenceRadiusMeters;
  if (grid.projection === 'polar-stereographic') {
    const sign = Math.sign(grid.poleLatitude), angle = (longitude - grid.centerLongitude) * radians;
    const distance = 2 * radius * Math.tan(Math.PI / 4 - sign * latitude * radians / 2);
    return [distance * Math.sin(angle), -sign * distance * Math.cos(angle)];
  }
  if (grid.longitudeRange?.[0] === -180) longitude = ((longitude + 180) % 360 + 360) % 360 - 180;
  const delta = longitude - grid.centerLongitude;
  const wrapped = grid.wrapLongitude ? ((delta + 180) % 360 + 360) % 360 - 180 : delta;
  return [wrapped * radians * radius, latitude * radians * radius];
}

export async function loadScienceSurface(root, lens) {
  if (lens.format === 'pds3-radius-zip') {
    const raster = await loadPdsScalarGrid(resolve(root, lens.path), lens.grid, lens.sampleGrid);
    return { sample(longitude, latitude) {
      if (latitude < -90 || latitude > 90) return null;
      const value = raster.sample(longitude, latitude);
      return value === null ? null : value * (lens.valueTransform?.scale ?? 1) + (lens.valueTransform?.offset ?? 0);
    } };
  }
  if (['wavefront-obj', 'wavefront-obj-zip', 'pds-vertex-facet', 'pds-plate-model'].includes(lens.format)) return loadShapeScalarGrid(root, lens);
  if (lens.additionalGrids?.length) {
    const rasters = await Promise.all([lens, ...lens.additionalGrids].map(entry =>
      loadScienceSurface(root, {...lens, ...entry, additionalGrids: undefined})));
    return { sample(longitude, latitude) {
      for (const raster of rasters) {
        const value = raster.sample(longitude, latitude);
        if (value !== null) return value;
      }
      return null;
    } };
  }
  if (lens.format === 'isis3') {
    const grid = lens.grid;
    const {data, origin, resolution} = await loadIsis3Raster(resolve(root, lens.path), grid);
    return {sample(longitude, latitude) {
      if (latitude < -90 || latitude > 90) return null;
      const [easting, northing] = scienceMapPoint(longitude, latitude, grid);
      return sampleScienceGrid(data, grid, (easting - origin[0]) / resolution[0],
        (northing - origin[1]) / resolution[1], lens);
    }};
  }
  if (lens.format !== 'geotiff') throw new Error(`Unsupported scientific source format: ${lens.format}`);
  const tiff = await fromFile(resolve(root, lens.path));
  try {
    const image = await tiff.getImage(), keys = image.getGeoKeys(), grid = lens.grid;
    const polar = grid.projection === 'polar-stereographic';
    const projectionMatches = polar
      ? keys.ProjCoordTransGeoKey === 15 && keys.ProjNatOriginLatGeoKey === grid.poleLatitude &&
        keys.ProjStraightVertPoleLongGeoKey === grid.centerLongitude && keys.ProjScaleAtNatOriginGeoKey === 1
      : keys.ProjCoordTransGeoKey === 17 && keys.ProjCenterLongGeoKey === grid.centerLongitude;
    if (image.getWidth() !== grid.width || image.getHeight() !== grid.height || !projectionMatches ||
        keys.GeogSemiMajorAxisGeoKey !== grid.referenceRadiusMeters ||
        image.getGDALNoData() !== grid.noData) throw new Error(`Scientific source grid changed: ${lens.path}`);
    const origin = image.getOrigin(), resolution = image.getResolution();
    if (resolution[0] <= 0 || resolution[1] >= 0 || image.getSamplesPerPixel() !== 1 ||
        (grid.origin && (origin[0] !== grid.origin[0] || origin[1] !== grid.origin[1])) ||
        (grid.resolutionMeters && (resolution[0] !== grid.resolutionMeters || resolution[1] !== -grid.resolutionMeters)) ||
        (grid.resolution && (resolution[0] !== grid.resolution[0] || resolution[1] !== grid.resolution[1]))) {
      throw new Error(`Scientific source georeference changed: ${lens.path}`);
    }
    const data = await image.readRasters({ interleave: true });
    return { sample(longitude, latitude) {
      if (latitude < -90 || latitude > 90 || Math.abs(latitude) >= grid.withholdLatitudeDegrees) return null;
      if (grid.latitudeRange && (latitude < grid.latitudeRange[0] || latitude > grid.latitudeRange[1])) return null;
      const [easting, northing] = scienceMapPoint(longitude, latitude, grid);
      const x = (easting - origin[0]) / resolution[0];
      const y = (northing - origin[1]) / resolution[1];
      return sampleScienceGrid(data, grid, x, y, lens);
    } };
  } finally { await tiff.close(); }
}

export function paintScienceSurface(source, lens, width, height) {
  const rgb = Buffer.alloc(width * height * 3), missing = new Uint8Array(width * height);
  const palette = Array.from({ length: 1024 }, (_, i) => colorForValue(lens.minimum + i / 1023 * (lens.maximum - lens.minimum), lens));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const longitude = (x + 0.5) / width * 360, latitude = 90 - (y + 0.5) / height * 180;
    const i = y * width + x, value = source.sample(longitude, latitude);
    if (value === null) { missing[i] = 1; continue; }
    const color = palette[Math.round(Math.max(0, Math.min(1, (value - lens.minimum) / (lens.maximum - lens.minimum))) * 1023)];
    const brightness = lens.relief ? terrainBrightness(source, longitude, latitude, 360 / width, lens.relief) : 1;
    for (let c = 0; c < 3; c++) rgb[i * 3 + c] = Math.min(255, Math.round(color[c] * brightness));
  }
  return { rgb: paintMissingCoverage(rgb, { width, height, channels: 3 }, missing), missing };
}

/** Bilinear observations retain their complete four-sample validity footprint. */
export function sampleColorBand(band, easting, northing) {
  const px = (easting - band.origin[0]) / band.resolution[0] - 0.5;
  const py = (northing - band.origin[1]) / band.resolution[1] - 0.5;
  const x = Math.floor(px), y = Math.floor(py);
  if (x < 0 || y < 0 || x + 1 >= band.width || y + 1 >= band.height) return null;
  const values = [band.data[y * band.width + x], band.data[y * band.width + x + 1],
    band.data[(y + 1) * band.width + x], band.data[(y + 1) * band.width + x + 1]];
  if (values.some(value => !Number.isFinite(value) || value === band.noData || Math.abs(value) > band.specialValueMagnitude)) return null;
  const dx = px - x, dy = py - y;
  return values[0] * (1 - dx) * (1 - dy) + values[1] * dx * (1 - dy) +
    values[2] * (1 - dx) * dy + values[3] * dx * dy;
}

export async function prepareObservedColor({ sourceDirectory, entries, profile, width, height, photometry }) {
  const groups = new Map();
  for (const entry of entries) {
    const file = await fromFile(resolve(sourceDirectory, entry.path));
    try {
      const image = await file.getImage(), keys = image.getGeoKeys();
      const origin = image.getOrigin(), resolution = image.getResolution();
      const band = await image.getGDALMetadata(0);
      if (image.getWidth() !== entry.width || image.getHeight() !== entry.height ||
          image.getSampleFormat(0) !== profile.sampleFormat || image.getSampleByteSize(0) !== profile.sampleBytes || image.getGDALNoData() !== profile.noData ||
          keys.GeogSemiMajorAxisGeoKey !== profile.referenceRadiusMeters || keys.ProjCenterLongGeoKey !== profile.centerLongitude ||
          keys.ProjStdParallel1GeoKey !== profile.standardParallel || resolution[0] <= 0 || resolution[1] >= 0 ||
          Number(band.WAVELENGTH) !== entry.wavelengthMicrometers || band.DESCRIPTION !== entry.filter) {
        throw new Error(`Observed color source mapping or filter changed: ${entry.id}`);
      }
      const [data] = await image.readRasters();
      if (!groups.has(entry.observation)) groups.set(entry.observation, []);
      groups.get(entry.observation).push({ ...entry, data, origin, resolution,
        noData: profile.noData, specialValueMagnitude: profile.specialValueMagnitude,
        ...(photometry?{capture:photometry.geometry.get(entry.id)}:{}) });
      if(photometry&&(!photometry.geometry.has(entry.id)||!Object.hasOwn(photometry.profile.observationWeights,entry.observation)))throw new Error(`Missing pinned observation geometry: ${entry.id}`);
    } finally { await file.close(); }
  }
  const context={groups,profile,width,height,sourceIds:entries.map(entry=>entry.id)};
  return photometry?composeCorrectedColor({...context,photometryProfile:photometry.profile,sampleColorBand}):composeObservedColor(context);
}

/** Highest native density owns a pixel only when every authored channel exists. */
export function composeObservedColor({ groups, profile, width, height, sourceIds = [] }) {
  const rgb = Buffer.alloc(width * height * 3), missing = new Uint8Array(width * height).fill(1), coverage = {};
  const ordered = [...groups].sort((a, b) => a[1][0].resolution[0] - b[1][0].resolution[0]);
  for (const [observation, bands] of ordered) {
    const channels = profile.filters.map(filter => bands.filter(band => band.filter === filter));
    if (channels.some(channel => !channel.length)) throw new Error(`Incomplete color observation: ${observation}`);
    let pixels = 0, solidAngle = 0;
    for (let y = 0; y < height; y++) {
      const latitude = (90 - (y + 0.5) * 180 / height) * Math.PI / 180;
      const northing = latitude * profile.referenceRadiusMeters;
      for (let x = 0; x < width; x++) {
        const index = y * width + x;
        if (!missing[index]) continue;
        const easting = ((x + 0.5) * 360 / width - profile.centerLongitude) * Math.PI / 180 * profile.referenceRadiusMeters;
        const values = channels.map(channel => {
          for (const band of channel) {
            const value = sampleColorBand(band, easting, northing);
            if (value !== null) return value;
          }
          return null;
        });
        if (values.some(value => value === null)) continue;
        missing[index] = 0; pixels++; solidAngle += Math.cos(latitude);
        for (let c = 0; c < 3; c++) rgb[index * 3 + c] = Math.round(255 * Math.min(1, Math.max(0, values[c])) ** (1 / profile.gamma));
      }
    }
    coverage[observation] = { pixels, surfacePercent: solidAngle / (width * height * 2 / Math.PI) * 100 };
  }
  return { rgb, missing, coverage, sourceIds };
}
