/**
 * A PDS3 simple-cylindrical image of one measured quantity, with an attached or detached label: integers or IEEE/PC
 * reals of 8 to 64 bits, one band chosen from band-sequential storage (Magellan gravity keeps its one-sigma error in the
 * second band). Every cell keeps its archived value; sampling takes the nearest cell centre and nothing is interpolated.
 *
 * PDS3 products disagree about where their cells sit, so the recipe states the first cell's centre and whether the
 * label's extent keywords give cell centres or cell edges; the label must then agree. A missing value comes from the
 * label's MISSING_CONSTANT, or, when the label declares none, from the recipe with the producer's evidence. An optional
 * mask image of the same grid withholds cells the producer flags (TES thermal inertia marks its interpolated cells).
 */
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { pds3Keyword } from '@cssearth/telescope';

const SAMPLE_TYPES = {
  IEEE_REAL: { real: true, little: false }, PC_REAL: { real: true, little: true },
  MSB_INTEGER: { real: false, little: false }, LSB_INTEGER: { real: false, little: true },
  MSB_UNSIGNED_INTEGER: { real: false, little: false, unsigned: true }, LSB_UNSIGNED_INTEGER: { real: false, little: true, unsigned: true },
  UNSIGNED_INTEGER: { real: false, little: false, unsigned: true },
} as const;
type SampleType = keyof typeof SAMPLE_TYPES;

interface GridPolicy {
  width: number; height: number; band: number; pixelsPerDegree: number;
  firstCentreLongitude: number; firstCentreLatitude: number; labelExtent: 'centres' | 'edges';
  datasetId: string; productId?: string; noData: number | null; noDataEvidence?: string;
}

function gridPolicy(value: unknown, label: string): GridPolicy {
  const grid = requireRecord(value, `${label}.grid`);
  const integer = (key: string) => {
    const n = requireFiniteNumber(grid[key], `${label}.grid.${key}`);
    if (!Number.isSafeInteger(n) || n <= 0) throw new TypeError(`${label}.grid.${key} must be a positive integer.`);
    return n;
  };
  const extent = grid.labelExtent;
  if (extent !== 'centres' && extent !== 'edges') throw new TypeError(`${label}.grid.labelExtent must be "centres" or "edges".`);
  const noData = grid.noData === undefined || grid.noData === null ? null : requireFiniteNumber(grid.noData, `${label}.grid.noData`);
  return {
    width: integer('width'), height: integer('height'), band: grid.band === undefined ? 1 : integer('band'),
    pixelsPerDegree: requireFiniteNumber(grid.pixelsPerDegree, `${label}.grid.pixelsPerDegree`),
    firstCentreLongitude: requireFiniteNumber(grid.firstCentreLongitude, `${label}.grid.firstCentreLongitude`),
    firstCentreLatitude: requireFiniteNumber(grid.firstCentreLatitude, `${label}.grid.firstCentreLatitude`),
    labelExtent: extent, datasetId: requireString(grid.datasetId, `${label}.grid.datasetId`),
    ...(grid.productId === undefined ? {} : { productId: requireString(grid.productId, `${label}.grid.productId`) }),
    noData, ...(grid.noDataEvidence === undefined ? {} : { noDataEvidence: requireString(grid.noDataEvidence, `${label}.grid.noDataEvidence`) }),
  };
}

const unquote = (raw: string) => raw.replace(/^"|"$/gu, '').trim();
const numberOf = (raw: string) => Number.parseFloat(raw.replace(/<[^>]*>/gu, ''));

