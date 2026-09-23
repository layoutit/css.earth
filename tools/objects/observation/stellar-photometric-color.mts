// A photosphere colour for a star with no image: its measured spectrum (Gaia XP, or an archived spectrophotometric file) where one
// is published, otherwise a Planck spectrum at its catalogued photometric effective temperature, through the CIE 1931 2° observer
// into sRGB (D65 white), scaled so the brightest linear channel is 1. A self-luminous disc shows chromaticity only; its brightness
// is not modelled. Limb darkening is drawn where a measurement gives it, or from a named model grid (below).
import { requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';
import { linearToSrgb } from '../color-transfer.mts';
import { gunzipSync } from 'node:zlib';
import { binaryTable, numbers, readFitsHdus, tableColumn } from '../interferometry/fits-table.mts';

export type StellarColorRecord = {
  readonly spectrum: 'planck'; readonly temperaturePath: string; readonly sourceId: string;
  readonly columns: { readonly value: string; readonly lower: string; readonly upper: string };
} | { readonly spectrum: 'gaia-xp-sampled'; readonly spectrumPath: string; readonly sourceId: string }
  | { readonly spectrum: 'measured'; readonly measured: MeasuredSpectrumRecord };
export interface StellarTemperature { readonly kelvin: number; readonly lowerKelvin: number; readonly upperKelvin: number }
export interface StellarColor { readonly linear: readonly [number, number, number]; readonly srgb: readonly [number, number, number] }

export function parseStellarColorRecord(value: unknown): StellarColorRecord {
  const input = requireRecord(value, 'stellar colour record');
  if (input.schema !== 'cssearth-stellar-photometric-color@1') throw new TypeError('The stellar colour record must use cssearth-stellar-photometric-color@1.');
  const integer = (id: string) => { if (!/^\d+$/u.test(id)) throw new TypeError('The catalogue source id must be an integer string.'); return id; };
  if (input.spectrum === 'measured') {
    if (input.temperature !== undefined) throw new TypeError('A colour from a measured spectrum takes no temperature.');
    return { spectrum: 'measured', measured: parseMeasuredSpectrumRecord(input.measuredSpectrum) };
  }
  if (input.spectrum === 'gaia-xp-sampled') {
    if (input.temperature !== undefined) throw new TypeError('A colour from a measured spectrum takes no temperature.');
    const spectrum = requireRecord(input.sampledSpectrum, 'sampledSpectrum');
    return { spectrum: 'gaia-xp-sampled', spectrumPath: requireString(spectrum.path, 'sampledSpectrum.path'), sourceId: integer(requireString(spectrum.sourceId, 'sampledSpectrum.sourceId')) };
  }
  const temperature = requireRecord(input.temperature, 'temperature');
  if (input.spectrum !== 'planck') throw new TypeError('The stellar colour record must name the Planck spectrum or the Gaia XP sampled spectrum it applies.');
  const sourceId = integer(requireString(temperature.sourceId, 'temperature.sourceId'));
  return { spectrum: 'planck', temperaturePath: requireString(temperature.path, 'temperature.path'), sourceId,
    columns: { value: requireString(temperature.column, 'temperature.column'), lower: requireString(temperature.lowerColumn, 'temperature.lowerColumn'),
      upper: requireString(temperature.upperColumn, 'temperature.upperColumn') } };
}

/** Read the temperature and its bounds from the archived catalogue row, by source id. */
export function readStellarTemperature(csv: string, record: Extract<StellarColorRecord, { spectrum: 'planck' }>): StellarTemperature {
  const [header, ...rows] = csv.split(/\r?\n/u).filter(line => line.trim()).map(line => line.split(','));
  if (!header) throw new TypeError('The catalogue table is empty.');
  const column = (name: string) => { const index = header.indexOf(name); if (index < 0) throw new TypeError(`The catalogue table lacks ${name}.`); return index; };
  const matches = rows.filter(row => row[column('source_id')] === record.sourceId);
  if (matches.length !== 1) throw new TypeError(`The catalogue table must hold exactly one row for source ${record.sourceId}.`);
  const read = (name: string) => requireFiniteNumber(Number(matches[0]![column(name)]), name);
  const temperature = { kelvin: read(record.columns.value), lowerKelvin: read(record.columns.lower), upperKelvin: read(record.columns.upper) };
  if (!(temperature.kelvin > 1000 && temperature.lowerKelvin <= temperature.kelvin && temperature.kelvin <= temperature.upperKelvin)) {
    throw new TypeError('The catalogue temperature must be a stellar temperature inside its bounds.');
  }
  return temperature;
}

// IEC 61966-2-1 XYZ (D65) -> linear sRGB.
const XYZ_TO_LINEAR_SRGB = [[3.2404542, -1.5371385, -0.4985314], [-0.969266, 1.8760108, 0.041556], [0.0556434, -0.2040259, 1.0572252]] as const;
const PLANCK_H = 6.62607015e-34, LIGHT_C = 299792458, BOLTZMANN_K = 1.380649e-23;

/** Linear sRGB of a spectrum before any normalisation: absolute, so two spectra keep their relative brightness. */
export function spectrumLinearSrgb(wavelengths: readonly number[], power: (wavelength: number) => number, colorMatching: Map<number, readonly number[]>): [number, number, number] {
  const xyz = [0, 0, 0];
  for (const wavelength of wavelengths) {
    const observer = colorMatching.get(wavelength);
    if (!observer) throw new TypeError(`The CIE table must cover ${wavelength} nm.`);
    const value = power(wavelength);
    for (let channel = 0; channel < 3; channel++) xyz[channel] += value * observer[channel]!;
  }
  return XYZ_TO_LINEAR_SRGB.map(row => row[0] * xyz[0]! + row[1] * xyz[1]! + row[2] * xyz[2]!) as [number, number, number];
}

/** The Planck spectrum's absolute linear sRGB at a temperature (the visible range at 1 nm), for brightness ratios between temperatures. */
export function planckLinearSrgb(kelvin: number, colorMatching: Map<number, readonly number[]>): [number, number, number] {
  return spectrumLinearSrgb(Array.from({ length: 401 }, (_, i) => 380 + i), wavelength => {
    const metres = wavelength * 1e-9; return 1 / (metres ** 5 * Math.expm1(PLANCK_H * LIGHT_C / (metres * BOLTZMANN_K * kelvin))); }, colorMatching);
}

/** Spectral power at each wavelength (nm) through the observer into sRGB, brightest linear channel 1. */
function spectrumColor(wavelengths: readonly number[], power: (wavelength: number) => number, colorMatching: Map<number, readonly number[]>, label: string): StellarColor {
  const raw = spectrumLinearSrgb(wavelengths, power, colorMatching);
  const peak = Math.max(...raw);
  const linear = raw.map(value => value / peak) as [number, number, number];
  if (linear.some(value => value < 0)) throw new TypeError(`${label} falls outside the sRGB gamut: ${linear.join(', ')}.`);
  return { linear, srgb: linear.map(value => Math.round(255 * linearToSrgb(value))) as [number, number, number] };
}

export function planckColor(kelvin: number, colorMatching: Map<number, readonly number[]>): StellarColor {
  const wavelengths = Array.from({ length: 401 }, (_, i) => 380 + i);
  return spectrumColor(wavelengths, wavelength => { const metres = wavelength * 1e-9; return 1 / (metres ** 5 * Math.expm1(PLANCK_H * LIGHT_C / (metres * BOLTZMANN_K * kelvin))); },
    colorMatching, `A ${kelvin} K Planck colour`);
}

/** Gaia DR3 XP sampled mean spectra (Gaia Collaboration, De Angeli et al. 2023, A&A 674, A2; Montegriffo et al. 2023, A&A 674, A3)
 * as the Gaia DataLink service returns them in CSV: one row per source with its flux and flux_error as bracketed lists, 343 samples
 * from 336 to 1020 nm in 2 nm steps, in W m^-2 nm^-1. */
export const XP_SAMPLED_WAVELENGTHS_NM = Array.from({ length: 343 }, (_, i) => 336 + 2 * i);

export function readXpSampledSpectrum(csv: string, sourceId: string) {
  const lines = csv.split(/\r?\n/u).filter(line => line.trim());
  if (lines[0] !== 'source_id,solution_id,ra,dec,flux,flux_error') throw new TypeError('The XP spectrum table must have the DataLink CSV columns.');
  // The DataLink sampled product carries the source's position; a spectrum sampled here from the coefficients leaves those
  // two fields empty, because the coefficient product does not repeat them. Neither is read.
  const rows = lines.slice(1).map(line => /^(\d+),(\d+),([^,]*),([^,]*),"\(([^)]*)\)","\(([^)]*)\)"$/u.exec(line));
  if (rows.some(row => !row)) throw new TypeError('An XP spectrum row does not have the DataLink CSV layout.');
  const matches = rows.filter(row => row![1] === sourceId);
  if (matches.length !== 1) throw new TypeError(`The XP spectrum table must hold exactly one row for source ${sourceId}.`);
  const list = (text: string) => text.split(',').map(value => requireFiniteNumber(Number(value), 'XP sample'));
  const flux = list(matches[0]![5]!), fluxError = list(matches[0]![6]!);
  if (flux.length !== XP_SAMPLED_WAVELENGTHS_NM.length || fluxError.length !== flux.length) throw new TypeError(`An XP sampled spectrum has ${XP_SAMPLED_WAVELENGTHS_NM.length} samples.`);
  return { flux, fluxError };
}

/** How far below zero a sample may scatter and still be read as no emission, in its own standard errors. */
export const NOISE_FLOOR_SIGMA = 3;

/** The colour of a measured spectrum: its samples at the even wavelengths from 380 to 780 nm through the observer, as the Planck
 * colour takes every nanometre. The samples are 2 nm apart, so the odd wavelengths add nothing a finer grid would change.
 *
 * A cool star can be too faint to measure at the blue end, where its samples scatter around zero. With `fluxError`, a sample
 * that is not positive but lies within three times its own error of zero is read as no emission at that wavelength: ordinary
 * noise across hundreds of samples. A sample below zero by more than that is a spectrum this colour cannot be taken from, and
 * fails. Without `fluxError` every visible sample must be positive, which is what the one-sigma bounds pass. */
export function xpSampledColor(flux: readonly number[], colorMatching: Map<number, readonly number[]>, fluxError?: readonly number[]): StellarColor {
  const index = (wavelength: number) => (wavelength - 336) / 2;
  const wavelengths = XP_SAMPLED_WAVELENGTHS_NM.filter(wavelength => wavelength >= 380 && wavelength <= 780);
  const sample = (wavelength: number) => {
    const value = flux[index(wavelength)]!;
    if (value > 0) return value;
    const error = fluxError?.[index(wavelength)];
    if (error === undefined || !(Math.abs(value) <= NOISE_FLOOR_SIGMA * error)) throw new TypeError('The XP spectrum must be positive across the visible range, or consistent with zero where it is not.');
    return 0;
  };
  if (!wavelengths.some(wavelength => sample(wavelength) > 0)) throw new TypeError('The XP spectrum has no visible emission.');
  return spectrumColor(wavelengths, sample, colorMatching, 'The XP spectrum colour');
}

/** An independent second spectrum of the same star, read the same way: its colour is reported beside the lens colour so a reader
 * sees whether two instruments agree. `disagreement` states why, when they differ by more than the agreement threshold. */
export const CROSS_CHECK_AGREEMENT = 12;
export interface StellarColorCrossCheck { readonly source: string; readonly record: MeasuredSpectrumRecord; readonly disagreement?: string }
export function parseStellarColorCrossCheck(value: unknown): StellarColorCrossCheck | undefined {
  if (value === undefined) return undefined;
  const input = requireRecord(value, 'crossCheck');
  return { source: requireString(input.source, 'crossCheck.source'), record: parseMeasuredSpectrumRecord(input.spectrum),
    ...(input.disagreement === undefined ? {} : { disagreement: requireString(input.disagreement, 'crossCheck.disagreement') }) };
}

export async function loadStellarPhotometricColor(read: (path: string) => Promise<Buffer>, science: Record<string, unknown>, sourcePath: string) {
  const raw = JSON.parse((await read(sourcePath)).toString('utf8')) as unknown;
  const record = parseStellarColorRecord(raw), crossRecord = parseStellarColorCrossCheck(requireRecord(raw).crossCheck);
  const result = await loadStellarColorOnly(read, science, record);
  if (!crossRecord) return { ...result, crossCheck: null };
  const { parseCieTable } = await import('./disc-integrated-color.mts');
  const colorMatching = parseCieTable((await read(requireString(science.colorMatching, 'science.colorMatching'))).toString('utf8'), 3);
  const color = measuredSpectrumColor(readMeasuredSpectrum(await read(crossRecord.record.path), crossRecord.record), colorMatching, crossRecord.record.gaps);
  const difference = Math.max(...color.srgb.map((value, channel) => Math.abs(value - result.color.srgb[channel]!)));
  return { ...result, crossCheck: { source: crossRecord.source, srgb: color.srgb, maxChannelDifference: difference, ...(crossRecord.disagreement ? { disagreement: crossRecord.disagreement } : {}) } };
}

async function loadStellarColorOnly(read: (path: string) => Promise<Buffer>, science: Record<string, unknown>, record: StellarColorRecord) {
  const { parseCieTable } = await import('./disc-integrated-color.mts');
  const colorMatching = parseCieTable((await read(requireString(science.colorMatching, 'science.colorMatching'))).toString('utf8'), 3);
  const limbDarkening = science.limbDarkening === undefined ? null : await (async () => {
    const recipe = parseLimbDarkeningRecipe(science.limbDarkening);
    if (recipe.source === 'table') return { recipe, coefficients: readQuadraticLimbDarkening((await read(recipe.path)).toString('utf8'), recipe) };
    if (recipe.source === 'grid') return { recipe, coefficients: interpolateQuadraticLimbDarkening((await read(recipe.path)).toString('utf8'), recipe) };
    if (recipe.source === 'published') return { recipe, coefficients: readPublishedLimbDarkening(JSON.parse((await read(recipe.path)).toString('utf8'))) };
    const [{ readTessLightCurve, fitTransitLimbDarkening }, { BODIES, HOSTED_PLANET_IDS, STAR_IDS, hostedOrbit, starAstrometry }] =
      await Promise.all([import('../eclipse-map/transit-limb-darkening.mts'), import('@cssearth/astronomy')]);
    if (!(HOSTED_PLANET_IDS as readonly string[]).includes(recipe.planet)) throw new TypeError(`Limb darkening from transits needs a hosted planet: ${recipe.planet}.`);
    const planet = recipe.planet as (typeof HOSTED_PLANET_IDS)[number], hostId = BODIES[planet].parent;
    if (!(STAR_IDS as readonly (string | null)[]).includes(hostId)) throw new TypeError(`${planet} does not orbit a placed star.`);
    const host = hostId as (typeof STAR_IDS)[number];
    const curves = await Promise.all(recipe.lightCurves.map(async path => readTessLightCurve(await read(path))));
    const fit = fitTransitLimbDarkening(curves, hostedOrbit(planet), starAstrometry(host), BODIES[planet].meanRadiusKm / BODIES[host].meanRadiusKm);
    const coefficients = { u1: fit.u1, u2: fit.u2, u1Bounds: fit.u1Bounds, u2Bounds: fit.u2Bounds };
    checkLimb(coefficients.u1, coefficients.u2);
    return { recipe, coefficients, fit };
  })();
  if (record.spectrum === 'gaia-xp-sampled') {
    const spectrum = readXpSampledSpectrum((await read(record.spectrumPath)).toString('utf8'), record.sourceId);
    return { temperature: null, spectrum: { samples: spectrum.flux.length }, color: xpSampledColor(spectrum.flux, colorMatching, spectrum.fluxError), limbDarkening,
      // The colours of the spectrum one standard error fainter and brighter at every sample, a bound on what the noise can move. A faint
      // red dwarf's bluest samples are within their errors of zero; the fainter spectrum stops at zero there rather than going negative.
      range: [xpSampledColor(spectrum.flux.map((value, i) => Math.max(Number.MIN_VALUE, value - spectrum.fluxError[i]!)), colorMatching),
        xpSampledColor(spectrum.flux.map((value, i) => Math.max(Number.MIN_VALUE, value + spectrum.fluxError[i]!)), colorMatching)] as const };
  }
  if (record.spectrum === 'measured') {
    const spectrum = readMeasuredSpectrum(await read(record.measured.path), record.measured);
    return { temperature: null, spectrum: { samples: spectrum.wavelengthsNm.length }, color: measuredSpectrumColor(spectrum, colorMatching, record.measured.gaps), limbDarkening,
      range: null };
  }
  const temperature = readStellarTemperature((await read(record.temperaturePath)).toString('utf8'), record);
  return { temperature, spectrum: null, color: planckColor(temperature.kelvin, colorMatching), limbDarkening,
    range: [planckColor(temperature.lowerKelvin, colorMatching), planckColor(temperature.upperKelvin, colorMatching)] as const };
}

// A measured, flux-calibrated spectrum from an archive or a published catalogue, read in the file's own layout. Only its shape
// matters: the colour is normalised to its brightest channel, so relative calibration is enough.
// - fits-table: a FITS binary table with one sample per row (CALSPEC, the STIS Next Generation Spectral Library).
// - fits-table-array: a FITS binary table whose one row holds every sample in array cells (X-shooter Spectral Library, LAMOST).
// - tsv-columns: a VizieR ASU tab-separated response with one row per wavelength; the column names come first and any unit or
//   dash rows under them are skipped (Kiehling 1987, Burnashev 1985).
// - pulkovo-blocks: the Pulkovo catalogue's raw flux file (VizieR III/201 table5.dat), blocks of seven stars introduced by their HR
//   numbers, each line a wavelength in nm and the seven fluxes; `flux.column` names the HR number.
// - burnashev-records: the raw file of Burnashev's spectrophotometric compilation (VizieR III/126 part2.dat), one scan per line: a
//   name in bytes 1-19, then from byte 59 pairs of a wavelength in tenths of a nanometre (I4) and log10 of the flux (F9.6), with
//   -9.999999 for no data; `flux.column` is the record number, which is the line number.
// - kharitonov-records: the Alma-Ata catalogue's raw file (VizieR III/202 catalog.dat), one star per line with 88 fluxes (I7) in
//   bytes 80-695, 322.5 to 757.5 nm in 5 nm steps, zero for no data; `flux.column` is the running number, which is the line number.
// - gaia-xp-sampled: a Gaia DataLink XP sampled CSV (readXpSampledSpectrum); `flux.column` is the source id.
// A file stored gzip-compressed, as the archive serves it, is read through gunzip. Photometric scans published as magnitudes are
// read as flux 10^(-0.4 m), and logarithmic fluxes as 10^value. Samples inside 380-780 nm are averaged into 1 nm bins; a
// bin with no sample takes the straight line between neighbours within 5 nm. A longer stretch with no data inside the visible
// range must be declared as a gap, with the reason, or the record fails.
export interface MeasuredSpectrumRecord {
  readonly path: string;
  readonly format: 'fits-table' | 'fits-table-array' | 'tsv-columns' | 'pulkovo-blocks' | 'burnashev-records' | 'kharitonov-records' | 'gaia-xp-sampled';
  /** FITS: the extension name, or its HDU number when it has none. */
  readonly extension?: string;
  readonly wavelength: { readonly column: string; readonly unit: 'angstrom' | 'nm' | 'um' };
  readonly flux: { readonly column: string; readonly kind: 'flux' | 'magnitude' | 'log10'; readonly missing?: number };
  /** FITS rows (or array samples) whose quality value differs from `good` are left out. */
  readonly quality?: { readonly column: string; readonly good: number };
  readonly gaps: readonly { readonly fromNm: number; readonly toNm: number; readonly reason: string }[];
}

const FORMATS = ['fits-table', 'fits-table-array', 'tsv-columns', 'pulkovo-blocks', 'burnashev-records', 'kharitonov-records', 'gaia-xp-sampled'] as const;
export function parseMeasuredSpectrumRecord(value: unknown): MeasuredSpectrumRecord {
  const input = requireRecord(value, 'measuredSpectrum');
  const format = requireString(input.format, 'measuredSpectrum.format');
  if (!(FORMATS as readonly string[]).includes(format)) throw new TypeError(`Unknown measured spectrum format ${format}.`);
  const wavelength = requireRecord(input.wavelength, 'measuredSpectrum.wavelength'), flux = requireRecord(input.flux, 'measuredSpectrum.flux');
  const unit = requireString(wavelength.unit, 'measuredSpectrum.wavelength.unit'), kind = requireString(flux.kind, 'measuredSpectrum.flux.kind');
  if (!['angstrom', 'nm', 'um'].includes(unit)) throw new TypeError(`Unknown wavelength unit ${unit}.`);
  if (!['flux', 'magnitude', 'log10'].includes(kind)) throw new TypeError(`Unknown flux kind ${kind}.`);
  const gaps = (input.gaps === undefined ? [] : input.gaps as unknown[]).map(gap => {
    const record = requireRecord(gap, 'gap'), fromNm = requireFiniteNumber(record.fromNm, 'gap.fromNm'), toNm = requireFiniteNumber(record.toNm, 'gap.toNm');
    if (!(fromNm < toNm)) throw new TypeError('A gap runs from a shorter to a longer wavelength.');
    return { fromNm, toNm, reason: requireString(record.reason, 'gap.reason') };
  });
  const quality = input.quality === undefined ? undefined : requireRecord(input.quality, 'measuredSpectrum.quality');
  if (format.startsWith('fits') && input.extension === undefined) throw new TypeError('A FITS spectrum names its extension.');
  return { path: requireString(input.path, 'measuredSpectrum.path'), format: format as MeasuredSpectrumRecord['format'],
    ...(input.extension === undefined ? {} : { extension: requireString(input.extension, 'measuredSpectrum.extension') }),
    wavelength: { column: requireString(wavelength.column, 'wavelength.column'), unit: unit as MeasuredSpectrumRecord['wavelength']['unit'] },
    flux: { column: requireString(flux.column, 'flux.column'), kind: kind as MeasuredSpectrumRecord['flux']['kind'],
      ...(flux.missing === undefined ? {} : { missing: requireFiniteNumber(flux.missing, 'flux.missing') }) },
    ...(quality ? { quality: { column: requireString(quality.column, 'quality.column'), good: requireFiniteNumber(quality.good, 'quality.good') } } : {}), gaps };
}

const NM_PER_UNIT = { angstrom: 0.1, nm: 1, um: 1000 } as const;

/** Wavelengths (nm, ascending) and flux of the spectrum, in the file's own layout. */
export function readMeasuredSpectrum(stored: Buffer, record: MeasuredSpectrumRecord): { wavelengthsNm: number[]; flux: number[] } {
  const bytes = stored[0] === 0x1f && stored[1] === 0x8b ? gunzipSync(stored) : stored;
  const samples: [number, number][] = [];
  const toFlux = (value: number) => record.flux.kind === 'magnitude' ? 10 ** (-0.4 * value) : record.flux.kind === 'log10' ? 10 ** value : value;
  const add = (wavelength: number, value: number) => {
    if (record.flux.missing !== undefined && value === record.flux.missing) return;
    samples.push([wavelength * NM_PER_UNIT[record.wavelength.unit], toFlux(value)]);
  };
  if (record.format === 'gaia-xp-sampled') {
    // As xpSampledColor does: a sample not above zero but within its noise floor is no emission; one further below fails.
    const { flux, fluxError } = readXpSampledSpectrum(bytes.toString('utf8'), record.flux.column);
    XP_SAMPLED_WAVELENGTHS_NM.forEach((wavelength, i) => {
      const value = flux[i]!;
      if (value <= 0 && !(Math.abs(value) <= NOISE_FLOOR_SIGMA * fluxError[i]!)) throw new TypeError(`The XP sample at ${wavelength} nm is below zero beyond its noise.`);
      add(wavelength, Math.max(0, value));
    });
  } else if (record.format === 'tsv-columns') {
    const lines = bytes.toString('utf8').split(/\r?\n/u).filter(line => line.trim() && !line.startsWith('#'));
    const header = lines[0]!.split('\t').map(name => name.trim());
    const w = header.indexOf(record.wavelength.column), f = header.indexOf(record.flux.column);
    if (w < 0 || f < 0) throw new TypeError(`The table lacks ${record.wavelength.column} or ${record.flux.column}.`);
    for (const line of lines.slice(1)) {
      const cells = line.split('\t'), wavelength = Number(cells[w]), value = Number(cells[f]);
      if (cells[w]!.trim() === '' || !Number.isFinite(wavelength)) continue; // unit and dash rows
      if (cells[f]!.trim() === '') continue;
      add(wavelength, requireFiniteNumber(value, record.flux.column));
    }
  } else if (record.format === 'kharitonov-records') {
    const line = bytes.toString('latin1').split(/\r?\n/u)[Number(record.flux.column) - 1];
    if (!line || Number(line.slice(0, 4)) !== Number(record.flux.column)) throw new TypeError(`The Kharitonov file has no record ${record.flux.column}.`);
    for (let k = 0; k < 88; k++) {
      const cell = line.slice(79 + 7 * k, 86 + 7 * k).trim();
      if (cell) add(322.5 + 5 * k, requireFiniteNumber(Number(cell), 'Kharitonov flux'));
    }
  } else if (record.format === 'burnashev-records') {
    const line = bytes.toString('latin1').split(/\r?\n/u)[Number(record.flux.column) - 1];
    if (!line) throw new TypeError(`The Burnashev file has no record ${record.flux.column}.`);
    for (let offset = 58; offset + 13 <= line.length; offset += 13) {
      const wavelength = line.slice(offset, offset + 4).trim(), value = line.slice(offset + 4, offset + 13).trim();
      if (!wavelength) continue;
      add(requireFiniteNumber(Number(wavelength), 'Burnashev wavelength'), requireFiniteNumber(Number(value), 'Burnashev flux'));
    }
  } else if (record.format === 'pulkovo-blocks') {
    let column = -1;
    for (const line of bytes.toString('latin1').split(/\r?\n/u)) {
      const fields = line.trim().split(/\s+/u).filter(Boolean);
      if (!fields.length) continue;
      if (/^ {8}/u.test(line)) { column = fields.indexOf(record.flux.column); continue; }
      if (column < 0) continue;
      if (fields.length < column + 2) throw new TypeError(`A Pulkovo flux line is short: ${line}`);
      add(requireFiniteNumber(Number(fields[0]), 'Pulkovo wavelength'), requireFiniteNumber(Number(fields[column + 1]), 'Pulkovo flux'));
    }
  } else {
    // An unnamed extension is named by its HDU number (the primary HDU is 0).
    const hdus = readFitsHdus(bytes), hdu = /^\d+$/u.test(record.extension!) ? hdus[Number(record.extension)] : hdus.find(item => item.extname === record.extension);
    if (!hdu) throw new TypeError(`The FITS file has no ${record.extension ?? '(unnamed)'} extension.`);
    const table = binaryTable(hdu), wavelength = tableColumn(table, record.wavelength.column), flux = tableColumn(table, record.flux.column);
    const quality = record.quality ? tableColumn(table, record.quality.column) : undefined;
    if (record.format === 'fits-table-array') {
      if (table.rows !== 1) throw new TypeError('An array spectrum holds its samples in one row.');
      const w = numbers(bytes, table, 0, wavelength), f = numbers(bytes, table, 0, flux), q = quality ? numbers(bytes, table, 0, quality) : undefined;
      if (w.length !== f.length) throw new TypeError('The wavelength and flux arrays differ in length.');
      w.forEach((value, i) => { if (!q || q[i] === record.quality!.good) add(value, f[i]!); });
    } else {
      for (let row = 0; row < table.rows; row++) {
        if (quality && numbers(bytes, table, row, quality)[0] !== record.quality!.good) continue;
        add(numbers(bytes, table, row, wavelength)[0]!, numbers(bytes, table, row, flux)[0]!);
      }
    }
  }
  const finite = samples.filter(([w, f]) => Number.isFinite(w) && Number.isFinite(f)).sort((a, b) => a[0] - b[0]);
  if (finite.length < 2) throw new TypeError('The spectrum has fewer than two samples.');
  return { wavelengthsNm: finite.map(sample => sample[0]), flux: finite.map(sample => sample[1]) };
}

/** Samples averaged into 1 nm bins from 380 to 780 nm; a bin without samples is interpolated from its neighbours, which must lie
 * within 5 nm unless the bin is inside a declared gap. The ends extend only through a declared gap. */
export function binMeasuredSpectrum(spectrum: { wavelengthsNm: readonly number[]; flux: readonly number[] }, gaps: MeasuredSpectrumRecord['gaps'] = []) {
  const wavelengths = Array.from({ length: 401 }, (_, i) => 380 + i), inGap = (w: number) => gaps.some(gap => w >= gap.fromNm && w <= gap.toNm);
  const { wavelengthsNm: w, flux: f } = spectrum, binned = new Map<number, number>();
  for (const centre of wavelengths) {
    let sum = 0, count = 0;
    for (let i = 0; i < w.length; i++) if (w[i]! >= centre - 0.5 && w[i]! < centre + 0.5) { sum += f[i]!; count++; }
    if (count) binned.set(centre, sum / count);
  }
  return wavelengths.map(centre => {
    const value = binned.get(centre);
    if (value !== undefined) return value;
    const after = w.findIndex(value => value >= centre), before = after - 1;
    const near = (index: number) => index >= 0 && index < w.length && Math.abs(w[index]! - centre) <= 5;
    if (near(before) && near(after)) return f[before]! + (f[after]! - f[before]!) * (centre - w[before]!) / (w[after]! - w[before]!);
    if (!inGap(centre)) throw new TypeError(`The spectrum has no sample near ${centre} nm and no declared gap there.`);
    if (before >= 0 && after >= 0 && after < w.length) return f[before]! + (f[after]! - f[before]!) * (centre - w[before]!) / (w[after]! - w[before]!);
    return after < 0 || after >= w.length ? f[w.length - 1]! : f[0]!;
  });
}

export function measuredSpectrumColor(spectrum: { wavelengthsNm: readonly number[]; flux: readonly number[] }, colorMatching: Map<number, readonly number[]>,
  gaps: MeasuredSpectrumRecord['gaps'] = []): StellarColor {
  const binned = binMeasuredSpectrum(spectrum, gaps);
  if (binned.some(value => !(value >= 0)) || !binned.some(value => value > 0)) throw new TypeError('The measured spectrum must be positive across the visible range, or zero where a faint star is not detected.');
  return spectrumColor(binned.map((_, i) => 380 + i), wavelength => binned[wavelength - 380]!, colorMatching, 'The measured spectrum colour');
}

// Limb darkening measured from a transiting planet: the planet crosses the disc and the depth of the transit at each point measures
// the star's intensity there. A quadratic law gives I(mu) / I(1) = 1 - u1 (1 - mu) - u2 (1 - mu)^2, with mu the cosine of the angle
// from the disc centre. The emissive route draws it as a limb plate: black, fitted edge to edge to the sphere's outline and composited
// over it, so its alpha scales the displayed colour. Compositing happens on sRGB-encoded values, so the alpha is chosen for the
// displayed luminance of the photosphere colour at each intensity ratio, not the linear ratio itself.
export type LimbDarkeningRecipe = {
  readonly law: 'quadratic'; readonly source: 'table'; readonly path: string; readonly star: string;
  readonly columns: { readonly u1: string; readonly u2: string; readonly u1Upper: string; readonly u1Lower: string; readonly u2Upper: string; readonly u2Lower: string };
} | {
  /** Fitted here to the planet's transits in pinned TESS light curves (tools/objects/eclipse-map/transit-limb-darkening.mts). */
  readonly law: 'quadratic'; readonly source: 'tess-transits'; readonly planet: string; readonly lightCurves: readonly string[];
} | {
  /** Coefficients published in a paper's text or table (no machine-readable input): a transcription record at `path`
   * holds each value, uncertainty, quoted cell and whether it is a fit or a theoretical model prior. */
  readonly law: 'quadratic'; readonly source: 'published'; readonly path: string;
} | {
  /** A theoretical grid by effective temperature and surface gravity (a VizieR table of model-atmosphere coefficients), for a
   * star no measurement covers: bilinear between the four grid nodes around the star's own temperature and gravity, among the
   * rows whose model columns match `models`. */
  readonly law: 'quadratic'; readonly source: 'grid'; readonly path: string; readonly teffK: number; readonly logg: number;
  readonly models: Readonly<Record<string, string>>; readonly columns: { readonly teff: string; readonly logg: string; readonly u1: string; readonly u2: string };
};
export interface QuadraticLimbDarkening { readonly u1: number; readonly u2: number; readonly u1Bounds: readonly [number, number]; readonly u2Bounds: readonly [number, number]; readonly basis?: 'transit-fit' | 'model-prior' }

export function parseLimbDarkeningRecipe(value: unknown): LimbDarkeningRecipe {
  const input = requireRecord(value, 'limbDarkening');
  if (input.law !== 'quadratic') throw new TypeError('Limb darkening must name the quadratic law.');
  if (input.transits !== undefined) {
    const transits = requireRecord(input.transits, 'limbDarkening.transits');
    if (input.path !== undefined || input.columns !== undefined || !Array.isArray(transits.lightCurves) || !transits.lightCurves.length) {
      throw new TypeError('Limb darkening fitted to transits names its planet and light curves, and no table.');
    }
    return { law: 'quadratic', source: 'tess-transits', planet: requireString(transits.planet, 'limbDarkening.transits.planet'),
      lightCurves: transits.lightCurves.map((path, i) => requireString(path, `limbDarkening.transits.lightCurves.${i}`)) };
  }
  if (input.published !== undefined) {
    if (input.published !== true || input.columns !== undefined) throw new TypeError('Published limb darkening names its transcription record and no table columns.');
    return { law: 'quadratic', source: 'published', path: requireString(input.path, 'limbDarkening.path') };
  }
  const columns = requireRecord(input.columns, 'limbDarkening.columns');
  const column = (name: string) => requireString(columns[name], `limbDarkening.columns.${name}`);
  if (input.grid !== undefined) {
    const grid = requireRecord(input.grid, 'limbDarkening.grid'), models = requireRecord(grid.models, 'limbDarkening.grid.models');
    return { law: 'quadratic', source: 'grid', path: requireString(input.path, 'limbDarkening.path'), teffK: requireFiniteNumber(grid.teffK, 'limbDarkening.grid.teffK'),
      logg: requireFiniteNumber(grid.logg, 'limbDarkening.grid.logg'), models: Object.fromEntries(Object.entries(models).map(([key, value]) => [key, requireString(value)])),
      columns: { teff: column('teff'), logg: column('logg'), u1: column('u1'), u2: column('u2') } };
  }
  return { law: 'quadratic', source: 'table', path: requireString(input.path, 'limbDarkening.path'), star: requireString(input.star, 'limbDarkening.star'),
    columns: { u1: column('u1'), u2: column('u2'), u1Upper: column('u1Upper'), u1Lower: column('u1Lower'), u2Upper: column('u2Upper'), u2Lower: column('u2Lower') } };
}

/** The coefficients for one star from a VizieR tab-separated table: a header row, a dashed rule, then data rows. Upper and lower
 * columns are distances from the value (68% credibility), as the catalogue gives them. */
export function readQuadraticLimbDarkening(tsv: string, recipe: Extract<LimbDarkeningRecipe, { source: 'table' }>): QuadraticLimbDarkening {
  const lines = tsv.split(/\r?\n/u).filter(line => line.trim() && !/^-+(\t-+)*$/u.test(line.trim()));
  const [header, ...rows] = lines.map(line => line.split('\t').map(cell => cell.trim()));
  if (!header) throw new TypeError('The limb-darkening table is empty.');
  const index = (name: string) => { const i = header.indexOf(name); if (i < 0) throw new TypeError(`The limb-darkening table lacks ${name}.`); return i; };
  const matches = rows.filter(row => row[index('Name')] === recipe.star);
  if (matches.length !== 1) throw new TypeError(`The limb-darkening table must hold exactly one row for ${recipe.star}.`);
  const read = (name: string) => requireFiniteNumber(Number(matches[0]![index(name)]), name);
  const u1 = read(recipe.columns.u1), u2 = read(recipe.columns.u2);
  const coefficients = { u1, u2, u1Bounds: [u1 - read(recipe.columns.u1Lower), u1 + read(recipe.columns.u1Upper)] as const, u2Bounds: [u2 - read(recipe.columns.u2Lower), u2 + read(recipe.columns.u2Upper)] as const };
  checkLimb(u1, u2);
  return coefficients;
}

/** Bilinear between the four grid nodes around the star; the bounds are the spread of the four nodes. */
export function interpolateQuadraticLimbDarkening(tsv: string, recipe: Extract<LimbDarkeningRecipe, { source: 'grid' }>): QuadraticLimbDarkening {
  const lines = tsv.split(/\r?\n/u).filter(line => line.trim() && !line.startsWith('#') && !/^-+(\t-+)*$/u.test(line.trim()));
  const [header, , ...rows] = lines.map(line => line.split('\t').map(cell => cell.trim()));
  if (!header) throw new TypeError('The limb-darkening grid is empty.');
  const index = (name: string) => { const i = header.indexOf(name); if (i < 0) throw new TypeError(`The limb-darkening grid lacks ${name}.`); return i; };
  const nodes = rows.filter(row => Object.entries(recipe.models).every(([key, value]) => row[index(key)] === value))
    .map(row => ({ teff: Number(row[index(recipe.columns.teff)]), logg: Number(row[index(recipe.columns.logg)]), u1: Number(row[index(recipe.columns.u1)]), u2: Number(row[index(recipe.columns.u2)]) }));
  const teffs = [...new Set(nodes.map(node => node.teff))].sort((a, b) => a - b), loggs = [...new Set(nodes.map(node => node.logg))].sort((a, b) => a - b);
  // The two nodes around the value; a value on a node, the first one included, is inside the grid.
  const bracket = (values: number[], value: number) => {
    const lo = values.findIndex((v, i) => v <= value && i + 1 < values.length && values[i + 1]! >= value);
    if (lo < 0) throw new RangeError(`${value} is outside the grid ${values.join(', ')}.`);
    return [values[lo]!, values[lo + 1]!] as const;
  };
  const [t0, t1] = bracket(teffs, recipe.teffK), [g0, g1] = bracket(loggs, recipe.logg), ft = (recipe.teffK - t0) / (t1 - t0), fg = (recipe.logg - g0) / (g1 - g0);
  const node = (t: number, g: number) => { const found = nodes.filter(n => n.teff === t && n.logg === g); if (found.length !== 1) throw new TypeError(`The grid must hold exactly one node at ${t} K, log g ${g}.`); return found[0]!; };
  const corners = [node(t0, g0), node(t1, g0), node(t0, g1), node(t1, g1)], weights = [(1 - ft) * (1 - fg), ft * (1 - fg), (1 - ft) * fg, ft * fg];
  const at = (key: 'u1' | 'u2') => corners.reduce((total, corner, k) => total + corner[key] * weights[k]!, 0);
  const u1 = at('u1'), u2 = at('u2');
  checkLimb(u1, u2);
  return { u1, u2, u1Bounds: [Math.min(...corners.map(c => c.u1)), Math.max(...corners.map(c => c.u1))], u2Bounds: [Math.min(...corners.map(c => c.u2)), Math.max(...corners.map(c => c.u2))] };
}
/** A transcription record (cssearth-published-limb-darkening@1): u1 and u2 with their one-sigma uncertainties, the band, the
 * source and the quoted cells. A coefficient the paper fixed to a model says so in `fixed`, and carries no uncertainty. */
export function readPublishedLimbDarkening(value: unknown): QuadraticLimbDarkening {
  const record = requireRecord(value, 'published limb darkening');
  if (record.schema !== 'cssearth-published-limb-darkening@1') throw new TypeError('Published limb darkening must use cssearth-published-limb-darkening@1.');
  requireString(record.source, 'source'); requireString(record.band, 'band');
  if (record.basis !== undefined && record.basis !== 'transit-fit' && record.basis !== 'model-prior') throw new TypeError('Published limb-darkening basis must be transit-fit or model-prior.');
  const coefficient = (key: 'u1' | 'u2') => {
    const entry = requireRecord(record[key], key), value = requireFiniteNumber(entry.value, `${key}.value`);
    if (entry.fixed !== undefined) { requireString(entry.fixed, `${key}.fixed`); return { value, bounds: [value, value] as const }; }
    const sigma = requireFiniteNumber(entry.uncertainty, `${key}.uncertainty`); requireString(entry.cell, `${key}.cell`);
    return { value, bounds: [value - sigma, value + sigma] as const };
  };
  const u1 = coefficient('u1'), u2 = coefficient('u2');
  checkLimb(u1.value, u2.value);
  return { u1: u1.value, u2: u2.value, u1Bounds: u1.bounds, u2Bounds: u2.bounds,
    ...(record.basis === undefined ? {} : { basis: record.basis }) };
}

function checkLimb(u1: number, u2: number) {
  if (!(quadraticIntensity(0, u1, u2) >= 0 && quadraticIntensity(0, u1, u2) <= 1)) throw new TypeError('The limb-darkening law must keep the limb between dark and the centre brightness.');
}

export const quadraticIntensity = (mu: number, u1: number, u2: number) => 1 - u1 * (1 - mu) - u2 * (1 - mu) ** 2;

const SRGB_LUMINANCE = [0.2126, 0.7152, 0.0722] as const;
const BAYER_4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(value => (value + 0.5) / 16);
const displayedLuminance = (linear: readonly number[]) => linear.reduce((sum, value, channel) => sum + SRGB_LUMINANCE[channel]! * linearToSrgb(value), 0);

/** A square RGBA limb plate `size` texels across whose disc fills it edge to edge: black, with alpha such that the photosphere colour
 * under it shows the displayed luminance of the colour dimmed by I(mu) / I(1), dithered to within one 8-bit step. Outside the disc it
 * is transparent. */
export function limbDarkeningPlate(size: number, coefficients: Pick<QuadraticLimbDarkening, 'u1' | 'u2'>, color: StellarColor) {
  const data = new Uint8Array(size * size * 4), centre = size / 2, full = displayedLuminance(color.linear);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const radial = Math.hypot(x + 0.5 - centre, y + 0.5 - centre) / centre;
    if (radial > 1) continue;
    const ratio = Math.max(0, quadraticIntensity(Math.sqrt(1 - radial * radial), coefficients.u1, coefficients.u2));
    const shown = displayedLuminance(color.linear.map(value => value * ratio)) / full;
    // A fixed ordered dither (4 x 4 Bayer) keeps the 8-bit alpha from banding when the plate is stretched over a close-up disc; it moves
    // no texel by more than one step from the exact value.
    data[(y * size + x) * 4 + 3] = Math.max(0, Math.min(255, Math.floor((1 - shown) * 255 + BAYER_4[(y % 4) * 4 + (x % 4)]!)));
  }
  return { data, size, lossless: true };
}
