import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { fromFile } from 'geotiff';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { blackFillCoverage } from '../../../src/platform/prepare-missing-coverage.mts';
import { readFitsPrimary } from '../observation/fits.mts';
import { numericRaster, numericRasterBands, parseByteObservationPolicy, parseFitsPolicy, parseFloatObservationPolicy,
  parseGeoImageEntry, parseIsisObservationPolicy, parseMaskedObservationPolicy, requireWrappedLongitudeSpan } from './source-records.mts';
import { loadScienceSurface } from './scientific-raster.mts';

export interface NativePhotograph {
  width: number;
  height: number;
  sample(longitudeDegrees: number, latitudeDegrees: number, color: number[]): boolean;
}

type SourceRaster = {
  width: number;
  height: number;
  channels: number;
  pixels: ArrayLike<number>;
  wrapLongitude: boolean;
  point(longitudeDegrees: number, latitudeDegrees: number): readonly [number, number];
  valid(offset: number, x: number, y: number): boolean;
  low: number;
  high: number;
};

const modulo = (value: number, divisor: number) => ((value % divisor) + divisor) % divisor;
const finiteDimensions = (source: Record<string, unknown>) => {
  const width = requireFiniteNumber(source.width), height = requireFiniteNumber(source.height);
  if (![width, height].every(value => Number.isSafeInteger(value) && value > 1)) throw new TypeError('Invalid native photograph dimensions.');
  return {width, height};
};

async function pinnedPath(sourceDirectory: string, sourceValue: unknown) {
  const source = requireRecord(sourceValue), path = resolve(sourceDirectory, requireString(source.path));
  // The manifest owns the photograph's identity; the recipe names it.
  await access(path);
  return {source, path, ...finiteDimensions(source)};
}

function cylindricalSourcePoint(longitude: number, latitude: number, centerLongitude: number, origin: readonly number[], resolution: readonly number[],
  referenceRadiusMeters: number, geographic: boolean, width: number) {
  const degreesToUnits = geographic ? 1 : referenceRadiusMeters * Math.PI / 180;
  const middleLongitude = geographic
    ? origin[0] + width * resolution[0] / 2
    : centerLongitude + (origin[0] + width * resolution[0] / 2) / degreesToUnits;
  const equivalentLongitude = longitude + 360 * Math.round((middleLongitude - longitude) / 360);
  const x = geographic ? equivalentLongitude : (equivalentLongitude - centerLongitude) * degreesToUnits;
  const y = geographic ? latitude : latitude * degreesToUnits;
  return [(x - origin[0]) / resolution[0] - .5, (y - origin[1]) / resolution[1] - .5] as const;
}

function makeSampler(raster: SourceRaster): NativePhotograph {
  if (!(raster.high > raster.low)) throw new TypeError('Invalid photographic display range.');
  const tolerance = 32 * Number.EPSILON * Math.max(raster.width, raster.height);
  const stable = (value: number) => Math.abs(value - Math.round(value)) <= tolerance ? Math.round(value) : value;
  return {
    width: raster.width,
    height: raster.height,
    sample(longitudeDegrees, latitudeDegrees, color) {
      if (!Number.isFinite(longitudeDegrees) || !Number.isFinite(latitudeDegrees) || latitudeDegrees < -90 || latitudeDegrees > 90) return false;
      const [rawX, rawY] = raster.point(longitudeDegrees, latitudeDegrees);
      if (!Number.isFinite(rawX) || !Number.isFinite(rawY)) return false;
      const px = stable(rawX), py = stable(rawY);
      const x0 = Math.floor(px), y0 = Math.floor(py), tx = px - x0, ty = py - y0;
      color[0] = color[1] = color[2] = 0;
      for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
        const weight = (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty);
        if (weight === 0) continue;
        const x = raster.wrapLongitude ? modulo(x0 + dx, raster.width) : x0 + dx, y = y0 + dy;
        if (x < 0 || x >= raster.width || y < 0 || y >= raster.height) return false;
        const offset = (y * raster.width + x) * raster.channels;
        if (!raster.valid(offset, x, y)) return false;
        for (let channel = 0; channel < 3; channel++) color[channel] += raster.pixels[offset + (raster.channels === 1 ? 0 : channel)] * weight;
      }
      for (let channel = 0; channel < 3; channel++) color[channel] = 255 * Math.max(0, Math.min(1, (color[channel] - raster.low) / (raster.high - raster.low)));
      return true;
    }
  };
}

