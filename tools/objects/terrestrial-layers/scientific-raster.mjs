import { resolve } from 'node:path';
import { fromFile } from 'geotiff';
import { paintMissingCoverage } from '../../../src/platform/prepare-missing-coverage.mjs';
import {composeCorrectedColor} from './photometric-observations.mjs';

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
  const eastSlope = (east - west) / (2 * distance * Math.cos(latitude * Math.PI / 180));
  const northSlope = (north - south) / (2 * distance);
  const [eastLight, northLight, upLight] = relief.lightDirection;
  const illumination = Math.max(0, (-eastLight * eastSlope - northLight * northSlope + upLight)
    / Math.hypot(eastSlope, northSlope, 1));
  return (relief.ambient + (1 - relief.ambient) * illumination)
    / (relief.ambient + (1 - relief.ambient) * upLight);
}

export async function loadScienceSurface(root, lens) {
  if (lens.format !== 'geotiff') throw new Error(`Unsupported scientific source format: ${lens.format}`);
  const tiff = await fromFile(resolve(root, lens.path));
  try {
    const image = await tiff.getImage(), keys = image.getGeoKeys(), grid = lens.grid;
    if (image.getWidth() !== grid.width || image.getHeight() !== grid.height ||
        keys.ProjCenterLongGeoKey !== grid.centerLongitude || keys.GeogSemiMajorAxisGeoKey !== grid.referenceRadiusMeters ||
        image.getGDALNoData() !== grid.noData) throw new Error(`Scientific source grid changed: ${lens.path}`);
    const data = await image.readRasters({ interleave: true });
    return { sample(longitude, latitude) {
      if (Math.abs(latitude) >= grid.withholdLatitudeDegrees) return null;
      const x = Math.min(grid.width - 1, Math.floor(longitude * (grid.width / 360)));
      const y = Math.min(grid.height - 1, Math.floor((90 - latitude) * (grid.height / 180)));
      const value = data[y * grid.width + x];
      return value === grid.noData ? null : value;
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
