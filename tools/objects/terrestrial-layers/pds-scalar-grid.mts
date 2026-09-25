import { isArray } from '@cssearth/core';
import {parseScalarGridProfile} from './source-records.mts';
import { spawn } from 'node:child_process';
import { pds3Keyword } from '@cssearth/telescope';

/** Stream a pinned PDS3 scalar image from a ZIP, retaining a bounded sampling grid.
 * Pixel coordinates use PDS's projection offsets (zero-based after subtracting
 * the one-based sample/line index). Labels are checked against the authored grid.
 */
export async function loadPdsScalarGrid(path: string, value: unknown, { width = 2049, height = 1025 } = {}) {
  const profile=parseScalarGridProfile(value);
  const child = spawn('unzip', ['-p', path, profile.member], { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', data => { stderr += data.toString(); });
  const completion = new Promise<void>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`PDS extraction failed: ${stderr}`)));
  });
  // Attach the rejection immediately while the stdout iterator is consuming.
  completion.catch(() => {});
  const values = new Float64Array(width * height); values.fill(NaN);
  let bytes = Buffer.alloc(0), consumed = 0, metadata: ReturnType<typeof parsePdsScalarLabel> | undefined, nextRow = 0;
  const xIndices: number[] = [], rowIndices: number[] = [];
  try {
    for await (const chunk of child.stdout) {
      bytes = Buffer.concat([bytes, chunk]);
      if (!metadata && bytes.length >= 65536) {
        metadata = parsePdsScalarLabel(bytes.subarray(0, 65536).toString('ascii'), profile);
        for (let x = 0; x < width; x++) xIndices.push(Math.round((x / (width - 1) * 360 - metadata.centerLongitude) * metadata.ppd + metadata.sampleOffset));
        for (let y = 0; y < height; y++) rowIndices.push(Math.round((y / (height - 1) * 180 - 90) * metadata.ppd + metadata.lineOffset));
      }
      if (!metadata) continue;
      while (nextRow < height) {
        const sourceRow = rowIndices[nextRow];
        const rowStart = metadata.offset + sourceRow * metadata.width * 4;
        const rowEnd = rowStart + metadata.width * 4;
        if (rowEnd > consumed + bytes.length) break;
        if (sourceRow >= 0 && sourceRow < metadata.height) {
          for (let x = 0; x < width; x++) {
            const sx = xIndices[x];
            if (sx < 0 || sx >= metadata.width) continue;
            const value = bytes.readFloatBE(rowStart - consumed + sx * 4);
            if (Number.isFinite(value) && value !== metadata.noData && value >= profile.validRange[0] && value <= profile.validRange[1]) values[nextRow * width + x] = value;
          }
        }
        nextRow++;
      }
      const nextNeeded = nextRow < height ? metadata.offset + rowIndices[nextRow] * metadata.width * 4 : consumed + bytes.length;
      const discard = Math.max(0, Math.min(bytes.length, nextNeeded - consumed));
      bytes = bytes.subarray(discard); consumed += discard;
    }
    await completion;
    if (!metadata || nextRow !== height || consumed + bytes.length !== metadata.totalBytes) throw new Error('PDS scalar image is incomplete.');
  } catch (error) { child.kill(); await completion.catch(() => {}); throw error; }
  function sample(longitudeDegrees: number, latitudeDegrees: number) {
    const x = ((longitudeDegrees % 360 + 360) % 360) / 360 * (width - 1);
    const y = Math.max(0, Math.min(height - 1, (90 - latitudeDegrees) / 180 * (height - 1)));
    const x0 = Math.floor(x), x1 = Math.min(width - 1, x0 + 1), y0 = Math.floor(y), y1 = Math.min(height - 1, y0 + 1);
    const v = [values[y0 * width + x0], values[y0 * width + x1], values[y1 * width + x0], values[y1 * width + x1]];
    if (v.some(value => !Number.isFinite(value))) return null;
    const u = x - x0, t = y - y0;
    return (v[0] * (1 - u) + v[1] * u) * (1 - t) + (v[2] * (1 - u) + v[3] * u) * t;
  }
  return { width, height, values, sample, metadata };
}

export function parsePdsScalarLabel(label: string, value: unknown) {
  const profile=parseScalarGridProfile(value);
  const field = (key: string) => pds3Keyword(label, key);
  const num = (key: string) => Number.parseFloat(field(key) ?? "NaN");
  const data = { width: num('LINE_SAMPLES'), height: num('LINES'), ppd: num('MAP_RESOLUTION'),
    centerLongitude: num('CENTER_LONGITUDE'), sampleOffset: num('SAMPLE_PROJECTION_OFFSET'), lineOffset: num('LINE_PROJECTION_OFFSET'),
    offset: (num('^IMAGE') - 1) * num('RECORD_BYTES'), totalBytes: num('FILE_RECORDS') * num('RECORD_BYTES'), noData: num('MISSING_CONSTANT') };
  if (field('PDS_VERSION_ID') !== 'PDS3' || field('SAMPLE_TYPE') !== 'IEEE_REAL' || num('SAMPLE_BITS') !== 32 || num('BANDS') !== 1 ||
      field('COORDINATE_SYSTEM_NAME') !== 'PLANETOCENTRIC' || field('POSITIVE_LONGITUDE_DIRECTION') !== 'EAST' ||
      field('MAP_PROJECTION_TYPE') !== 'SIMPLE_CYLINDRICAL' || num('CENTER_LATITUDE') !== 0 ||
      Object.values(data).some(value => !Number.isFinite(value)) ||
      data.width !== profile.width || data.height !== profile.height || Math.abs(data.ppd - profile.pixelsPerDegree) > 1e-6 ||
      data.offset + data.width * data.height * 4 !== data.totalBytes || data.noData !== profile.noData ||
      !isArray(profile.validRange) || profile.validRange.length !== 2 || !(profile.validRange[0] < profile.validRange[1])) {
    throw new Error('PDS scalar layout or coordinate system differs from the pinned recipe.');
  }
  return data;
}
