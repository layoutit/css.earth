import type {GeoFrame,GeoSample,DiskPhotometry,PhasePhotometry} from './contracts.mts';
import { diskGain as diskFunctionGain, minnaertExponent, NORMAL_GEOMETRY } from '../../photometry/disk.mts';
import { phaseGain as phaseFunctionGain } from '../../photometry/phase.mts';
// Preparation-only decoder and measured camera for the corrected OSIRIS GEO
// product. No image coordinates, ray tracing or source geometry enter runtime.
export const GEO_SHAPE_MODEL = 'cg-dlr_spg-shap7-v1.0_4Mfacets.ver';
export const PLANE_NAMES = ['IMAGE', 'DISTANCE_IMAGE', 'EMISSION_ANGLE_IMAGE',
  'INCIDENCE_ANGLE_IMAGE', 'PHASE_ANGLE_IMAGE', 'FACET_INDEX_IMAGE',
  'COORDINATE_X_IMAGE', 'COORDINATE_Y_IMAGE', 'COORDINATE_Z_IMAGE'];

export const field = (text: string, name: string) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const hits = [...text.matchAll(new RegExp(`^\\s*${escaped}[ \\t]*=[ \\t]*(?:\\r?\\n[ \\t]*)?("[^"\\r\\n]*"|[^\\r\\n]+)`, 'gm'))];
  if (hits.length !== 1) throw new Error(`Expected one PDS field: ${name}`);
  return hits[0][1].trim().replace(/^"(.*)"$/, '$1');
};

export function imageBlock(label: string, name: string) {
  const matches = [...label.matchAll(new RegExp(`^OBJECT\\s*=\\s*${name}\\s*\\r?\\n([\\s\\S]*?)^END_OBJECT\\s*=\\s*${name}\\s*$`, 'gm'))];
  if (matches.length !== 1) throw new Error(`Missing or duplicate IMAGE object: ${name}`);
  return matches[0][1];
}

export function decodeOsirisGeo(bytes: Buffer) {
  const prefix = bytes.subarray(0, Math.min(bytes.length, 65536)).toString('ascii');
  const recordBytes = Number(field(prefix, 'RECORD_BYTES'));
  const records = Number(field(prefix, 'FILE_RECORDS'));
  const labelRecords = Number(field(prefix, 'LABEL_RECORDS'));
  if (field(prefix, 'PDS_VERSION_ID') !== 'PDS3' || field(prefix, 'RECORD_TYPE') !== 'FIXED_LENGTH' ||
      recordBytes !== 512 || !Number.isSafeInteger(records) || records * recordBytes !== bytes.length ||
      !Number.isSafeInteger(labelRecords) || labelRecords < 1 || labelRecords * recordBytes > 65536) {
    throw new Error('Unsupported or truncated OSIRIS record layout.');
  }
  const label = bytes.subarray(0, labelRecords * recordBytes).toString('ascii');
  const firstImage = (Number(field(label, '^IMAGE')) - 1) * recordBytes;
  if (firstImage < label.length || firstImage > 65536) throw new Error('Invalid image pointer.');
  const history = bytes.subarray(label.length, firstImage).toString('ascii');
  if (field(history, 'GEO_SHAPE_MODEL') !== GEO_SHAPE_MODEL) throw new Error('Archive errata reject this GEO shape model.');
  if (field(label, 'INSTRUMENT_ID') !== 'OSINAC') throw new Error('Expected OSIRIS NAC.');
  const planes: Record<string,Float32Array|Int32Array> = {}, ranges: [number,number][] = [];
  let planeWidth: number | undefined, planeHeight: number | undefined;
  for (const name of PLANE_NAMES) {
    const matches = [...label.matchAll(new RegExp(`^OBJECT\\s*=\\s*${name}\\s*\\r?\\n([\\s\\S]*?)^END_OBJECT\\s*=\\s*${name}\\s*$`, 'gm'))];
    if (matches.length !== 1) throw new Error(`Missing or duplicate IMAGE object: ${name}`);
    const block = matches[0][1], w = Number(field(block, 'LINE_SAMPLES')), h = Number(field(block, 'LINES'));
    if (!Number.isSafeInteger(w) || !Number.isSafeInteger(h) || w < 2 || h < 2 || w > 4096 || h > 4096 ||
        (planeWidth !== undefined && (w !== planeWidth || h !== planeHeight)) || Number(field(block, 'SAMPLE_BITS')) !== 32 ||
        field(block, 'SAMPLE_TYPE') !== (name === 'FACET_INDEX_IMAGE' ? 'LSB_INTEGER' : 'PC_REAL') ||
        Number(field(block, 'BANDS')) !== 1 || Number(field(block, 'FIRST_LINE')) !== 1 || Number(field(block, 'FIRST_LINE_SAMPLE')) !== 1 ||
        field(block, 'LINE_DISPLAY_DIRECTION') !== 'DOWN' || field(block, 'SAMPLE_DISPLAY_DIRECTION') !== 'LEFT' ||
        field(block, 'UNIT') !== (name === 'IMAGE' ? 'W/M**2/SR/NM' : name === 'FACET_INDEX_IMAGE' ? 'INTEGER' : name.includes('ANGLE') ? 'RAD' : 'KM')) {
      throw new Error(`Unsupported plane layout: ${name}`);
    }
    planeWidth = w; planeHeight = h;
    const start = (Number(field(label, `^${name}`)) - 1) * recordBytes, end = start + w * h * 4;
    if (!Number.isSafeInteger(start) || start < firstImage || end > bytes.length ||
        ranges.some(([a, b]) => start < b && end > a)) throw new Error(`Invalid plane pointer: ${name}`);
    ranges.push([start, end]);
    const values = name === 'FACET_INDEX_IMAGE' ? new Int32Array(w * h) : new Float32Array(w * h);
    for (let i = 0; i < values.length; i++) values[i] = name === 'FACET_INDEX_IMAGE'
      ? bytes.readInt32LE(start + i * 4) : bytes.readFloatLE(start + i * 4);
    planes[name] = values;
  }
  if (planeWidth === undefined || planeHeight === undefined) throw new Error('Missing OSIRIS image dimensions.');
  const width = planeWidth, height = planeHeight;
  const xyz = (i: number) => ['X', 'Y', 'Z'].map(axis => planes[`COORDINATE_${axis}_IMAGE`][i]);
  // This is a geometry-backed footprint, not a detector-quality mask. Keep
  // finite zero/negative radiance. L5 has no accompanying L3/L4 quality plane.
  const valid = (i: number) => Number.isInteger(i) && i >= 0 && i < width * height &&
    planes.DISTANCE_IMAGE[i] > 0 && planes.FACET_INDEX_IMAGE[i] > 0 && xyz(i).every(Number.isFinite) &&
    Number.isFinite(planes.IMAGE[i]);
  return { width, height, planes, xyz, valid, label, history, startTime: field(label, 'START_TIME'),
    filter: field(label, 'FILTER_NAME'), shapeModel: GEO_SHAPE_MODEL };
}

