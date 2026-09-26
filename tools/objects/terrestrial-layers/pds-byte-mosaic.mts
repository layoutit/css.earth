import {parseBytePolicy,parseImageEntry} from './source-records.mts';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import sharp from 'sharp';
import { pds3Keyword } from '@cssearth/telescope';
import { blackFillCoverage } from '@cssearth/bake/raster';

// PDS3 byte images carry their projection and validity in the attached label.
// This reader deliberately supports only unrotated, planetocentric cylindrical grids.
export function decodePdsByteImage(bytes: Buffer, value: unknown = {}) {
  const policy = parseBytePolicy(value);
  const label = bytes.subarray(0, 65536).toString('ascii');
  const field = (key: string) => {
    const value = pds3Keyword(label, key);
    if (value === undefined) throw new Error(`Missing PDS field: ${key}`);
    return value;
  };
  const number = (key: string) => {
    const value = Number.parseFloat(field(key));
    if (!Number.isFinite(value)) throw new Error(`Invalid PDS number: ${key}`);
    return value;
  };
  const width = number('LINE_SAMPLES'), height = number('LINES');
  const recordBytes = number('RECORD_BYTES'), pointer = number('^IMAGE');
  const offset = (pointer - 1) * recordBytes;
  const ppd = number('MAP_RESOLUTION'), radiusKm = number('A_AXIS_RADIUS');
  const westPositive = field('POSITIVE_LONGITUDE_DIRECTION') === 'WEST';
  const centerEast = westPositive ? 360 - number('CENTER_LONGITUDE') : number('CENTER_LONGITUDE');
  const left = centerEast * ppd - number('SAMPLE_PROJECTION_OFFSET') - 0.5;
  const top = 90 * ppd - number('LINE_PROJECTION_OFFSET') - 0.5;
  const noData = policy.noData ?? number('MISSING_CONSTANT');
  const labelEnd = label.search(/^END\s*$/m);
  if (field('PDS_VERSION_ID') !== 'PDS3' || field('RECORD_TYPE') !== 'FIXED_LENGTH' ||
      field('SAMPLE_TYPE') !== 'UNSIGNED_INTEGER' || number('SAMPLE_BITS') !== 8 ||
      !['EQUIRECTANGULAR', 'SIMPLE CYLINDRICAL'].includes(field('MAP_PROJECTION_TYPE')) || number('CENTER_LATITUDE') !== 0 ||
      number('MAP_PROJECTION_ROTATION') !== 0 ||
      !['WEST', 'EAST'].includes(field('POSITIVE_LONGITUDE_DIRECTION')) ||
      number('B_AXIS_RADIUS') !== radiusKm || number('C_AXIS_RADIUS') !== radiusKm ||
      [width, height, recordBytes, pointer, ppd].some(value => !Number.isSafeInteger(value) || value <= 0) ||
      !Number.isInteger(noData) || noData < 0 || noData > 255 ||
      !Number.isInteger(left) || !Number.isInteger(top) || top < 0 || top + height > 180 * ppd ||
      width > 360 * ppd || labelEnd < 0 || offset < labelEnd + 3 ||
      offset + width * height !== bytes.length || number('FILE_RECORDS') * recordBytes !== bytes.length) {
    throw new Error('Unsupported PDS byte image layout or projection.');
  }
  return { pixels: bytes.subarray(offset), width, height, ppd, radiusKm, noData,
    left: ((left % (360 * ppd)) + 360 * ppd) % (360 * ppd), top };
}

export async function preparePdsByteMosaic(sourceDirectory: string, sourceEntries: readonly unknown[], width: number, height: number, value: unknown = {}) {
  const entries=sourceEntries.map(parseImageEntry),policy=parseBytePolicy(value);
  let mosaic, grid;
  for (const entry of entries) {
    const bytes = await readFile(resolve(sourceDirectory, entry.path));
    const tile = decodePdsByteImage(bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes, policy);
    if (tile.width !== entry.width || tile.height !== entry.height ||
        tile.radiusKm * 1000 !== entry.projection.referenceRadiusMeters) throw new Error(`PDS source grid changed: ${entry.id}`);
    if (!grid) {
      grid = { width: 360 * tile.ppd, height: 180 * tile.ppd, ppd: tile.ppd, radiusKm: tile.radiusKm };
      mosaic = Buffer.alloc(grid.width * grid.height * 2);
    }
    if (grid.ppd !== tile.ppd || grid.radiusKm !== tile.radiusKm) throw new Error('PDS mosaic tiles must share one source grid.');
    const connected = policy.connectedEdge ? blackFillCoverage(tile.pixels, { width: tile.width, height: tile.height, channels: 1 },
      { northConnected: policy.connectedEdge === 'north', southConnected: policy.connectedEdge === 'south' }) : null;
    for (let y = 0; y < tile.height; y++) for (let x = 0; x < tile.width; x++) {
      const value = tile.pixels[y * tile.width + x];
      if (connected ? connected[y * tile.width + x] : value === tile.noData) continue;
      const i = ((y + tile.top) * grid.width + (x + tile.left) % grid.width) * 2;
      if (!mosaic) throw new Error("Missing mosaic storage");
      if (mosaic[i + 1]) throw new Error('PDS mosaic has overlapping observations without a composition rule.');
      mosaic[i] = value;
      mosaic[i + 1] = 255;
    }
  }
  if (!grid || !mosaic) throw new Error('PDS mosaic has no pinned tiles.');
  const data = await sharp(mosaic, { raw: { width: grid.width, height: grid.height, channels: 2 } })
    .resize(width, height, { fit: 'fill', kernel: 'lanczos3' }).toColourspace('srgb').raw().toBuffer();
  const rgb = Buffer.alloc(width * height * 3), missing = new Uint8Array(width * height);
  for (let i = 0; i < missing.length; i++) {
    rgb.set(data.subarray(i * 4, i * 4 + 3), i * 3);
    missing[i] = data[i * 4 + 3] < 255 ? 1 : 0;
  }
  return { rgb, missing, grid };
}
