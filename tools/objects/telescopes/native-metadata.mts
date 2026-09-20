/** Product metadata, never catalogue capabilities. Deliberately bounded format support. */
import { readFitsHdus, fitsImageAccessor } from '../../fits.mts';
import { requireArray, requireRecord, requireString, requireFiniteNumber } from '../../source-values.mts';
import type { ProductFacts } from './request-satisfaction.mts';

export interface NativeMetadata {
  readonly structure: string;
  readonly units?: { readonly value: string; readonly source: string };
  readonly spectral?: { readonly centersMicrometres: readonly number[]; readonly source: string };
  readonly calibration: readonly { readonly field: string; readonly value: string }[];
  readonly limitations: readonly string[];
}
export function parseNativeMetadata(raw: unknown): NativeMetadata {
  const v = requireRecord(raw, 'native metadata');
  const units = v.units === undefined ? undefined : requireRecord(v.units);
  const spectral = v.spectral === undefined ? undefined : requireRecord(v.spectral);
  return { structure: requireString(v.structure),
    ...(units ? { units: { value: requireString(units.value), source: requireString(units.source) } } : {}),
    ...(spectral ? { spectral: { centersMicrometres: coordinates(requireArray(spectral.centersMicrometres).map(n => requireFiniteNumber(n))), source: requireString(spectral.source) } } : {}),
    calibration: requireArray(v.calibration).map(raw => { const row = requireRecord(raw); return { field: requireString(row.field), value: requireString(row.value) }; }),
    limitations: requireArray(v.limitations).map(s => requireString(s)) };
}
function coordinates(values: number[], expected = values.length): number[] {
  if (!values.length || values.length !== expected || values.some(n => !Number.isFinite(n) || n <= 0)) throw new Error('Invalid native wavelength coordinates or band count.');
  const differences = values.slice(1).map((n, i) => n - values[i]);
  if (differences.length && !differences.every(n => n > 0) && !differences.every(n => n < 0)) throw new Error('Native wavelength coordinates must be strictly monotonic.');
  return values;
}
const wavelengthScale = (unit: string) => ({ m: 1e6, nm: .001, um: 1, micron: 1, microns: 1, micrometer: 1, micrometers: 1, micrometre: 1, micrometres: 1, angstrom: .0001, angstroms: .0001 }[unit.trim().toLowerCase().replace(/[µμ]/gu, 'u')]);
// Supported physical unit spellings. Unknown strings are retained as limitations, not promoted.
function units(raw: unknown, source: string, limitations: string[]): NativeMetadata['units'] {
  if (raw === undefined) { limitations.push(`No data unit in ${source}.`); return undefined; }
  if (typeof raw !== 'string' || !raw.trim()) throw new Error(`Invalid native data unit in ${source}.`);
  const value = raw.trim();
  if (!['I/F', '1', 'DIMENSIONLESS', 'DN', 'count', 'counts', 'electron', 'electrons', 'Jy', 'mJy', 'MJy/sr', 'Jy/beam', 'K', 'W m-2 sr-1 um-1'].includes(value)) {
    limitations.push(`Unsupported data unit ${JSON.stringify(value)} in ${source}.`); return undefined;
  }
  return { value, source };
}
type MetadataFacts = Pick<ProductFacts, 'nativeMetadata' | 'wavelengthIntervalsMicrometres' | 'angularResolutionArcsec' | 'resolutionEvidence'>;
const missingResolution = 'No product-specific measured PSF or calibrated beam; pixel spacing and nominal optics do not establish achieved resolution.';