/** The quality byte's VALID bit is positive polarity (bit 0). Flag 0 is not
 * valid; flag 9 means VALID plus LOSSY. The pipeline manual's bit table is
 * decisive here; the science guide's generic "all zero" prose is ambiguous. */
export function acceptOsirisQuality(flag: number, allowLossy: boolean) {
  return Number.isInteger(flag) && flag >= 0 && flag <= 255 && (flag & 1) === 1 &&
    (flag & ~(allowLossy ? 9 : 1)) === 0;
}

export function decodeOsirisQuality(bytes: Buffer, geo: Pick<GeoFrame,"width"|"height"|"planes"> & {label:string}) {
  const prefix = bytes.subarray(0, 65536).toString('ascii');
  const recordBytes = Number(field(prefix, 'RECORD_BYTES')), labelRecords = Number(field(prefix, 'LABEL_RECORDS'));
  if (field(prefix, 'PDS_VERSION_ID') !== 'PDS3' || field(prefix, 'RECORD_TYPE') !== 'FIXED_LENGTH' || recordBytes !== 512 ||
      !Number.isSafeInteger(labelRecords) || labelRecords < 1 || labelRecords * recordBytes > 65536 ||
      Number(field(prefix, 'FILE_RECORDS')) * recordBytes !== bytes.length) throw new Error('Invalid OSIRIS quality file layout.');
  const label = bytes.subarray(0, labelRecords * recordBytes).toString('ascii');
  for (const name of ['IMAGE_ID', 'START_TIME', 'FILTER_NAME', 'INSTRUMENT_ID', 'SOFTWARE_VERSION_ID']) {
    if (field(label, name) !== field(geo.label, name)) throw new Error(`Quality companion identity mismatch: ${name}`);
  }
  if (field(label, 'DATA_QUALITY_ID') !== '0000000000000000') throw new Error('Unqualified image-wide OSIRIS quality flags.');
  const ranges: [number,number][] = [], data: Record<string,Buffer> = {};
  for (const name of ['IMAGE', 'SIGMA_MAP_IMAGE', 'QUALITY_MAP_IMAGE']) {
    const block = imageBlock(label, name), quality = name === 'QUALITY_MAP_IMAGE', stride = quality ? 1 : 4;
    const start = (Number(field(label, `^${name}`)) - 1) * recordBytes, end = start + geo.width * geo.height * stride;
    if (Number(field(block, 'LINE_SAMPLES')) !== geo.width || Number(field(block, 'LINES')) !== geo.height ||
        Number(field(block, 'BANDS')) !== 1 || Number(field(block, 'FIRST_LINE')) !== 1 || Number(field(block, 'FIRST_LINE_SAMPLE')) !== 1 ||
        field(block, 'LINE_DISPLAY_DIRECTION') !== 'DOWN' || field(block, 'SAMPLE_DISPLAY_DIRECTION') !== 'LEFT' ||
        Number(field(block, 'SAMPLE_BITS')) !== stride * 8 || field(block, 'SAMPLE_TYPE') !== (quality ? 'LSB_UNSIGNED_INTEGER' : 'PC_REAL') ||
        (!quality && field(block, 'UNIT') !== 'W/M**2/SR/NM') || !Number.isSafeInteger(start) || start < label.length || end > bytes.length ||
        ranges.some(([a, b]) => start < b && end > a)) throw new Error(`Invalid quality companion plane: ${name}`);
    ranges.push([start, end]); data[name] = bytes.subarray(start, end);
  }
  let finiteSigma = 0;
  for (let i = 0; i < geo.planes.IMAGE.length; i++) {
    if (data.IMAGE.readFloatLE(i * 4) !== geo.planes.IMAGE[i]) throw new Error('Quality companion radiance differs from GEO image.');
    if (Number.isFinite(data.SIGMA_MAP_IMAGE.readFloatLE(i * 4))) finiteSigma++;
  }
  const flags = Uint8Array.from(data.QUALITY_MAP_IMAGE), histogram: Record<number,number> = {};
  for (const flag of flags) histogram[flag] = (histogram[flag] ?? 0) + 1;
  return { flags, report: { matchedRadiancePixels: flags.length, finiteSigmaPixels: finiteSigma, histogram,
    definition: 'Bit 0 VALID required; bit 3 LOSSY explicitly permitted for visual use; all other flags rejected.' } };
}

