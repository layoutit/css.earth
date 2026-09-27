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

/** Ishiguro et al. (2010), table 9: conversion from each AMICA band to
 * reflectivity relative to v. The factors are applied after flat-field and
 * exposure normalization, before bands are combined or displayed. */
export const AMICA_REFLECTIVITY_SCALE = { B: 1.254, V: 1, W: .645 } as const;
type AmicaFilter = keyof typeof AMICA_REFLECTIVITY_SCALE;

/** Original Gaskell DDR geometry, with the exact detector FITS and preflight
 * flat. DDR band 1 is vertically reversed relative to the FITS array; verify
 * every sample before applying the same reversal to the flat field.
 * Selected paired exposures already subtract bias/dark/smear onboard. */
export function decodeAmicaGeo(compressed: Buffer, label: string, originalBytes: Buffer, flatBytes: Buffer) {
  const width = Number(field(label, 'LINE_SAMPLES')), height = Number(field(label, 'LINES')),
    filter = String(field(label, 'FILTER_NAME')).toUpperCase() as AmicaFilter;
  if (field(label, 'DATA_SET_ID') !== 'HAY-A-AMICA-3-AMICAGEOM-V1.0' ||
      field(label, 'INSTRUMENT_ID') !== 'AMICA' || field(label, 'TARGET_NAME') !== '25143 ITOKAWA' ||
      !Object.hasOwn(AMICA_REFLECTIVITY_SCALE, filter) || field(label, 'SAMPLE_TYPE') !== 'IEEE_REAL' ||
      field(label, 'CORE_NULL') !== '16#F49DC5AE#' || field(label, 'BAND_STORAGE_TYPE') !== 'BAND_SEQUENTIAL' ||
      width !== height || ![512, 1024].includes(width) ||
      Number(field(label, 'SAMPLE_BITS')) !== 32 || Number(field(label, 'BANDS')) !== 16 ||
      Number(field(label, 'RECORD_BYTES')) !== width * 4 || Number(field(label, 'FILE_RECORDS')) !== height * 16) {
    throw new Error('Unsupported AMICA Gaskell DDR layout.');
  }
  const original = readFitsPrimary(originalBytes), flat = readFitsPrimary(flatBytes), h = requireRecord(original.header);
  const startTime = field(label, 'START_TIME'), exposure = Number(h.EXP_0), outputMode = string(h.OUT_MODE),
    startH = Number(h.START_H), startV = Number(h.START_V), detectorWidth = flat.width;
  if (!['LOSSY', 'LOSS-LESS'].includes(outputMode ?? '') || original.bitpix !== (outputMode === 'LOSSY' ? 8 : 16) ||
      flat.bitpix !== -32 || original.width !== width || original.height !== height || flat.width !== 1024 || flat.height !== 1024 ||
      [original, flat].some(f => f.scale !== 1 || f.zero !== 0) ||
      string(h.TARGET) !== '25143 ITOKAWA' || Number(h.QF) !== 0 || Number(h.BINNING) !== 1 ||
      Number(h.NSUBIMG) !== 2 || string(h.SUMDIF_0) !== 'SUM' || string(h.SUMDIF_1) !== 'DIFF' ||
      string(h.FILTER_0)?.toUpperCase() !== filter || string(h.FILTER_1)?.toUpperCase() !== filter ||
      string(requireRecord(flat.header).FILTER)?.toUpperCase() !== filter ||
      !(exposure > 0) || Number(h.EXP_1) !== 1e-6 || Number.parseFloat(field(label, 'EXPOSURE_DURATION')) !== exposure ||
      string(h.UTC_0)?.replace(/\.$/, '') !== startTime ||
      !Number.isInteger(startH) || !Number.isInteger(startV) || startH < 0 || startV < 0 ||
      Number(h.LAST_H) !== startH + width - 1 || Number(h.LAST_V) !== startV + height - 1 ||
      startH + width > flat.width || startV + height > flat.height) {
    throw new Error('AMICA observation does not match the qualified paired-exposure product.');
  }
  const bytes = gunzipSync(compressed), count = width * height;
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
  let defectiveFlatPixels = 0, clippedPixels = 0, nonlinearPixels = 0;
  for (let i = 0; i < count; i++) {
    const x = i % width, sourceY = height - 1 - Math.floor(i / width), sourceIndex = sourceY * width + x,
      flatIndex = (startV + sourceY) * detectorWidth + startH + x;
    const dn = original.values[sourceIndex], response = flat.values[flatIndex];
    if (dn !== planes.IMAGE[i]) throw new Error('AMICA DDR image differs from its original FITS companion.');
    if (!(response > 0) || !Number.isFinite(response)) { defectiveFlatPixels++; continue; }
    if (outputMode === 'LOSSY' && dn === 255) { clippedPixels++; continue; }
    if (outputMode === 'LOSS-LESS' && dn >= 3800) { nonlinearPixels++; continue; }
    accepted[i] = 1;
    planes.IMAGE[i] = dn / response / exposure * AMICA_REFLECTIVITY_SCALE[filter];
  }
  const xyz = (i: number) => [planes.COORDINATE_X_IMAGE[i], planes.COORDINATE_Y_IMAGE[i], planes.COORDINATE_Z_IMAGE[i]];
  const valid = (i: number) => Number.isInteger(i) && i >= 0 && i < count && planes.DISTANCE_IMAGE[i] > 0 && xyz(i).every(Number.isFinite);
  return { width, height, planes, xyz, valid, acceptPixel: (i: number) => accepted[i] === 1,
    startTime, filter, shapeModel: 'Gaskell ver128q',
    qualityReport: { matchedOriginalPixels: count, originalArrayOrientation: 'vertical reversal verified pixel for pixel',
      detectorWindow: { startH, startV, width, height }, imageQualityFlag: 0, outputMode, defectiveFlatPixels, clippedPixels, nonlinearPixels,
      exposureSeconds: exposure, reflectivityScaleRelativeToV: AMICA_REFLECTIVITY_SCALE[filter],
      calibration: `Archived SUM minus near-zero-exposure DIFF removes bias/dark/smear onboard; divide by the original preflight ${filter.toLowerCase()} flat and exposure, then apply the published ${filter}-to-V reflectivity factor.`,
      limitations: `${outputMode === 'LOSSY' ? 'Lossy 8-bit image; ' : ''}No pixel-quality plane, scattered-light restoration, temporal flat correction or absolute reflectance calibration.` } };
}