/** FITS image WCS: separable linear WAVE/FREQ axes only. Never interpret axis 3 by position alone. */
export function fitsMetadata(bytes: Buffer, pin: { file: string; sha256: string }): MetadataFacts {
  const hdus = readFitsHdus(bytes);
  const images = hdus.filter(h => h.count && (!h.header.XTENSION || h.header.XTENSION === 'IMAGE'));
  const science = images.filter(h => h.header.EXTNAME === 'SCI');
  const hdu = science.length === 1 ? science[0] : images.length === 1 ? images[0] : undefined;
  const limitations: string[] = [], calibration: { field: string; value: string }[] = [];
  if (!hdu) return { nativeMetadata: { structure: 'unresolved', calibration, limitations: ['No unique science image HDU; metadata cannot be assigned by file order.'] } };
  const h = hdu.header, structure = `HDU ${hdus.indexOf(hdu)} (${h.EXTNAME ?? 'PRIMARY'})`;
  const unit = units(h.BUNIT, `${structure}:BUNIT`, limitations);
  let spectral: NativeMetadata['spectral'], intervals: [number, number][] | undefined;
  const axes = hdu.dimensions.map((_, i) => i + 1).filter(i => /^(WAVE|AWAV|FREQ|VRAD|VOPT|VELO)/u.test(String(h[`CTYPE${i}`] ?? '')));
  if (axes.length > 1) throw new Error('Ambiguous FITS spectral axes.');
  if (axes.length === 1) {
    const axis = axes[0], type = h[`CTYPE${axis}`], count = hdu.dimensions[axis - 1];
    const scale = typeof h[`CUNIT${axis}`] === 'string' ? type === 'WAVE' ? wavelengthScale(String(h[`CUNIT${axis}`]))
      : ({ Hz: 1, kHz: 1e3, MHz: 1e6, GHz: 1e9 }[String(h[`CUNIT${axis}`])]) : undefined;
    const coupled = hdu.dimensions.some((_, j) => j + 1 !== axis && (Number(h[`PC${axis}_${j + 1}`] ?? 0) !== 0 || Number(h[`CD${axis}_${j + 1}`] ?? 0) !== 0));
    if (!['WAVE', 'FREQ'].includes(String(type)) || !scale || coupled) limitations.push('Unsupported spectral WCS, missing/unsupported coordinate units, or spatially coupled wavelengths.');
    else {
      const hasCD = Object.keys(h).some(k => /^CD\d+_\d+$/u.test(k));
      const step = hasCD ? h[`CD${axis}_${axis}`] : Number(h[`CDELT${axis}`]) * Number(h[`PC${axis}_${axis}`] ?? 1);
      const ref = h[`CRVAL${axis}`], pixel = h[`CRPIX${axis}`];
      if (![step, ref, pixel].every(n => typeof n === 'number' && Number.isFinite(n)) || step === 0) throw new Error('Incomplete or invalid FITS spectral WCS.');
      const wavelength = (p: number) => { const coordinate = ((ref as number) + (p - (pixel as number)) * (step as number)) * scale;
        if (!(coordinate > 0) || !Number.isFinite(coordinate)) throw new Error('Invalid FITS spectral coordinate.'); return type === 'FREQ' ? 299792458e6 / coordinate : coordinate; };
      const centers = coordinates(Array.from({ length: count }, (_, i) => wavelength(i + 1)));
      spectral = { centersMicrometres: centers, source: `${structure}:CTYPE${axis}/CUNIT${axis}/CRVAL${axis}/CRPIX${axis}/CD or PC,CDELT` };
      const valid = new Array<boolean>(count).fill(false), at = fitsImageAccessor(bytes, hdu), stride = hdu.dimensions.slice(0, axis - 1).reduce((a, b) => a * b, 1);
      for (let i = 0; i < hdu.count; i++) if (Number.isFinite(at(i))) valid[Math.floor(i / stride) % count] = true;
      intervals = centers.flatMap((_, i) => valid[i] ? [[Math.min(wavelength(i + .5), wavelength(i + 1.5)), Math.max(wavelength(i + .5), wavelength(i + 1.5))] as [number, number]] : []);
      limitations.push('Spectral intervals are WCS pixel-bin support with finite samples, not optical bandpasses or spectral resolution; quality flags and per-pixel coverage are not assessed.');
    }
  } else limitations.push('No spectral coordinate axis in the selected science HDU.');
  let angularResolutionArcsec: number | undefined;
  if (h.BMAJ !== undefined || h.BMIN !== undefined) {
    if (typeof h.BMAJ !== 'number' || typeof h.BMIN !== 'number' || !(h.BMAJ >= h.BMIN && h.BMIN > 0)) throw new Error('Invalid or incomplete FITS restoring beam axes.');
    for (const key of ['BMAJ', 'BMIN', 'BPA']) if (h[key] !== undefined) calibration.push({ field: `${structure}:${key}`, value: String(h[key]) });
    if (unit?.value === 'Jy/beam' && !hdus.some(h => h.header.EXTNAME === 'BEAMS') && h.CASAMBM !== true) {
      angularResolutionArcsec = h.BMAJ * 3600;
      limitations.push('Resolution is the product restoring-beam major-axis FWHM; this does not independently validate deconvolution or residual emission.');
    } else limitations.push('Beam metadata is not applicable as one verified restoring beam (unit or per-plane beam ambiguity).');
  }
  if (angularResolutionArcsec === undefined) limitations.push(missingResolution);
  return { nativeMetadata: { structure, ...(unit ? { units: unit } : {}), ...(spectral ? { spectral } : {}), calibration, limitations },
    ...(intervals?.length ? { wavelengthIntervalsMicrometres: intervals } : {}),
    ...(angularResolutionArcsec === undefined ? {} : { angularResolutionArcsec, resolutionEvidence: [{ kind: 'calibrated', receipt: pin }] }) };
}

