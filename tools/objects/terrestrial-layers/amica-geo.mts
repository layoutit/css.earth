import {requireRecord} from '@cssearth/core';
import { gunzipSync } from 'node:zlib';
import { readFitsPrimary } from '@cssearth/fits';
import { pds3Keyword } from '@cssearth/telescope';

const field = (label: string, key: string) => {
  const value = pds3Keyword(label, key);
  if (value === undefined) throw new Error(`Expected one AMICA label field: ${key}`);
  return value;
};
const string = (value: unknown) => typeof value === 'string' ? value.replace(/^'(.*)'$/, '$1').trim() : undefined;

/** Original Gaskell DDR geometry, with the exact detector FITS and preflight
 * flat. DDR band 1 is vertically reversed relative to the FITS array; verify
 * every sample before applying the same reversal to the flat field.
 * Selected paired exposures already subtract bias/dark/smear onboard. */
export function decodeAmicaGeo(compressed: Buffer, label: string, originalBytes: Buffer, flatBytes: Buffer) {
  if (field(label, 'DATA_SET_ID') !== 'HAY-A-AMICA-3-AMICAGEOM-V1.0' ||
      field(label, 'INSTRUMENT_ID') !== 'AMICA' || field(label, 'TARGET_NAME') !== '25143 ITOKAWA' ||
      field(label, 'FILTER_NAME') !== 'V' || field(label, 'SAMPLE_TYPE') !== 'IEEE_REAL' ||
      field(label, 'CORE_NULL') !== '16#F49DC5AE#' || field(label, 'BAND_STORAGE_TYPE') !== 'BAND_SEQUENTIAL' ||
      ['LINES', 'LINE_SAMPLES'].some(key => Number(field(label, key)) !== 1024) ||
      Number(field(label, 'SAMPLE_BITS')) !== 32 || Number(field(label, 'BANDS')) !== 16 ||
      Number(field(label, 'RECORD_BYTES')) !== 4096 || Number(field(label, 'FILE_RECORDS')) !== 16384) {
    throw new Error('Unsupported AMICA Gaskell DDR layout.');
  }
  const original = readFitsPrimary(originalBytes), flat = readFitsPrimary(flatBytes), h = requireRecord(original.header);
  const startTime = field(label, 'START_TIME'), exposure = Number(h.EXP_0);
  if (original.bitpix !== 8 || flat.bitpix !== -32 || [original, flat].some(f => f.width !== 1024 || f.height !== 1024 || f.scale !== 1 || f.zero !== 0) ||
      string(h.TARGET) !== '25143 ITOKAWA' || string(h.OUT_MODE) !== 'LOSSY' || Number(h.QF) !== 0 || Number(h.BINNING) !== 1 ||
      Number(h.NSUBIMG) !== 2 || string(h.SUMDIF_0) !== 'SUM' || string(h.SUMDIF_1) !== 'DIFF' ||
      string(h.FILTER_0) !== 'v' || string(h.FILTER_1) !== 'v' || string(requireRecord(flat.header).FILTER) !== 'v' ||
      !(exposure > 0) || Number(h.EXP_1) !== 1e-6 || Number.parseFloat(field(label, 'EXPOSURE_DURATION')) !== exposure ||
      string(h.UTC_0)?.replace(/\.$/, '') !== startTime ||
      Number(h.START_H) !== 0 || Number(h.START_V) !== 0 || Number(h.LAST_H) !== 1023 || Number(h.LAST_V) !== 1023) {
    throw new Error('AMICA observation does not match the qualified paired-exposure product.');
  }
  const bytes = gunzipSync(compressed), count = 1024 * 1024;
  if (bytes.length !== count * 16 * 4) throw new Error('Truncated AMICA DDR cube.');
  const names = ['IMAGE', 'COORDINATE_X_IMAGE', 'COORDINATE_Y_IMAGE', 'COORDINATE_Z_IMAGE',
    null, null, 'DISTANCE_IMAGE', 'INCIDENCE_ANGLE_IMAGE', 'EMISSION_ANGLE_IMAGE', 'PHASE_ANGLE_IMAGE'];
  const planes: Record<string,Float32Array> = {}, nullValue = Buffer.from('f49dc5ae', 'hex').readFloatBE(), accepted = new Uint8Array(count);
  for (let band = 0; band < names.length; band++) if (names[band]) {
    const name=names[band]!;
    const values = new Float32Array(count), angular = name.includes('ANGLE');
    for (let i = 0; i < count; i++) {
      const value = bytes.readFloatBE((band * count + i) * 4);
      values[i] = value === nullValue ? NaN : angular ? value * Math.PI / 180 : value;
    }
    planes[name] = values;
  }
  let defectiveFlatPixels = 0, clippedPixels = 0;
  for (let i = 0; i < count; i++) {
    const sourceIndex = (1023 - Math.floor(i / 1024)) * 1024 + i % 1024;
    const dn = original.values[sourceIndex], response = flat.values[sourceIndex];
    if (dn !== planes.IMAGE[i]) throw new Error('AMICA DDR image differs from its original FITS companion.');
    if (!(response > 0) || !Number.isFinite(response)) { defectiveFlatPixels++; continue; }
    if (dn === 255) { clippedPixels++; continue; }
    accepted[i] = 1;
    planes.IMAGE[i] = dn / response / exposure;
  }
  const xyz = (i: number) => [planes.COORDINATE_X_IMAGE[i], planes.COORDINATE_Y_IMAGE[i], planes.COORDINATE_Z_IMAGE[i]];
  const valid = (i: number) => Number.isInteger(i) && i >= 0 && i < count && planes.DISTANCE_IMAGE[i] > 0 && xyz(i).every(Number.isFinite);
  return { width: 1024, height: 1024, planes, xyz, valid, acceptPixel: (i: number) => accepted[i] === 1,
    startTime, filter: 'V', shapeModel: 'Gaskell ver128q',
    qualityReport: { matchedOriginalPixels: count, originalArrayOrientation: 'vertical reversal verified pixel for pixel',
      imageQualityFlag: 0, outputMode: 'LOSSY', defectiveFlatPixels, clippedPixels, exposureSeconds: exposure,
      calibration: 'Archived SUM minus near-zero-exposure DIFF removes bias/dark/smear onboard; divide by the original preflight v flat and exposure. Relative detector brightness, not absolute radiance or albedo.',
      limitations: 'Lossy 8-bit image; no pixel-quality plane, stray-light restoration, temporal flat correction or absolute calibration.' } };
}