function requireCylindricalFrame(source: Record<string, unknown>, centerLongitude: number) {
  const projection = requireRecord(source.projection);
  const direction = projection.longitudeDirection;
  if (!['equirectangular', 'simple-cylindrical'].includes(String(projection.type ?? projection.kind)) ||
      !['east-positive', 'east'].includes(String(direction)) ||
      (projection.latitudeType !== undefined && projection.latitudeType !== 'planetocentric') ||
      (projection.centerLongitude !== undefined && projection.centerLongitude !== centerLongitude)) {
    throw new Error('Native photographs require their published planetocentric, positive-east cylindrical frame.');
  }
}

async function loadGeoTiff(source: Record<string, unknown>, path: string, width: number, height: number, validityValue: unknown): Promise<NativePhotograph> {
  const validity = requireRecord(validityValue), kind = requireString(validity.kind);
  if (!['geotiff-byte-monochrome', 'geotiff-float-monochrome', 'geotiff-rgb-alpha', 'geotiff-monochrome-alpha'].includes(kind)) {
    throw new TypeError(`Unsupported native photographic source: ${kind}`);
  }
  const entry = parseGeoImageEntry(source), file = await fromFile(path);
  try {
    const image = await file.getImage(), keys = image.getGeoKeys(), origin = image.getOrigin(), resolution = image.getResolution();
    if (!keys || image.getWidth() !== width || image.getHeight() !== height || keys.GTRasterTypeGeoKey !== 1 ||
        ![...origin, ...resolution].every(Number.isFinite) || resolution[0] <= 0 || resolution[1] >= 0) {
      throw new Error(`Native photograph grid mismatch: ${path}`);
    }
    if (['geotiff-rgb-alpha', 'geotiff-monochrome-alpha'].includes(kind)) {
      const policy = parseMaskedObservationPolicy(kind === 'geotiff-monochrome-alpha'
        ? {...validity, channels:'monochrome', zeroValidity:validity.zeroValidity ?? 'all-channels'} : validity);
      const channels = policy.channels === 'rgb' ? 3 : 1;
      requireCylindricalFrame(source, policy.centerLongitude);
      // The declared Sharp color conversion may expand a monochrome source to RGB
      // (Io normal). Validate the delivered channel count after that same conversion.
      if (image.getSamplesPerPixel() < 1 || image.getSamplesPerPixel() > 4 || image.getGDALNoData() !== policy.noData ||
          keys.ProjCoordTransGeoKey !== 17 || keys.ProjCenterLongGeoKey !== policy.centerLongitude ||
          keys.ProjStdParallel1GeoKey !== 0 || keys.ProjCenterLatGeoKey !== 0 || keys.GeogSemiMajorAxisGeoKey !== entry.projection.referenceRadiusMeters ||
          keys.GeogSemiMinorAxisGeoKey !== entry.projection.referenceRadiusMeters ||
          (policy.resolutionMeters !== undefined && (resolution[0] !== policy.resolutionMeters || resolution[1] !== -policy.resolutionMeters))) {
        throw new Error(`Native photograph grid mismatch: ${path}`);
      }
      const pipeline = sharp(path).removeAlpha();
      if (policy.channels === 'monochrome') pipeline.greyscale();
      if (policy.colorSpace !== undefined) pipeline.toColourspace(policy.colorSpace);
      const decoded = await pipeline.raw().toBuffer({resolveWithObject: true}), pixels = decoded.data;
      if (decoded.info.width !== width || decoded.info.height !== height || decoded.info.channels !== channels) {
        throw new Error(`Native photograph bands changed: ${path}`);
      }
      const anyChannel = policy.zeroValidity === 'any-channel', wrapLongitude = policy.wrapLongitude === true;
      if (wrapLongitude) requireWrappedLongitudeSpan(width, resolution[0], entry.projection.referenceRadiusMeters * Math.PI / 180);
      return makeSampler({width, height, channels, pixels, wrapLongitude, low: 0, high: 255,
        point: (longitude, latitude) => cylindricalSourcePoint(longitude, latitude, policy.centerLongitude, origin, resolution,
          entry.projection.referenceRadiusMeters, false, width),
        valid: (offset, x, y) => {
          let allNoData = policy.noData !== null;
          for (let channel = 0; channel < channels; channel++) {
            const value = pixels[offset + channel];
            if (!Number.isFinite(value) || (anyChannel && value === policy.noData)) return false;
            allNoData &&= value === policy.noData;
          }
          if (allNoData) return false;
          const longitude = policy.centerLongitude + (origin[0] + (x + .5) * resolution[0]) / entry.projection.referenceRadiusMeters * 180 / Math.PI;
          const latitude = (origin[1] + (y + .5) * resolution[1]) / entry.projection.referenceRadiusMeters * 180 / Math.PI;
          return (policy.withholdLatitudeDegrees === undefined || Math.abs(latitude) < policy.withholdLatitudeDegrees) &&
            (policy.withholdLongitudeDegrees === undefined || longitude < policy.withholdLongitudeDegrees[0] || longitude > policy.withholdLongitudeDegrees[1]);
        }});
    }
    const policy = parseFloatObservationPolicy(validity), geographic = policy.coordinates === 'degrees';
    requireCylindricalFrame(source, policy.centerLongitude);
    const sampleFormat = kind === 'geotiff-byte-monochrome' ? 1 : 3;
    const sampleBytes = kind === 'geotiff-byte-monochrome' ? 1 : policy.sampleBytes ?? 4;
    const expectedResolution = geographic ? policy.resolutionDegrees : policy.resolutionMeters;
    const geographicKeys = keys.GTModelTypeGeoKey === 2 && keys.GeogAngularUnitsGeoKey === 9102;
    const projectedKeys = keys.ProjCoordTransGeoKey === 17 && keys.ProjCenterLongGeoKey === policy.centerLongitude &&
      keys.ProjStdParallel1GeoKey === 0 && keys.ProjCenterLatGeoKey === 0;
    if (policy.kind !== kind || image.getSamplesPerPixel() !== 1 || image.getSampleFormat(0) !== sampleFormat || image.getSampleByteSize(0) !== sampleBytes ||
        image.getGDALNoData() !== policy.noData || (geographic ? !geographicKeys : !projectedKeys) ||
        keys.GeogSemiMajorAxisGeoKey !== entry.projection.referenceRadiusMeters ||
        (geographic ? keys.GeogSemiMinorAxisGeoKey !== undefined && keys.GeogSemiMinorAxisGeoKey !== entry.projection.referenceRadiusMeters :
          keys.GeogSemiMinorAxisGeoKey !== entry.projection.referenceRadiusMeters) ||
        origin[0] !== policy.origin[0] || origin[1] !== policy.origin[1] || resolution[0] !== expectedResolution || resolution[1] !== -expectedResolution) {
      throw new Error(`Native photograph grid mismatch: ${path}`);
    }
    const [pixels] = numericRasterBands(await image.readRasters());
    const special = policy.specialValueMagnitude ?? Infinity, [low, high] = policy.displayRange;
    return makeSampler({width, height, channels: 1, pixels, wrapLongitude: false, low, high,
      point: (longitude, latitude) => cylindricalSourcePoint(longitude, latitude, policy.centerLongitude, origin, resolution,
        entry.projection.referenceRadiusMeters, geographic, width),
      valid: offset => Number.isFinite(pixels[offset]) && pixels[offset] !== policy.noData && Math.abs(pixels[offset]) <= special});
  } finally { await file.close(); }
}