/** ISIS groups are confined to the attached label, not binary data or original uncalibrated labels. */
function group(label: string, name: string): string {
  const found = [...label.matchAll(new RegExp(`^\\s*Group\\s*=\\s*${name}\\s*\\r?\\n([\\s\\S]*?)^\\s*End_Group\\b`, 'gmi'))];
  if (found.length > 1) throw new Error(`Ambiguous ISIS ${name} group.`);
  return found[0]?.[1] ?? '';
}
function field(text: string, key: string): string | undefined {
  const found = [...text.matchAll(new RegExp(`^\\s*${key}\\s*=\\s*([\\s\\S]*?)(?=^\\s*[\\w-]+\\s*=|(?![\\s\\S]))`, 'gm'))];
  if (found.length > 1) throw new Error(`Duplicate ISIS ${key}.`);
  return found[0]?.[1].trim().replace(/-\s*\r?\n\s*/gu, '').replace(/^"|"$/gu, '');
}
function numbers(text: string): number[] {
  const explicitUnits = [...text.matchAll(/<([^<>]+)>/gu)].map(m => m[1].trim());
  if (new Set(explicitUnits).size > 1) throw new Error('Mixed ISIS coordinate units are unsupported.');
  return text.replace(/<[^<>]*>/gu, '').replace(/[()]/gu, '').split(',').map(s => { const n = Number(s.trim()); if (!s.trim() || !Number.isFinite(n)) throw new Error('Invalid ISIS numeric coordinate.'); return n; });
}
export function isisMetadata(bytes: Buffer, bands: number, validBands?: readonly boolean[]): MetadataFacts {
  const header = bytes.subarray(0, 128 * 1024).toString('latin1').split(/^End\s*$/mu)[0];
  const band = group(header, 'BandBin'), cal = group(header, 'RadiometricCalibration');
  const limitations: string[] = [missingResolution], calibration: { field: string; value: string }[] = [];
  for (const key of ['CalibrationVersion', 'OutputUnits', 'WavelengthCalibrationFile', 'BandwidthFile', 'AverageBandwidthFile', 'FlatFile']) {
    const value = field(cal, key); if (value) calibration.push({ field: `RadiometricCalibration:${key}`, value });
  }
  if (calibration.some(row => row.field.endsWith('File'))) limitations.push('Calibration file references are recorded from the pinned label; their external bytes were not read or independently validated.');
  const unit = units(field(cal, 'OutputUnits'), 'RadiometricCalibration:OutputUnits', limitations);
  const center = field(band, 'Center'); let spectral: NativeMetadata['spectral'], intervals: [number, number][] | undefined;
  if (center) {
    const values = coordinates(numbers(center), bands);
    const original = field(band, 'OriginalBand');
    if (original) { const indices = numbers(original); if (indices.length !== bands || indices.some(n => !Number.isInteger(n) || n < 1) || new Set(indices).size !== bands) throw new Error('ISIS original-band mapping disagrees with the core.'); }
    let unitName = /<([^<>]+)>/u.exec(center)?.[1] ?? field(band, 'Units');
    // RC19 vimscal rewrites Center but omits its units. Only this recorded calibration convention is supported.
    // https://github.com/DOI-USGS/ISIS3/blob/dev/isis/src/cassini/apps/vimscal/main.cpp (updateWavelengths)
    const rc19 = field(group(header, 'Instrument'), 'InstrumentId') === 'VIMS' && field(cal, 'CalibrationVersion') === 'RC19' && field(cal, 'BandwidthFile') && original;
    if (!unitName && rc19) { unitName = 'micrometers'; calibration.push({ field: 'BandBin:Center unit convention', value: 'ISIS vimscal RC19: micrometers (time-dependent BandwidthFile, not MissionAverage).' }); }
    const scale = unitName ? wavelengthScale(unitName) : undefined;
    if (scale) {
      spectral = { centersMicrometres: coordinates(values.map(v => v * scale)), source: 'IsisCube:BandBin:Center' };
      const width = field(band, 'Width');
      if (width) {
        const widthUnit = /<([^<>]+)>/u.exec(width)?.[1] ?? unitName!, widthScale = wavelengthScale(widthUnit);
        if (!widthScale) limitations.push('Unsupported ISIS band-width units.');
        else { const widths = numbers(width); if (widths.length !== bands || widths.some(w => w <= 0)) throw new Error('ISIS band widths disagree with the core.');
          intervals = spectral.centersMicrometres.map((c, i) => { const half = widths[i] * widthScale / 2; if (!(c > half)) throw new Error('Invalid ISIS band edges.'); return [c - half, c + half]; }); }
      } else limitations.push('Band centers are known; band widths/edges are absent. Continuous wavelength coverage and spectral resolving power remain unknown.');
    } else limitations.push('Band centers have missing or unsupported wavelength units.');
  } else limitations.push('No BandBin:Center coordinates in the product.');
  return { nativeMetadata: { structure: 'IsisCube:Core', ...(unit ? { units: unit } : {}), ...(spectral ? { spectral } : {}), calibration, limitations },
    ...(intervals ? { wavelengthIntervalsMicrometres: intervals.filter((_, i) => validBands?.[i] !== false) } : {}) };
}

