import {parseGeoImageEntry,parsePdsRgbPolicy} from './source-records.mts';
import {text} from '@cssearth/core';
import { spawn } from 'node:child_process';
import { prepareProjectedByteObservation } from './observed-image.mts';
import { pds3Keyword } from '../pds-labels.mts';

/** Decode an attached PDS3 RGB image without treating its three BSQ planes as gray.
 * ZIP extraction streams into one RGB buffer; projection and masking remain shared.
 */
export function parsePdsRgbLabel(label: string, sourceEntry: unknown, value: unknown) {
  const entry=parseGeoImageEntry(sourceEntry),policy=parsePdsRgbPolicy(value);
  const field = (key: string) => pds3Keyword(label, key);
  const num = (key: string) => Number.parseFloat(field(key)??"NaN");
  const width = num('LINE_SAMPLES'), height = num('LINES');
  const recordBytes = num('RECORD_BYTES'), pointer = num('^IMAGE');
  const offset = (pointer - 1) * recordBytes, totalBytes = num('FILE_RECORDS') * recordBytes;
  const end = label.search(/^END\s*$/m);
  if (field('PDS_VERSION_ID') !== 'PDS3' || field('RECORD_TYPE') !== 'FIXED_LENGTH' ||
      field('SAMPLE_TYPE') !== 'UNSIGNED_INTEGER' || num('SAMPLE_BITS') !== 8 || num('BANDS') !== 3 ||
      field('BAND_STORAGE_TYPE') !== 'BAND_SEQUENTIAL' || field('TARGET_NAME') !== policy.targetName ||
      field('MAP_PROJECTION_TYPE') !== 'SIMPLE_CYLINDRICAL' || field('COORDINATE_SYSTEM_NAME') !== 'PLANETOCENTRIC' ||
      field('POSITIVE_LONGITUDE_DIRECTION') !== 'EAST' || num('CENTER_LATITUDE') !== 0 ||
      num('CENTER_LONGITUDE') !== policy.centerLongitude || num('MAP_RESOLUTION') !== policy.grid.pixelsPerDegree ||
      num('SAMPLE_PROJECTION_OFFSET') !== policy.grid.sampleOffset || num('LINE_PROJECTION_OFFSET') !== policy.grid.lineOffset ||
      ['A_AXIS_RADIUS', 'B_AXIS_RADIUS', 'C_AXIS_RADIUS'].some(key => num(key) * 1000 !== entry.projection.referenceRadiusMeters) ||
      width !== entry.width || height !== entry.height ||
      [width, height, recordBytes, pointer, totalBytes].some(n => !Number.isSafeInteger(n) || n <= 0) ||
      end < 0 || offset < end + 3 || offset + width * height * 3 !== totalBytes) {
    throw new Error('PDS RGB image encoding or source grid changed.');
  }
  return { width, height, offset, totalBytes };
}

export async function preparePdsRgbObservation(path: string, sourceEntry: unknown, value: unknown, width: number, height: number) {
  const entry=parseGeoImageEntry(sourceEntry),policy=parsePdsRgbPolicy(value);
  const child = spawn('unzip', ['-p', path, text(policy.member)], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', data => { stderr += data; });
  const completion = new Promise<void>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`PDS RGB extraction failed: ${stderr}`)));
  });
  completion.catch(() => {});
  let header: Buffer | undefined = Buffer.alloc(0), consumed = 0, metadata: ReturnType<typeof parsePdsRgbLabel> | undefined, rgb: Buffer | undefined;
  try {
    for await (let chunk of child.stdout) {
      if (!metadata) {
        header = Buffer.concat([header ?? Buffer.alloc(0), chunk]);
        if (header.length < 65536) continue;
        metadata = parsePdsRgbLabel(header.subarray(0, 65536).toString('ascii'), entry, policy);
        rgb = Buffer.alloc(metadata.width * metadata.height * 3);
        chunk = header;
      }
      if(!rgb)throw new Error("Missing PDS RGB storage");
      const count = metadata.width * metadata.height;
      for (let j = Math.max(0, metadata.offset - consumed); j < chunk.length; j++) {
        const index = consumed + j - metadata.offset;
        if (index >= count * 3) throw new Error('PDS RGB image has trailing data.');
        rgb[(index % count) * 3 + Math.floor(index / count)] = chunk[j];
      }
      consumed += chunk.length;
      header = undefined;
    }
    await completion;
    if (!metadata || !rgb || consumed !== metadata.totalBytes) throw new Error('PDS RGB image is incomplete.');
  } catch (error) { child.kill(); await completion.catch(() => {}); throw error; }
  return prepareProjectedByteObservation(rgb, entry, policy, width, height,
    { raw: { width: entry.width, height: entry.height, channels: 3 } });
}