/** Decode one band of a PDS3 image into cell values, NaN where the product records no value. */
export function decodePds3Grid(bytes: Buffer, labelText: string, detachedImage: string | null, policy: GridPolicy, where: string) {
  const field = (key: string) => {
    const raw = pds3Keyword(labelText, key);
    if (raw === undefined) throw new Error(`${where}: PDS3 label has no ${key}.`);
    return unquote(raw);
  };
  const optional = (key: string) => { const raw = pds3Keyword(labelText, key); return raw === undefined ? undefined : unquote(raw); };
  const sampleType = field('SAMPLE_TYPE').replace(/\s+/gu, '_') as SampleType;
  const kind = SAMPLE_TYPES[sampleType];
  const bits = numberOf(field('SAMPLE_BITS')), size = bits / 8;
  const bands = optional('BANDS') === undefined ? 1 : numberOf(field('BANDS'));
  const { width, height, band, pixelsPerDegree: ppd } = policy;
  const half = policy.labelExtent === 'edges' ? 0.5 / ppd : 0;
  const lastCentreLongitude = policy.firstCentreLongitude + (width - 1) / ppd;
  const lastCentreLatitude = policy.firstCentreLatitude - (height - 1) / ppd;
  const close = (a: number, b: number) => Math.abs(a - b) < 1e-6;
  // Attached labels point at a record; a detached label names the image file.
  const pointer = field('^IMAGE');
  const offset = detachedImage === null ? (numberOf(pointer) - 1) * numberOf(field('RECORD_BYTES')) : 0;
  const planeBytes = width * height * size;
  const problems = [
    field('PDS_VERSION_ID') !== 'PDS3' && 'PDS_VERSION_ID',
    field('DATA_SET_ID') !== policy.datasetId && `DATA_SET_ID ${field('DATA_SET_ID')}`,
    policy.productId !== undefined && field('PRODUCT_ID') !== policy.productId && `PRODUCT_ID ${field('PRODUCT_ID')}`,
    !kind && `SAMPLE_TYPE ${sampleType}`,
    (kind?.real ? ![32, 64].includes(bits) : ![8, 16, 32].includes(bits)) && `SAMPLE_BITS ${bits}`,
    numberOf(field('LINES')) !== height && `LINES ${field('LINES')}`,
    numberOf(field('LINE_SAMPLES')) !== width && `LINE_SAMPLES ${field('LINE_SAMPLES')}`,
    !(Number.isSafeInteger(bands) && band <= bands) && `BANDS ${bands} for band ${band}`,
    bands > 1 && field('BAND_STORAGE_TYPE') !== 'BAND SEQUENTIAL' && `BAND_STORAGE_TYPE ${optional('BAND_STORAGE_TYPE')}`,
    !['SIMPLE CYLINDRICAL', 'EQUIRECTANGULAR'].includes(field('MAP_PROJECTION_TYPE')) && `MAP_PROJECTION_TYPE ${field('MAP_PROJECTION_TYPE')}`,
    field('POSITIVE_LONGITUDE_DIRECTION').toUpperCase() !== 'EAST' && 'POSITIVE_LONGITUDE_DIRECTION',
    numberOf(field('MAP_RESOLUTION')) !== ppd && `MAP_RESOLUTION ${field('MAP_RESOLUTION')}`,
    !close(numberOf(field('WESTERNMOST_LONGITUDE')), policy.firstCentreLongitude - half) && `WESTERNMOST_LONGITUDE ${field('WESTERNMOST_LONGITUDE')}`,
    !close(numberOf(field('EASTERNMOST_LONGITUDE')), lastCentreLongitude + half) && `EASTERNMOST_LONGITUDE ${field('EASTERNMOST_LONGITUDE')}`,
    !close(numberOf(field('MAXIMUM_LATITUDE')), policy.firstCentreLatitude + half) && `MAXIMUM_LATITUDE ${field('MAXIMUM_LATITUDE')}`,
    !close(numberOf(field('MINIMUM_LATITUDE')), lastCentreLatitude - half) && `MINIMUM_LATITUDE ${field('MINIMUM_LATITUDE')}`,
    detachedImage !== null && basename(pointer).toUpperCase() !== detachedImage.toUpperCase() && `^IMAGE ${pointer}`,
    !(Number.isSafeInteger(offset) && offset >= 0 && offset + bands * planeBytes <= bytes.length) && `data length ${bytes.length} for offset ${offset}`,
  ].filter(Boolean);
  const declaredMissing = optional('MISSING_CONSTANT') ?? optional('MISSING');
  if (declaredMissing !== undefined && numberOf(declaredMissing) !== policy.noData) problems.push(`MISSING_CONSTANT ${declaredMissing} but recipe noData ${policy.noData}`);
  if (declaredMissing === undefined && policy.noData !== null && !policy.noDataEvidence) problems.push('recipe noData without noDataEvidence while the label declares none');
  if (problems.length) throw new Error(`${where}: PDS3 grid differs from its recipe: ${problems.join('; ')}.`);
  const scale = optional('SCALING_FACTOR') === undefined ? 1 : numberOf(field('SCALING_FACTOR'));
  const add = optional('OFFSET') === undefined ? 0 : numberOf(field('OFFSET'));
  const start = offset + (band - 1) * planeBytes;
  const values = new Float64Array(width * height);
  const read = (at: number) => {
    if (kind!.real) return bits === 64 ? (kind!.little ? bytes.readDoubleLE(at) : bytes.readDoubleBE(at)) : (kind!.little ? bytes.readFloatLE(at) : bytes.readFloatBE(at));
    const unsigned = 'unsigned' in kind! && kind!.unsigned;
    if (bits === 8) return unsigned ? bytes.readUInt8(at) : bytes.readInt8(at);
    if (bits === 16) return unsigned ? (kind!.little ? bytes.readUInt16LE(at) : bytes.readUInt16BE(at)) : (kind!.little ? bytes.readInt16LE(at) : bytes.readInt16BE(at));
    return unsigned ? (kind!.little ? bytes.readUInt32LE(at) : bytes.readUInt32BE(at)) : (kind!.little ? bytes.readInt32LE(at) : bytes.readInt32BE(at));
  };
  for (let i = 0; i < values.length; i++) {
    const raw = read(start + i * size);
    values[i] = !Number.isFinite(raw) || raw === policy.noData ? NaN : raw * scale + add;
  }
  return { values, width, height };
}