export function lommelSeeligerGain(incidence: number, emission: number, policy: DiskPhotometry) {
  if (![incidence, emission].every(Number.isFinite) || incidence < 0 || emission < 0 ||
      incidence > policy.maximumIncidenceDegrees * Math.PI / 180 || emission > policy.maximumEmissionDegrees * Math.PI / 180) return null;
  const mu0 = Math.cos(incidence), mu = Math.cos(emission);
  if (!(mu0 > 0) || !(mu > 0)) return null;
  const gain = diskFunctionGain({ family: 'lommel-seeliger' }, { mu0, mu, phase: 0 }, NORMAL_GEOMETRY);
  return gain <= policy.maximumGain ? gain : null;
}

export function diskGain(incidence: number, emission: number, policy: DiskPhotometry, phase?: number) {
  if (policy.model === 'retained-observation') return Number.isFinite(incidence) && Number.isFinite(emission) &&
    incidence >= 0 && emission >= 0 && incidence <= policy.maximumIncidenceDegrees*Math.PI/180 &&
    emission <= policy.maximumEmissionDegrees*Math.PI/180 ? 1 : null;
  if (policy.model !== 'minnaert') return lommelSeeligerGain(incidence, emission, policy);
  if (phase === undefined || ! [incidence, emission, phase].every(Number.isFinite) || incidence < 0 || emission < 0 || phase < 0 || phase > Math.PI ||
      incidence > policy.maximumIncidenceDegrees * Math.PI/180 || emission > policy.maximumEmissionDegrees * Math.PI/180) return null;
  const model = { family: 'minnaert' as const, coefficient: policy.coefficient ?? NaN, coefficientPerDegree: policy.phaseCoefficientPerDegree ?? 0 };
  const k = minnaertExponent(model, phase);
  if (!(k >= .5 && k <= 1)) return null;
  const gain = diskFunctionGain(model, { mu0: Math.cos(incidence), mu: Math.cos(emission), phase }, NORMAL_GEOMETRY);
  return gain > 0 && gain <= policy.maximumGain ? gain : null;
}

