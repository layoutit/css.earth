import { sha256 } from '@cssearth/core/node';
import { parseReflectanceCamera, type NumericRaster } from './source-records.mts';
import { field, acceptOsirisQuality } from './osiris-geo.mts';

/** Level-4 resampled reflectance keeps its quality and sigma arrays in the
 * same original PDS file. Pixel origin includes any archived CCD subframe. */
export function decodeOsirisReflectance(bytes: Buffer, cameraSource: unknown, allowLossy: boolean) {
  const camera = parseReflectanceCamera(cameraSource);
  const prefix = bytes.subarray(0, 65536).toString('ascii');
  const records = Number(field(prefix, 'FILE_RECORDS')), labelRecords = Number(field(prefix, 'LABEL_RECORDS'));
  if (field(prefix, 'PDS_VERSION_ID') !== 'PDS3' || Number(field(prefix, 'RECORD_BYTES')) !== 512 ||
      records * 512 !== bytes.length || !Number.isInteger(labelRecords) || labelRecords < 1 || labelRecords > 128) throw new Error('Invalid OSIRIS reflectance record layout.');
  const label = bytes.subarray(0, labelRecords * 512).toString('ascii');
  if (!['OSINAC', 'OSIWAC'].includes(field(label, 'INSTRUMENT_ID') ?? '') ||
      field(label, 'TARGET_NAME') !== camera.target || field(label, 'START_TIME') !== camera.startTime ||
      field(label, 'FILTER_NAME') !== camera.filter || field(label, 'DATA_QUALITY_ID') !== '0000000000000000') throw new Error('OSIRIS camera is not bound to this exact observation.');
  const data: Record<string, NumericRaster> = {}, ranges: number[][] = []; const count = camera.width * camera.height;
  for (const name of ['IMAGE', 'SIGMA_MAP_IMAGE', 'QUALITY_MAP_IMAGE']) {
    const block = (key: string) => field(label, key, [name]), quality = name === 'QUALITY_MAP_IMAGE', stride = quality ? 1 : 4;
    const offset = (Number(field(label, '^' + name)) - 1) * 512, end = offset + count * stride;
    if (Number(block('LINE_SAMPLES')) !== camera.width || Number(block('LINES')) !== camera.height ||
        Number(block('BANDS')) !== 1 || Number(block('SAMPLE_BITS')) !== stride * 8 ||
        Number(block('FIRST_LINE')) !== camera.firstLine || Number(block('FIRST_LINE_SAMPLE')) !== camera.firstSample ||
        block('SAMPLE_TYPE') !== (quality ? 'LSB_UNSIGNED_INTEGER' : 'PC_REAL') ||
        (!quality && block('UNIT') !== '1') || block('SAMPLE_DISPLAY_DIRECTION') !== (field(label, 'INSTRUMENT_ID') === 'OSIWAC' ? 'RIGHT' : 'LEFT') ||
        block('LINE_DISPLAY_DIRECTION') !== 'DOWN' || !Number.isInteger(offset) || offset < label.length || end > bytes.length ||
        ranges.some(([a,b]) => offset < b && end > a)) throw new Error('Unsupported OSIRIS reflectance plane.');
    ranges.push([offset, end]);
    data[name] = quality ? Uint8Array.from(bytes.subarray(offset, end)) : new Float32Array(count);
    if (!quality) for (let i = 0; i < count; i++) data[name][i] = bytes.readFloatLE(offset + i * 4);
  }
  const planes: Record<string, NumericRaster> = { IMAGE: data.IMAGE };
  return { width: camera.width, height: camera.height, planes,
    acceptPixel: (i: number) => acceptOsirisQuality(data.QUALITY_MAP_IMAGE[i], allowLossy) &&
      Number.isFinite(data.IMAGE[i]) && Number.isFinite(data.SIGMA_MAP_IMAGE[i]) && data.SIGMA_MAP_IMAGE[i] >= 0,
    startTime: camera.startTime, filter: camera.filter, camera, isLossyPixel: (i: number) => Boolean(data.QUALITY_MAP_IMAGE[i] & 8),
    qualityReport: { units: 'calibrated reflectance, I/F', pairedSigmaAndQuality: true,
      flagDefinition: 'VALID bit 0 required; optional LOSSY bit 3; reject all other quality flags and nonfinite/negative sigma.',
      outputMode: allowLossy ? 'LOSSY allowed' : 'lossless only',
      geometry: 'Per-pixel full-source mesh intersections from the controlled archived camera; prepared geometry, not archive-supplied XYZ backplanes.' } };
}
