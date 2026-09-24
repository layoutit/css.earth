import { open } from 'node:fs/promises';
import { resolve } from 'node:path';
import { number, object, parse, string } from '@cssearth/core/schema';
import { pds3Keyword } from '../pds-labels.mts';

const profileSchema = object({ productId: string, productVersion: string, wavelengthNanometers: number,
  gain: number, gamma: number, referenceRadiusMeters: number, outputLongitudeOrigin: number });
export function parsePdsFloatProfile(value: unknown) {
  const profile = parse(value, profileSchema, 'mapped LROC photograph');
  if (profile.gamma <= 0 || profile.gain <= 0 || profile.referenceRadiusMeters <= 0 || profile.wavelengthNanometers <= 0)
    throw new TypeError('Invalid PDS display transform or reference surface.');
  return profile;
}

/** Attached PDS3 float maps. The producer's offsets locate the centre of pixel (1,1),
 * so zero-based x=(longitude-centre)*ppd+sampleOffset, y=lineOffset-latitude*ppd.
 * This reader accepts only the documented unrotated spherical equirectangular frame. */
export function parsePdsFloatLabel(label: string, expected: { productId: string; productVersion: string; wavelengthNanometers: number }, radiusMeters: number) {
  const field = (key: string) => {
    const value = pds3Keyword(label, key);
    if (value === undefined) throw new TypeError(`PDS label is missing ${key}.`);
    return value;
  };
  const num = (key: string) => { const n = Number.parseFloat(field(key)); if (!Number.isFinite(n)) throw new TypeError(`Invalid PDS ${key}.`); return n; };
  const width = num('LINE_SAMPLES'), height = num('LINES'), recordBytes = num('RECORD_BYTES');
  const offset = (num('^IMAGE') - 1) * recordBytes, totalBytes = num('FILE_RECORDS') * recordBytes;
  const ppd = num('MAP_RESOLUTION'), sampleOffset = num('SAMPLE_PROJECTION_OFFSET'), lineOffset = num('LINE_PROJECTION_OFFSET');
  const centerLongitude = num('CENTER_LONGITUDE'), west = num('WESTERNMOST_LONGITUDE'), east = num('EASTERNMOST_LONGITUDE');
  const south = num('MINIMUM_LATITUDE'), north = num('MAXIMUM_LATITUDE');
  const specialBits = ['CORE_NULL', 'CORE_LOW_REPR_SATURATION', 'CORE_LOW_INSTR_SATURATION', 'CORE_HIGH_REPR_SATURATION', 'CORE_HIGH_INSTR_SATURATION'].map(key => {
    const match = field(key).match(/^16#([A-F0-9]{8})#$/); if (!match) throw new TypeError(`Unsupported PDS ${key}.`); return Number.parseInt(match[1], 16);
  });
  if (field('TARGET_NAME') !== 'MOON' || field('INSTRUMENT_ID') !== 'LROC' || field('INSTRUMENT_HOST_ID') !== 'LRO' ||
      field('PDS_VERSION_ID') !== 'PDS3' || field('DATA_SET_ID') !== 'LRO-L-LROC-5-RDR-V1.0' ||
      field('PRODUCT_ID') !== expected.productId || field('PRODUCT_VERSION_ID') !== expected.productVersion || num('FILTER_NAME') !== expected.wavelengthNanometers ||
      field('RECORD_TYPE') !== 'FIXED_LENGTH' || field('SAMPLE_TYPE') !== 'PC_REAL' || num('SAMPLE_BITS') !== 32 || num('BANDS') !== 1 ||
      field('MAP_PROJECTION_TYPE') !== 'EQUIRECTANGULAR' || field('POSITIVE_LONGITUDE_DIRECTION') !== 'EAST' ||
      !['PLANETOGRAPHIC', 'PLANETOCENTRIC'].includes(field('PROJECTION_LATITUDE_TYPE')) || num('CENTER_LATITUDE') !== 0 || num('MAP_PROJECTION_ROTATION') !== 0 ||
      ['A_AXIS_RADIUS', 'B_AXIS_RADIUS', 'C_AXIS_RADIUS'].some(key => Math.abs(num(key) * 1000 - radiusMeters) > 0.001) ||
      [width, height, offset, totalBytes].some(v => !Number.isSafeInteger(v) || v <= 0) || ppd <= 0 ||
      offset + width * height * 4 !== totalBytes || !/^END\s*$/m.test(label) || !(west < east && south < north))
    throw new TypeError(`Unsupported or changed PDS photographic map: ${expected.productId}.`);
  return { width, height, offset, totalBytes, ppd, sampleOffset, lineOffset, centerLongitude, west, east, south, north, specialBits };
}

/** Read at most one source row strip at a time. Box integration retains real source detail
 * on downsampling; every contributing source sample must be valid. No gaps are filled.
 * The monochrome display applies only the stated gain/gamma, never an estimated fill. */
export async function preparePdsFloatMap(input: string, value: unknown, width: number, height: number) {
  const profile = parsePdsFloatProfile(value);
  if (![width, height].every(v => Number.isSafeInteger(v) && v > 0) || width !== 2 * height) throw new TypeError('PDS photographic output must be an equirectangular 2:1 grid.');
  const rgb = new Uint8Array(width * height * 3), missing = new Uint8Array(width * height).fill(1);
  const file = await open(resolve(input));
  try {
    const header = Buffer.alloc(65536); await file.read(header, 0, header.length, 0);
    const grid = parsePdsFloatLabel(header.toString('ascii'), profile, profile.referenceRadiusMeters);
    if ((await file.stat()).size !== grid.totalBytes) throw new Error(`PDS file is incomplete: ${input}`);
    const stepX = 360 / width * grid.ppd, stepY = 180 / height * grid.ppd;
    const xs: { x: number; weights: { sample: number; weight: number }[] }[] = [];
    // Integrate intersected pixel squares, whose bounds are centre +/- 0.5.
    const weights = (centre: number, step: number, limit: number) => {
      const a = centre - step / 2, b = centre + step / 2;
      const result: { sample: number; weight: number }[] = [];
      for (let i = Math.floor(a + 0.5); i < Math.ceil(b + 0.5); i++) {
        const weight = Math.min(b, i + 0.5) - Math.max(a, i - 0.5);
        if (weight > 1e-8) result.push({ sample: Math.max(0, Math.min(limit - 1, i)), weight: weight / step });
      }
      return result;
    };
    for (let x = 0; x < width; x++) {
      const longitude = ((profile.outputLongitudeOrigin + (x + 0.5) * 360 / width) % 360 + 360) % 360;
      if (longitude >= grid.west && longitude < grid.east)
        xs.push({ x, weights: weights((longitude - grid.centerLongitude) * grid.ppd + grid.sampleOffset, stepX, grid.width) });
    }
    const strip = Buffer.alloc((Math.ceil(stepY) + 2) * grid.width * 4);
    for (let y = 0; y < height; y++) {
      const latitude = 90 - (y + 0.5) * 180 / height;
      if (latitude < grid.south || latitude >= grid.north) continue;
      const ys = weights(grid.lineOffset - latitude * grid.ppd, stepY, grid.height);
      const first = ys[0].sample, length = (ys[ys.length - 1].sample - first + 1) * grid.width * 4;
      const { bytesRead } = await file.read(strip, 0, length, grid.offset + first * grid.width * 4);
      if (bytesRead !== length) throw new Error(`PDS row strip is incomplete: ${input}`);
      for (const column of xs) {
        let reflectance = 0, valid = true;
        for (const row of ys) for (const pixel of column.weights) {
          const offset = ((row.sample - first) * grid.width + pixel.sample) * 4;
          const sample = strip.readFloatLE(offset);
          if (!Number.isFinite(sample) || sample < 0 || grid.specialBits.includes(strip.readUInt32LE(offset))) valid = false;
          else reflectance += sample * row.weight * pixel.weight;
        }
        if (!valid) continue;
        const index = y * width + column.x;
        const value = Math.round(255 * Math.min(1, (reflectance * profile.gain) ** (1 / profile.gamma)));
        rgb.fill(value, index * 3, index * 3 + 3);
        missing[index] = 0;
      }
    }
  } finally { await file.close(); }
  return { rgb, missing };
}