/** OSIRIS calibration pipeline section 3.13: I/F = pi * d^2 * radiance / SFX.
 * Use the actual calibration HISTORY, after checking the unscaled L4 pixels. */
export function osirisRadianceFactorScale(history: string) {
  const quantity = (name: string, unit: string) => {
    const value = field(history, name), match = value.match(/^([0-9.eE+-]+)\s*<([^>]+)>$/);
    if (!match || match[2] !== unit || !(Number(match[1]) > 0) || !Number.isFinite(Number(match[1]))) throw new Error(`Invalid OSIRIS calibration quantity: ${name}`);
    return Number(match[1]);
  };
  if (field(history, 'ROSETTA:REFLECTIVITY_NORMALIZATION_FLAG') !== 'FALSE') throw new Error('OSIRIS radiance is already normalized.');
  const solarDistanceAu = quantity('SOLAR_DISTANCE', 'AU'), solarFlux = quantity('SOLAR_FLUX', 'W/m**2/nm');
  return { solarDistanceAu, solarFlux, factor: Math.PI * solarDistanceAu ** 2 / solarFlux };
}

/** Phase terms of the authored single-scattering approximation. This does not
 * apply Hapke roughness, multiple scattering, or recover cast shadows. */
export function phaseGain(phase: number | undefined, policy?: PhasePhotometry) {
  if (!policy) return 1;
  if (phase === undefined || !Number.isFinite(phase) || phase < policy.minimumDegrees * Math.PI / 180 || phase > policy.maximumDegrees * Math.PI / 180) return null;
  const gain = phaseFunctionGain({ family: 'hg-shadow-hiding', asymmetry: policy.asymmetry, amplitude: policy.amplitude, width: policy.width }, phase, policy.referenceDegrees * Math.PI / 180);
  return Number.isFinite(gain) && gain >= 1 / policy.maximumGain && gain <= policy.maximumGain ? gain : null;
}

export function observationGain(incidence: number, emission: number, policy: DiskPhotometry, phase?: number) {
  const disk = diskGain(incidence, emission, policy, phase), correction = phaseGain(phase, policy.phaseCorrection);
  return disk === null || correction === null ? null : disk * correction;
}

const dot = (a: readonly number[], b: readonly number[]) => a.reduce((sum, n, i) => sum + n * b[i], 0);
export function project(matrix: readonly number[][], point: readonly number[]) {
  const q = [...point, 1], h = matrix.map(row => dot(row, q));
  return [h[0] / h[2], h[1] / h[2], h[2]];
}

// Pivoted elimination on normalized coordinates. The homogeneous camera's
// final coefficient is fixed to one; degenerate fits fail closed.
function solve(matrix: readonly number[][], rhs: readonly number[]) {
  const n = rhs.length, a = matrix.map((row, i) => [...row, rhs[i]]);
  for (let k = 0; k < n; k++) {
    let pivot = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(a[i][k]) > Math.abs(a[pivot][k])) pivot = i;
    if (Math.abs(a[pivot][k]) < 1e-12) throw new Error('Degenerate camera calibration.');
    [a[k], a[pivot]] = [a[pivot], a[k]];
    const divisor = a[k][k];
    for (let j = k; j <= n; j++) a[k][j] /= divisor;
    for (let i = 0; i < n; i++) if (i !== k) {
      const factor = a[i][k];
      for (let j = k; j <= n; j++) a[i][j] -= factor * a[k][j];
    }
  }
  return a.map(row => row[n]);
}