/** The attached label from PDS_VERSION_ID to its END line, without an SFDU wrapper line or the image bytes after it. */
function attachedLabel(bytes: Buffer, where: string) {
  const head = bytes.subarray(0, Math.min(bytes.length, 65536)).toString('latin1');
  const start = head.indexOf('PDS_VERSION_ID'), end = head.slice(Math.max(0, start)).search(/^END\s*$/mu);
  if (start < 0 || end < 0) throw new Error(`${where}: no attached PDS3 label.`);
  return head.slice(start, start + end) + 'END\n';
}

/** Parse the lens and decode its band (and mask), for preparation and for tests. */
export async function loadPds3Grid(root: string, value: unknown) {
  const lens = requireRecord(value, 'pds3-grid lens');
  // The scientific block has no id of its own; its file (and band) names it in every error.
  const path = requireString(lens.path, 'pds3-grid lens path'), band = requireRecord(lens.grid, `${path} grid`).band;
  const id = band === undefined ? path : `${path} band ${String(band)}`;
  const policy = gridPolicy(lens.grid, id);
  if (lens.sampling !== undefined && lens.sampling !== 'nearest') throw new TypeError(`${id}: pds3-grid cells require nearest sampling.`);
  const readGrid = async (path: string, labelPath: unknown, gridValue: GridPolicy, where: string) => {
    const bytes = await readFile(resolve(root, path));
    const detached = labelPath === undefined ? null : basename(path);
    const labelText = labelPath === undefined ? attachedLabel(bytes, where)
      : await readFile(resolve(root, requireString(labelPath, `${where}.labelPath`)), 'latin1');
    return decodePds3Grid(bytes, labelText, detached, gridValue, where);
  };
  const grid = await readGrid(path, lens.labelPath, policy, id);
  let withheld = 0;
  if (lens.mask !== undefined) {
    // The mask shares the value grid; its own sample type and missing value come from its label.
    const mask = requireRecord(lens.mask, `${id}.mask`);
    const flagged = mask.withholdWhere;
    if (!Array.isArray(flagged) || !flagged.length || !flagged.every(Number.isFinite)) throw new TypeError(`${id}.mask.withholdWhere must list mask values.`);
    requireString(mask.evidence, `${id}.mask.evidence`);
    const maskGrid = await readGrid(requireString(mask.path, `${id}.mask.path`), mask.labelPath,
      { ...policy, band: 1, productId: undefined, noData: null, noDataEvidence: undefined, ...(mask.productId === undefined ? {} : { productId: requireString(mask.productId, `${id}.mask.productId`) }) } as GridPolicy, `${id}.mask`);
    for (let i = 0; i < grid.values.length; i++) {
      if (flagged.includes(maskGrid.values[i]) && Number.isFinite(grid.values[i])) { grid.values[i] = NaN; withheld += 1; }
    }
  }
  const { width, height, values } = grid, ppd = policy.pixelsPerDegree;
  const global = Math.abs(width / ppd - 360) < 1e-9;
  let mapped = 0, lowest = Infinity, highest = -Infinity;
  for (const v of values) if (Number.isFinite(v)) { mapped += 1; if (v < lowest) lowest = v; if (v > highest) highest = v; }
  return {
    report: { format: 'pds3-grid', width, height, band: policy.band, mappedCells: mapped, missingCells: values.length - mapped,
      withheldByMask: withheld, valueRange: mapped ? [lowest, highest] : null, sampling: 'nearest-cell' },
    sample(longitude: number, latitude: number) {
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
      let x = Math.round((longitude - policy.firstCentreLongitude) * ppd);
      if (global) x = ((x % width) + width) % width;
      const y = Math.round((policy.firstCentreLatitude - latitude) * ppd);
      if (x < 0 || x >= width || y < 0 || y >= height) return null;
      const v = values[y * width + x]!;
      if (!Number.isFinite(v)) return null;
      const transform = lens.valueTransform === undefined ? null : requireRecord(lens.valueTransform, `${id}.valueTransform`);
      return transform ? v * requireFiniteNumber(transform.scale, `${id}.valueTransform.scale`) + requireFiniteNumber(transform.offset, `${id}.valueTransform.offset`) : v;
    },
  };
}

/** Files the lens reads besides its image, so preparation can require each to be declared in the manifest. */
export function pds3GridDependencies(value: unknown) {
  const lens = requireRecord(value);
  const mask = lens.mask === undefined ? null : requireRecord(lens.mask);
  return [lens.labelPath, mask?.path, mask?.labelPath].filter((path): path is string => typeof path === 'string');
}