async function loadImage(source: Record<string, unknown>, path: string, width: number, height: number, validityValue: unknown): Promise<NativePhotograph> {
  const policy = parseByteObservationPolicy(validityValue), kind = policy.kind;
  if (!['image-monochrome-no-data', 'image-rgb-no-data'].includes(String(kind))) throw new TypeError(`Unsupported native photographic source: ${String(kind)}`);
  requireCylindricalFrame(source, policy.centerLongitude);
  const metadata = await sharp(path, {limitInputPixels: false}).metadata();
  if (metadata.width !== width || metadata.height !== height || metadata.depth !== 'uchar' || metadata.hasAlpha || !['b-w', 'srgb'].includes(String(metadata.space)) ||
      (kind === 'image-monochrome-no-data' && metadata.space !== 'b-w')) throw new Error(`Native photograph dimensions changed: ${path}`);
  const pixels = await sharp(path, {limitInputPixels: false}).toColourspace('srgb').raw().toBuffer();
  const fillRange = policy.connectedFillRange;
  if (fillRange !== undefined && (!policy.connectedEdge || fillRange.length !== 2 || !fillRange.every(value => Number.isInteger(value) && value >= 0 && value <= 255) ||
      fillRange[0] > fillRange[1] || policy.noData === null || policy.noData < fillRange[0] || policy.noData > fillRange[1])) throw new Error('Invalid connected source-fill range.');
  if (policy.connectedEdge !== undefined && (!['north', 'south'].includes(policy.connectedEdge) || (policy.noData !== 0 && fillRange === undefined))) {
    throw new Error('Connected coverage requires a north/south edge and a declared fill.');
  }
  let fillMask: Uint8Array | null = null;
  if (fillRange) {
    fillMask = new Uint8Array(width * height);
    for (let index = 0; index < fillMask.length; index++) {
      const offset = index * 3;
      const low = fillRange[0], high = fillRange[1];
      fillMask[index] = pixels[offset] >= low && pixels[offset] <= high && pixels[offset + 1] >= low && pixels[offset + 1] <= high && pixels[offset + 2] >= low && pixels[offset + 2] <= high ? 0 : 255;
    }
  }
  const connected = policy.connectedEdge === undefined ? null : blackFillCoverage(fillMask ?? pixels,
    {width, height, channels: fillMask ? 1 : 3}, {northConnected: policy.connectedEdge === 'north', southConnected: policy.connectedEdge === 'south'});
  const valid = (offset: number) => {
    const index = offset / 3;
    if (connected) return !connected[index];
    if (policy.noData === null) return true;
    for (let channel = 0; channel < 3; channel++) if (pixels[offset + channel] !== policy.noData) return true;
    return false;
  };
  if (policy.grid) {
    if (policy.noData !== 0) throw new TypeError('Projected native photographs require exact black no-data.');
    const {pixelsPerDegree, sampleOffset, lineOffset} = policy.grid;
    if (![pixelsPerDegree, sampleOffset, lineOffset].every(Number.isFinite) || pixelsPerDegree <= 0) throw new TypeError('Invalid projected native photograph grid.');
    return makeSampler({width, height, channels: 3, pixels, wrapLongitude: false, low: 0, high: 255,
      point: (longitude, latitude) => {
        const middleLongitude = policy.centerLongitude + (width / 2 - sampleOffset) / pixelsPerDegree;
        const equivalentLongitude = longitude + 360 * Math.round((middleLongitude - longitude) / 360);
        return [(equivalentLongitude - policy.centerLongitude) * pixelsPerDegree + sampleOffset, -latitude * pixelsPerDegree + lineOffset];
      }, valid});
  }
  return makeSampler({width, height, channels: 3, pixels, wrapLongitude: true, low: 0, high: 255,
    point: (longitude, latitude) => [modulo(longitude - policy.centerLongitude + 180, 360) / 360 * width - .5,
      Math.max(0, Math.min(height - 1, (90 - latitude) / 180 * height - .5))], valid});
}