/** pdr owns PDS decoding and object-scoped metadata; never join unrelated global label fields. */
export function pdsMetadata(decoded: unknown): MetadataFacts {
  const root = requireRecord(decoded), structures = requireArray(root.structures).map(s => requireRecord(s));
  const arrays = structures.filter(s => s.kind !== 'table' && requireArray(s.shape).length >= 2);
  const limitations: string[] = [missingResolution], calibration: NativeMetadata['calibration'] = [];
  if (arrays.length !== 1) return { nativeMetadata: { structure: 'unresolved', calibration, limitations: ['No unique PDS science array; metadata cannot be assigned by file order.'] } };
  const array = arrays[0], name = requireString(array.name), meta = array.nativeMetadata === undefined ? {} : requireRecord(array.nativeMetadata);
  const unit = units(meta.unit ?? undefined, `${name}:Element_Array/unit or CORE_UNIT`, limitations);
  let spectral: NativeMetadata['spectral'], intervals: [number, number][] | undefined;
  if (meta.centers !== null && meta.centers !== undefined) {
    const centers = requireArray(meta.centers).map(n => requireFiniteNumber(n)), count = requireFiniteNumber(meta.bands, 'PDS band count');
    if (!Number.isInteger(count) || !requireArray(array.shape).includes(count)) throw new Error('PDS spectral metadata does not match the decoded array.');
    coordinates(centers, count);
    const scale = typeof meta.wavelengthUnit === 'string' ? wavelengthScale(meta.wavelengthUnit) : undefined;
    if (scale) spectral = { centersMicrometres: coordinates(centers.map(c => c * scale)), source: `${name}:BAND_BIN_CENTER/BAND_BIN_UNIT` };
    else limitations.push('PDS spectral coordinate units are missing or unsupported.');
  }
  // PDS4 filter metadata may establish a passband only through its explicit array reference.
  const metadata = requireRecord(root.metadata);
  const filters = (metadata.opticalFilters === undefined ? [] : requireArray(metadata.opticalFilters)).map(raw => requireRecord(raw)).filter(f => f.array === name);
  if (filters.length > 1) throw new Error('Ambiguous PDS optical filters for the selected science array.');
  if (filters.length === 1 && requireArray(array.shape).length === 2) {
    const f = filters[0], c = Number(f.center), w = Number(f.width), cs = typeof f.centerUnit === 'string' ? wavelengthScale(f.centerUnit) : undefined, ws = typeof f.widthUnit === 'string' ? wavelengthScale(f.widthUnit) : undefined;
    if (!(Number.isFinite(c) && c > 0 && Number.isFinite(w) && w > 0)) throw new Error('Invalid PDS filter coordinates.');
    if (cs && ws) { const center = c * cs, half = w * ws / 2; if (!(center > half)) throw new Error('Invalid PDS filter edges.');
      spectral = { centersMicrometres: [center], source: `${name}:Optical_Filter via local_identifier_reference` }; intervals = [[center - half, center + half]]; }
    else limitations.push('PDS filter units are missing or unsupported.');
  }
  if (!intervals) limitations.push('No qualified band edges; center coordinates alone do not establish continuous coverage.');
  return { nativeMetadata: { structure: name, ...(unit ? { units: unit } : {}), ...(spectral ? { spectral } : {}), calibration, limitations }, ...(intervals ? { wavelengthIntervalsMicrometres: intervals } : {}) };
}
