import {parseFitsPolicy,parseDimensions} from './source-records.mts';
import { readFile } from 'node:fs/promises';
import { readFitsPrimary } from '@cssearth/fits';

export function validateFitsObservationPolicy(value: unknown) {
  const policy=parseFitsPolicy(value);
  if (policy.bitpix !== 8 || !['east', 'west'].includes(policy.longitudeDirection) ||
      !['south-to-north', 'north-to-south'].includes(policy.rowOrder) ||
      !Number.isFinite(policy.centerLongitude) || policy.centerLongitude < 0 || policy.centerLongitude > 360 ||
      !Number.isInteger(policy.noData) || policy.noData < 0 || policy.noData > 255 ||
      !Array.isArray(policy.displayRange) || policy.displayRange.length !== 2 ||
      !policy.displayRange.every(Number.isFinite) || !(policy.displayRange[0] < policy.displayRange[1])) {
    throw new TypeError('Invalid FITS observation mapping or validity.');
  }
  return policy;
}

/** Map source-documented global cylindrical FITS mosaics. Missing observations
 * invalidate the complete bilinear footprint, before the display stretch. */
export async function prepareFitsObservation(path: string, entry: unknown, policy: unknown, width: number, height: number) {
  return mapFitsObservation(readFitsPrimary(await readFile(path)), entry, policy, width, height);
}

export function mapFitsObservation(fits: ReturnType<typeof readFitsPrimary>, sourceEntry: unknown, value: unknown, width: number, height: number) {
  const entry=parseDimensions(sourceEntry),policy=validateFitsObservationPolicy(value);
  if (fits.bitpix !== policy.bitpix || fits.width !== entry.width || fits.height !== entry.height ||
      fits.width !== fits.height * 2 || fits.scale !== 1 || fits.zero !== 0) throw new Error('FITS observation grid changed.');
  const rgb = Buffer.alloc(width * height * 3), missing = new Uint8Array(width * height);
  const modulo = (n: number, d: number) => ((n % d) + d) % d, [low, high] = policy.displayRange;
  for (let y = 0; y < height; y++) {
    const latitude = 90 - (y + .5) * 180 / height;
    const sy = Math.max(0, Math.min(fits.height - 1,
      (.5 + (policy.rowOrder === 'south-to-north' ? latitude : -latitude) / 180) * fits.height - .5));
    const y0 = Math.floor(sy), y1 = Math.min(y0 + 1, fits.height - 1), dy = sy - y0;
    for (let x = 0; x < width; x++) {
      const longitude = (x + .5) * 360 / width * (policy.longitudeDirection === 'west' ? -1 : 1);
      const sx = modulo(longitude - policy.centerLongitude + 180, 360) / 360 * fits.width - .5;
      const x0 = modulo(Math.floor(sx), fits.width), x1 = (x0 + 1) % fits.width, dx = sx - Math.floor(sx);
      const four = [fits.values[y0 * fits.width + x0], fits.values[y0 * fits.width + x1],
        fits.values[y1 * fits.width + x0], fits.values[y1 * fits.width + x1]], i = y * width + x;
      if (four.some(value => !Number.isFinite(value) || value === policy.noData)) { missing[i] = 1; continue; }
      const value = four[0] * (1 - dx) * (1 - dy) + four[1] * dx * (1 - dy) +
        four[2] * (1 - dx) * dy + four[3] * dx * dy;
      const gray = Math.round(255 * Math.max(0, Math.min(1, (value - low) / (high - low))));
      rgb.fill(gray, i * 3, i * 3 + 3);
    }
  }
  return { rgb, missing, sourceMissingPixels: fits.values.reduce((count, v) => count + Number(v === policy.noData), 0),
    sourceGeoreference: { centerLongitude: policy.centerLongitude, longitudeDirection: policy.longitudeDirection,
      rowOrder: policy.rowOrder, pixelsPerDegree: fits.width / 360 } };
}