async function loadSouthConnectedBlackImage(source: Record<string, unknown>, path: string, width: number, height: number, validityValue: unknown): Promise<NativePhotograph> {
  if (requireString(requireRecord(validityValue).kind) !== 'south-connected-black') throw new TypeError('Invalid south-connected photographic policy.');
  const projection = requireRecord(source.projection), longitudeDegrees = requireArray(projection.longitudeDegrees), latitudeDegrees = requireArray(projection.latitudeDegrees);
  if (projection.type !== 'equirectangular' || projection.longitudeDirection !== 'east-positive' ||
      longitudeDegrees.length !== 2 || longitudeDegrees[0] !== 0 || longitudeDegrees[1] !== 360 ||
      latitudeDegrees.length !== 2 || latitudeDegrees[0] !== 90 || latitudeDegrees[1] !== -90) {
    throw new Error('South-connected photographs require their published 0–360 east-positive cylindrical frame.');
  }
  const metadata = await sharp(path, {limitInputPixels: false}).metadata();
  if (metadata.width !== width || metadata.height !== height || metadata.depth !== 'uchar') throw new Error(`Native photograph dimensions changed: ${path}`);
  const decoded = await sharp(path, {limitInputPixels: false}).removeAlpha().raw().toBuffer({resolveWithObject: true}), pixels = decoded.data;
  if (decoded.info.width !== width || decoded.info.height !== height || ![1, 3].includes(decoded.info.channels)) throw new Error(`Native photograph bands changed: ${path}`);
  const missing = blackFillCoverage(pixels, {width, height, channels: decoded.info.channels}, {southConnected: true});
  return makeSampler({width, height, channels: decoded.info.channels, pixels, wrapLongitude: true, low: 0, high: 255,
    point: (longitude, latitude) => [modulo(longitude, 360) / 360 * width - .5,
      Math.max(0, Math.min(height - 1, (90 - latitude) / 180 * height - .5))],
    valid: (_offset, x, y) => missing[y * width + x] === 0});
}

