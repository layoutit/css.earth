/** ESO SDP single-record spectra. The existing FITS reader owns byte layout;
 * ESO owns WAVE/FLUX/ERR and QUAL=0. Native indices survive exclusions as IDs.
 * https://www.eso.org/sci/observing/phase3/p3sdpstd.pdf */
import { binaryTable, numbers, readFitsHdus, tableColumn } from '../../interferometry/fits-table.mts';
import { requireString } from '../../../sources/source-values.mts';
import type { ProductDescriptor } from '../product-descriptor.mts';
import { descriptor } from './common.mts';
import { validateSpectrum, type SpectrumSample } from './f03-spectrum.mts';

export const ESO_SPECTRUM_PROFILE = 'eso-sdp-spectrum@1';
export interface EsoSpectrum {
  readonly samples: readonly SpectrumSample[];
  readonly wavelengthUnit: string;
  readonly wavelengthToMicrometres: number;
  readonly fluxUnit: string;
  readonly spectralFrame: string | null;
  readonly fluxCalibration: string | null;
  readonly hdu: number;
  readonly nativeSamples: number;
  readonly excludedSamples: number;
  readonly qualityColumn: boolean;
}

export function readEsoSpectrum(bytes: Buffer): EsoSpectrum {
  const hdus = readFitsHdus(bytes), primary = hdus[0]?.header;
  if (primary?.PRODCATG !== 'SCIENCE.SPECTRUM') throw new TypeError('ESO SDP requires PRODCATG=SCIENCE.SPECTRUM.');
  const tables = hdus.flatMap((hdu, index) => hdu.header.XTENSION === 'BINTABLE' ? [index] : []);
  if (tables.length !== 1) throw new TypeError('ESO SDP requires exactly one spectral BINTABLE.');
  const hdu = tables[0]!, table = binaryTable(hdus[hdu]!), header = table.hdu.header;
  if (!/^SPECTRUM [Vv][12]\.0$/u.test(String(header.VOCLASS))) throw new TypeError('Unsupported ESO SDP VOCLASS.');
  if (table.rows !== 1) throw new TypeError('ESO SDP spectrum must contain one vector-valued record.');
  const count = header.NELEM;
  if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 1) throw new TypeError('ESO SDP NELEM must be a positive sample count.');
  const required = ['WAVE', 'FLUX', 'ERR'] as const;
  const columns = required.map(name => tableColumn(table, name));
  if (new Set(table.columns.map(column => column.name)).size !== table.columns.length) throw new TypeError('Duplicate ESO SDP columns.');
  for (const column of columns) if (!['D', 'E'].includes(column.type) || column.repeat !== count)
    throw new TypeError(`${column.name} must contain NELEM floating-point values.`);
  const index = (name: string) => table.columns.findIndex(column => column.name === name) + 1;
  const unit = (name: string) => requireString(header[`TUNIT${index(name)}`], `${name} unit`).trim();
  const utype = (name: string) => String(header[`TUTYP${index(name)}`] ?? '').replace(/^(spec:|spectrum\.)/iu, '').toLowerCase();
  for (const [name, expected] of [['WAVE', 'data.spectralaxis.value'], ['FLUX', 'data.fluxaxis.value'], ['ERR', 'data.fluxaxis.accuracy.staterror']])
    if (utype(name!) !== expected) throw new TypeError(`${name} has no supported spectral-data-model UTYPE.`);
  const wavelengthUnit = unit('WAVE'), fluxUnit = unit('FLUX');
  const wavelengthToMicrometres = new Map([['angstrom', 1e-4], ['nm', 1e-3], ['um', 1], ['m', 1e6]]).get(wavelengthUnit.toLowerCase());
  if (wavelengthToMicrometres === undefined) throw new TypeError(`Unsupported wavelength unit ${wavelengthUnit}.`);
  if (!fluxUnit || unit('ERR') !== fluxUnit) throw new TypeError('FLUX and ERR need the same stated unit.');
  const wave = numbers(bytes, table, 0, columns[0]!), flux = numbers(bytes, table, 0, columns[1]!), error = numbers(bytes, table, 0, columns[2]!);
  const quality = table.columns.find(column => column.name === 'QUAL');
  if (quality && (quality.repeat !== count || !['B', 'I', 'J', 'K'].includes(quality.type))) throw new TypeError('QUAL must contain NELEM integer flags.');
  const flags = quality ? numbers(bytes, table, 0, quality) : undefined;
  const samples: SpectrumSample[] = [];
  let segment = 0, priorIndex = -2;
  for (let i = 0; i < count; i++) {
    const wavelength = wave[i]!, value = flux[i]!, uncertainty = error[i]!, flag = flags?.[i] ?? 0;
    if (!(Number.isFinite(wavelength) && wavelength > 0) || i > 0 && wavelength <= wave[i - 1]!)
      throw new TypeError('WAVE must be positive, finite and strictly increasing.');
    if (!Number.isSafeInteger(flag) || flag < 0) throw new TypeError('QUAL contains an invalid flag.');
    // Zero ERR in real ESPRESSO products marks unsupported samples even when QUAL is zero.
    if (flag !== 0 || !Number.isFinite(value) || !(Number.isFinite(uncertainty) && uncertainty > 0)) continue;
    if (i !== priorIndex + 1) segment++;
    samples.push({ id: String(i), segment: String(segment), wavelength, value, uncertainty });
    priorIndex = i;
  }
  validateSpectrum(samples);
  return { samples, wavelengthUnit, wavelengthToMicrometres, fluxUnit, hdu, nativeSamples: count,
    excludedSamples: count - samples.length, qualityColumn: !!quality,
    spectralFrame: typeof primary.SPECSYS === 'string' ? primary.SPECSYS : null,
    fluxCalibration: typeof primary.FLUXCAL === 'string' ? primary.FLUXCAL : null };
}

