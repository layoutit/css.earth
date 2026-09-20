/** Product metadata, never catalogue capabilities. Deliberately bounded format support. */
import { requireArray, requireRecord, requireString, requireFiniteNumber } from '../../source-values.mts';
import type { ProductFacts } from './request-satisfaction.mts';

export interface NativeMetadata {
  readonly fitsHdu?: number;
  readonly shape?: readonly number[];
  readonly structures?: readonly NativeMetadata[];
  readonly quality?: { readonly policy: string; readonly samples: number; readonly finite: number; readonly usable: number; readonly flagged: number; readonly invalidUncertainty: number; readonly mask: string | null };
  readonly uncertainty?: { readonly status: 'validated' | 'unknown'; readonly kind: string | null; readonly structure: string | null };
  readonly structure: string;
  readonly units?: { readonly value: string; readonly source: string };
  readonly spectral?: { readonly axis?: number; readonly centersMicrometres: readonly number[]; readonly binEdgesMicrometres?: readonly number[]; readonly source: string; readonly usableBands?: readonly boolean[] };
  readonly calibration: readonly { readonly field: string; readonly value: string }[];
  readonly limitations: readonly string[];
}
export function parseNativeMetadata(raw: unknown, depth = 0): NativeMetadata {
  if(depth > 1) throw new Error('Nested science structures exceed supported depth');
  const v = requireRecord(raw, 'native metadata');
  const units = v.units === undefined ? undefined : requireRecord(v.units);
  const spectral = v.spectral === undefined ? undefined : requireRecord(v.spectral);
  const quality = v.quality === undefined ? undefined : requireRecord(v.quality);
  const uncertainty = v.uncertainty === undefined ? undefined : requireRecord(v.uncertainty);
  if (quality) for (const key of ['samples','finite','usable','flagged','invalidUncertainty']) { const n=requireFiniteNumber(quality[key]); if(!Number.isSafeInteger(n)||n<0||n>requireFiniteNumber(quality.samples))throw new Error('Invalid science quality counts'); }
  if(uncertainty && !['validated','unknown'].includes(String(uncertainty.status)))throw new Error('Invalid uncertainty status');
  if(spectral?.usableBands !== undefined && (requireArray(spectral.usableBands).length!==requireArray(spectral.centersMicrometres).length || requireArray(spectral.usableBands).some(x=>typeof x!=='boolean')))throw new Error('Invalid spectral mask');
  if(v.fitsHdu!==undefined&&(!Number.isSafeInteger(v.fitsHdu)||Number(v.fitsHdu)<0))throw new Error('Invalid FITS HDU identity');
  if(spectral?.axis!==undefined&&(!Number.isSafeInteger(spectral.axis)||Number(spectral.axis)<0||Number(spectral.axis)>=requireArray(v.shape).length))throw new Error('Invalid spectral axis identity');
  return { structure: requireString(v.structure),
    ...(v.fitsHdu===undefined?{}:{fitsHdu:requireFiniteNumber(v.fitsHdu)}),
    ...(v.shape ? {shape:requireArray(v.shape).map(n=>{const value=requireFiniteNumber(n);if(!Number.isSafeInteger(value)||value<1)throw new Error('Invalid science shape');return value;})}:{}),
    ...(v.structures ? {structures:requireArray(v.structures).map(s=>parseNativeMetadata(s,depth+1))}:{}),
    ...(quality ? {quality:{policy:requireString(quality.policy),samples:requireFiniteNumber(quality.samples),finite:requireFiniteNumber(quality.finite),usable:requireFiniteNumber(quality.usable),flagged:requireFiniteNumber(quality.flagged),invalidUncertainty:requireFiniteNumber(quality.invalidUncertainty),mask:quality.mask===null?null:requireString(quality.mask)}}:{}),
    ...(uncertainty ? {uncertainty:{status:uncertainty.status as 'validated'|'unknown',kind:uncertainty.kind===null?null:requireString(uncertainty.kind),structure:uncertainty.structure===null?null:requireString(uncertainty.structure)}}:{}),
    ...(units ? { units: { value: requireString(units.value), source: requireString(units.source) } } : {}),
    ...(spectral ? { spectral: { ...(spectral.axis===undefined?{}:{axis:requireFiniteNumber(spectral.axis)}), centersMicrometres: coordinates(requireArray(spectral.centersMicrometres).map(n => requireFiniteNumber(n))), source: requireString(spectral.source), ...(spectral.binEdgesMicrometres === undefined ? {} : {binEdgesMicrometres: coordinates(requireArray(spectral.binEdgesMicrometres).map(n=>requireFiniteNumber(n)),requireArray(spectral.centersMicrometres).length+1)}), ...(spectral.usableBands === undefined ? {} : {usableBands: requireArray(spectral.usableBands) as boolean[]}) } } : {}),
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
// Read the spelling here. The shared readback validates it with Astropy before publication.
function units(raw: unknown, source: string, limitations: string[]): NativeMetadata['units'] {
  if (raw === undefined) { limitations.push(`No data unit in ${source}.`); return undefined; }
  if (typeof raw !== 'string' || !raw.trim()) throw new Error(`Invalid native data unit in ${source}.`);
  const value = raw.trim();
  return { value, source };
}
type MetadataFacts = Pick<ProductFacts, 'nativeMetadata' | 'wavelengthIntervalsMicrometres' | 'angularResolutionArcsec' | 'resolutionEvidence'>;
const missingResolution = 'No product-specific measured PSF or calibrated beam; pixel spacing and nominal optics do not establish achieved resolution.';

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
/** Named geometry backplanes may inherit spectral keywords from their input cube. */
export function isisGeometryBands(bytes:Buffer):boolean {
  const header=bytes.subarray(0,128*1024).toString('latin1').split(/^End\s*$/mu)[0];
  const names=field(group(header,'BandBin'),'Name')?.replace(/[()"]/gu,'').split(',').map(n=>n.trim().toLowerCase());
  return !!names?.length && names.every(n=>['phase angle','emission angle','incidence angle','latitude','longitude','pixel resolution'].includes(n));
}
export function isisMetadata(bytes: Buffer, bands: number, validBands?: readonly boolean[]): MetadataFacts {
  const header = bytes.subarray(0, 128 * 1024).toString('latin1').split(/^End\s*$/mu)[0];
  const band = group(header, 'BandBin'), cal = group(header, 'RadiometricCalibration');
  const limitations: string[] = [missingResolution], calibration: { field: string; value: string }[] = [];
  for (const key of ['CalibrationVersion', 'OutputUnits', 'WavelengthCalibrationFile', 'BandwidthFile', 'AverageBandwidthFile', 'FlatFile']) {
    const value = field(cal, key); if (value) calibration.push({ field: `RadiometricCalibration:${key}`, value });
  }
  if (calibration.some(row => row.field.endsWith('File'))) limitations.push('Calibration file references are recorded from the pinned label; external byte and applicability status is recorded separately in calibrationDependencies.');
  const unit = units(field(cal, 'OutputUnits'), 'RadiometricCalibration:OutputUnits', limitations);
  if(isisGeometryBands(bytes))return {nativeMetadata:{structure:'IsisCube:geometry backplanes',calibration,limitations:['Named geometry backplanes; inherited spectral keywords do not describe measured wavelengths.']}};
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