async function loadFits(source: Record<string, unknown>, path: string, width: number, height: number, validityValue: unknown): Promise<NativePhotograph> {
  const policy = parseFitsPolicy(validityValue);
  if (requireString(requireRecord(validityValue).kind) !== 'fits-byte-monochrome' || policy.bitpix !== 8 ||
      !['east', 'west'].includes(policy.longitudeDirection) || !['south-to-north', 'north-to-south'].includes(policy.rowOrder) ||
      !Number.isFinite(policy.centerLongitude) || policy.centerLongitude < 0 || policy.centerLongitude > 360 ||
      !Number.isInteger(policy.noData) || policy.noData < 0 || policy.noData > 255 || policy.displayRange.length !== 2 ||
      !policy.displayRange.every(Number.isFinite) || policy.displayRange[0] >= policy.displayRange[1]) throw new TypeError('Invalid FITS observation mapping or validity.');
  const fits = readFitsPrimary(await readFile(path));
  if (fits.bitpix !== policy.bitpix || fits.width !== width || fits.height !== height || width !== height * 2 || fits.scale !== 1 || fits.zero !== 0) {
    throw new Error('FITS observation grid changed.');
  }
  return makeSampler({width, height, channels: 1, pixels: fits.values, wrapLongitude: true, low: policy.displayRange[0], high: policy.displayRange[1],
    point: (longitude, latitude) => [modulo(longitude * (policy.longitudeDirection === 'west' ? -1 : 1) - policy.centerLongitude + 180, 360) / 360 * width - .5,
      Math.max(0, Math.min(height - 1, (.5 + (policy.rowOrder === 'south-to-north' ? latitude : -latitude) / 180) * height - .5))],
    valid: offset => Number.isFinite(fits.values[offset]) && fits.values[offset] !== policy.noData});
}

async function loadIsis3Photograph(sourceDirectory: string, source: Record<string, unknown>, width: number, height: number, validityValue: unknown): Promise<NativePhotograph> {
  const validity = requireRecord(validityValue), policy = parseIsisObservationPolicy(validity);
  if (requireString(validity.kind) !== 'isis3-float-monochrome' || width !== policy.grid.width || height !== policy.grid.height) {
    throw new Error('ISIS3 native photograph dimensions changed.');
  }
  const [low, high] = policy.displayRange;
  if (!Number.isFinite(low) || !Number.isFinite(high) || !(high > low)) throw new TypeError('Invalid ISIS3 photographic display range.');
  const raster = await loadScienceSurface(sourceDirectory, {path: requireString(source.path), format: 'isis3', grid: policy.grid, sampling: 'bilinear'});
  return {
    width,
    height,
    sample(longitudeDegrees, latitudeDegrees, color) {
      if (!Number.isFinite(longitudeDegrees) || !Number.isFinite(latitudeDegrees) || latitudeDegrees < -90 || latitudeDegrees > 90) return false;
      const value = raster.sample(longitudeDegrees, latitudeDegrees);
      if (value === null || !Number.isFinite(value)) return false;
      const gray = 255 * Math.max(0, Math.min(1, (value - low) / (high - low)));
      color[0] = color[1] = color[2] = gray;
      return true;
    }
  };
}

/** Decode a pinned observation chosen by the caller as photographic terrain.
 * This preserves its published grid and missing-data policy; it never derives registration.
 */
export async function loadNativePhotograph(sourceDirectory: string, sourceValue: unknown, validityValue: unknown): Promise<NativePhotograph> {
  const {source, path, width, height} = await pinnedPath(sourceDirectory, sourceValue);
  const kind = requireString(requireRecord(validityValue).kind);
  if (['geotiff-byte-monochrome', 'geotiff-float-monochrome', 'geotiff-rgb-alpha', 'geotiff-monochrome-alpha'].includes(kind)) return loadGeoTiff(source, path, width, height, validityValue);
  if (['image-monochrome-no-data', 'image-rgb-no-data'].includes(kind)) return loadImage(source, path, width, height, validityValue);
  if (kind === 'south-connected-black') return loadSouthConnectedBlackImage(source, path, width, height, validityValue);
  if (kind === 'fits-byte-monochrome') return loadFits(source, path, width, height, validityValue);
  if (kind === 'isis3-float-monochrome') return loadIsis3Photograph(sourceDirectory, source, width, height, validityValue);
  throw new TypeError(`Unsupported native photographic source: ${kind}`);
}