export function describeEsoSpectrum(id: string, target: string, source: EsoSpectrum): ProductDescriptor {
  const shape = [source.nativeSamples], memberId = 'science';
  return descriptor({ schema: 'cssearth-telescope-product-descriptor@1',
    dataset: { id, target, acquisition: { kind: 'archive', identity: id }, producingRecord: 'qualified.product.json',
      sourceClassifications: [{ term: 'SCIENCE.SPECTRUM', vocabulary: 'ESO SDP PRODCATG', version: '8', status: 'source' }],
      families: ['F03'], profiles: [{ handlerId: 'f03-spectrum', profileId: ESO_SPECTRUM_PROFILE }] },
    members: [{ id: memberId, path: 'science.fits', role: 'science', mediaType: 'application/fits' }],
    components: [{ id: 'spectrum', name: 'Flux density', families: ['F03'], locations: [{ memberId, hdu: source.hdu }],
      representation: { kind: 'table', rows: 1 },
      axes: [{ id: 'wavelength', index: 0, length: source.nativeSamples, role: 'spectral', unit: source.wavelengthUnit,
        coordinates: { kind: 'lookup', memberId, locator: 'WAVE', binBounds: false }, ...(source.spectralFrame ? { frame: source.spectralFrame } : {}) }],
      columns: [{ id: 'flux', name: 'FLUX', role: 'measurement', datatype: 'float64', unit: source.fluxUnit, nullable: true, variableLength: false, shape },
        { id: 'error', name: 'ERR', role: 'standard-deviation', datatype: 'float64', unit: source.fluxUnit, nullable: true, variableLength: false, shape },
        ...(source.qualityColumn ? [{ id: 'quality', name: 'QUAL', role: 'quality', datatype: 'integer', nullable: false, variableLength: false, shape }] : [])],
      quantity: { name: 'Flux density', unit: source.fluxUnit, semantics: 'Native ESO SDP flux and standard error; no continuum normalization, resampling or recalibration.' },
      calibration: { state: ['ABSOLUTE', 'RELATIVE'].includes(source.fluxCalibration ?? '') ? 'archive-calibrated' : 'unknown', basis: [`ESO SDP SCIENCE.SPECTRUM; FLUXCAL=${source.fluxCalibration ?? 'unstated'}. Archive declaration, not independent calibration validation.`] },
      uncertainty: { form: 'standard-deviation', columnId: 'error', basis: 'ESO SDP ERR, in the FLUX unit. Nonpositive or nonfinite errors are excluded.' },
      flags: source.qualityColumn ? [{ id: 'quality', columnId: 'quality', meaning: 'ESO SDP quality flag.', usableWhen: 'QUAL=0, finite FLUX and positive finite ERR. Native samples remain in science.fits.' }] : [], dependencyIds: [] }],
    dependencies: [], issues: [{ scope: 'axis', identity: 'wavelength', state: 'unknown',
      reason: `${source.excludedSamples} of ${source.nativeSamples} native samples excluded by QUAL/FLUX/ERR; exported IDs retain native indices and segments break at each exclusion. Spectral bin boundaries and achieved spatial resolution are not established.` }] });
}