export function fitCamera(points: readonly number[][], pixels: readonly number[][], width: number, height: number) {
  if (points.length < 12 || points.length !== pixels.length || points.some(p => p.length !== 3 || !p.every(Number.isFinite)) ||
      pixels.some(p => p.length !== 2 || !p.every(Number.isFinite))) throw new Error('Invalid camera correspondences.');
  const mean = [0, 1, 2].map(axis => points.reduce((s, p) => s + p[axis], 0) / points.length);
  const scale = Math.sqrt(points.reduce((s, p) => s + p.reduce((ss, n, i) => ss + (n - mean[i]) ** 2, 0), 0) / points.length);
  if (!(scale > 0)) throw new Error('Degenerate camera calibration.');
  const normal = Array.from({ length: 11 }, () => new Array<number>(11).fill(0)), rhs = new Array<number>(11).fill(0);
  for (let k = 0; k < points.length; k++) {
    const q = [...points[k].map((n, i) => (n - mean[i]) / scale), 1];
    for (let axis = 0; axis < 2; axis++) {
      const size = axis ? height : width, value = (pixels[k][axis] - (size - 1) / 2) / (size / 2);
      const row = new Array<number>(11).fill(0);
      for (let j = 0; j < 4; j++) row[axis * 4 + j] = q[j];
      for (let j = 0; j < 3; j++) row[8 + j] = -value * q[j];
      for (let i = 0; i < 11; i++) {
        rhs[i] += row[i] * value;
        for (let j = 0; j < 11; j++) normal[i][j] += row[i] * row[j];
      }
    }
  }
  const v = [...solve(normal, rhs), 1];
  let matrix = [v.slice(0, 4), v.slice(4, 8), v.slice(8, 12)].map(row =>
    [...row.slice(0, 3).map(n => n / scale), row[3] - dot(row.slice(0, 3), mean) / scale]);
  matrix = matrix.map((row, axis) => axis === 2 ? row : row.map((n, i) =>
    n * (axis ? height : width) / 2 + matrix[2][i] * ((axis ? height : width) - 1) / 2));
  const divisor = Math.hypot(...matrix[2].slice(0, 3));
  matrix = matrix.map(row => row.map(n => n / divisor));
  if (project(matrix, mean)[2] < 0) matrix = matrix.map(row => row.map(n => -n));
  const positionKm = solve(matrix.map(row => row.slice(0, 3)), matrix.map(row => -row[3]));
  return { matrix, positionKm };
}

export function sampleGeo(frame: GeoFrame, matrix: readonly number[][], pointKm: readonly number[], { maximumSeparationMeters, maximumEmissionDegrees, photometry, normalize }: {maximumSeparationMeters:number;maximumEmissionDegrees:number;photometry?:DiskPhotometry;normalize?:(incidence:number,emission:number,phase:number|undefined)=>number|null}): GeoSample {
  const [x, y, depth] = frame.projectPoint ? frame.projectPoint(pointKm) : project(matrix, pointKm), { width, height, planes } = frame;
  if (!(depth > 0) || !Number.isFinite(x + y) || x < 0 || y < 0 || x >= width - 1 || y >= height - 1) return { reason: 'outside' };
  const ix = Math.floor(x), iy = Math.floor(y), tx = x - ix, ty = y - iy;
  const ids = [iy * width + ix, iy * width + ix + 1, (iy + 1) * width + ix, (iy + 1) * width + ix + 1];
  if (ids.some(i => !frame.valid(i))) return { reason: 'no-geometry' };
  const {acceptPixel,quality}=frame;
  if (acceptPixel && ids.some(i => !acceptPixel(i))) return { reason: 'quality' };
  if (quality && ids.some(i => !acceptOsirisQuality(quality.flags[i], quality.allowLossy))) return { reason: 'quality' };
  if (ids.some(i => !Number.isFinite(planes.EMISSION_ANGLE_IMAGE[i]) || planes.EMISSION_ANGLE_IMAGE[i] < 0 ||
      planes.EMISSION_ANGLE_IMAGE[i] > maximumEmissionDegrees * Math.PI / 180)) return { reason: 'grazing' };
  // Every bilinear contributor must lie on this surface patch. This rejects
  // foreground/background mixing at the neck and limb, not merely zero fill.
  const separationMeters = Math.max(...ids.map(i => Math.hypot(...frame.xyz(i).map((n, j) => n - pointKm[j])) * 1000));
  if (separationMeters > maximumSeparationMeters) return { reason: 'geometry-mismatch', separationMeters };
  const weights = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty];
  const gains = ids.map(i => normalize ? normalize(planes.INCIDENCE_ANGLE_IMAGE[i], planes.EMISSION_ANGLE_IMAGE[i], planes.PHASE_ANGLE_IMAGE?.[i])
    : photometry ? observationGain(planes.INCIDENCE_ANGLE_IMAGE[i], planes.EMISSION_ANGLE_IMAGE[i], photometry, planes.PHASE_ANGLE_IMAGE?.[i]) : 1);
  if (!gains.every((gain): gain is number => gain !== null)) return { reason: 'photometry' };
  return { radiance: ids.reduce((sum, id, i) => sum + planes.IMAGE[id] * weights[i] * gains[i], 0) * (frame.radianceFactor?.factor ?? 1), separationMeters,
    maximumIncidenceDegrees: Math.max(...ids.map(i => planes.INCIDENCE_ANGLE_IMAGE[i])) * 180 / Math.PI,
    gain: Math.max(...gains), maximumEmissionDegrees: Math.max(...ids.map(i => planes.EMISSION_ANGLE_IMAGE[i])) * 180 / Math.PI };
}
