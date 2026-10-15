import { requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';

export const STELLAR_PHOTOMETRIC_COLOR_SCHEMA = 'cssearth-stellar-photometric-color@1';

export type StellarColorRecord = {
  readonly spectrum: 'planck'; readonly temperaturePath: string; readonly sourceId: string;
  readonly columns: { readonly value: string; readonly lower: string; readonly upper: string };
} | {
  /** A star with no catalogue row of its own (the unresolved second star of a close pair): the temperature its paper publishes. */
  readonly spectrum: 'planck'; readonly published: StellarTemperature & { readonly citation: string }; readonly gamut?: 'desaturate';
} | { readonly spectrum: 'gaia-xp-sampled'; readonly spectrumPath: string; readonly sourceId: string }
  | { readonly spectrum: 'measured'; readonly measured: MeasuredSpectrumRecord; readonly gamut?: 'desaturate' }
  | {
    /** The display color a paper publishes for this star, computed from its spectrum the way the others here are (CIE 1931 2°
     * observer, sRGB D65, brightest linear channel 1, 8-bit), with the CIE 1931 chromaticity the paper gives beside it. */
    readonly spectrum: 'published-color'; readonly published: PublishedStellarColor };
export interface PublishedStellarColor { readonly hex: string; readonly chromaticity: { readonly x: number; readonly y: number }; readonly citation: string }
export interface StellarTemperature { readonly kelvin: number; readonly lowerKelvin: number; readonly upperKelvin: number }
export function parseStellarColorRecord(value: unknown): StellarColorRecord {
  const input = requireRecord(value, 'stellar color record');
  if (input.schema !== STELLAR_PHOTOMETRIC_COLOR_SCHEMA) throw new TypeError(`The stellar color record must use ${STELLAR_PHOTOMETRIC_COLOR_SCHEMA}.`);
  const integer = (id: string) => { if (!/^\d+$/u.test(id)) throw new TypeError('The catalogue source id must be an integer string.'); return id; };
  if (input.spectrum === 'published-color') {
    if (input.temperature !== undefined) throw new TypeError('A published color takes no temperature.');
    const published = requireRecord(input.publishedColor, 'publishedColor'), chromaticity = requireRecord(published.chromaticity, 'publishedColor.chromaticity');
    const hex = requireString(published.hex, 'publishedColor.hex'), citation = requireString(published.citation, 'publishedColor.citation');
    if (!/^#[0-9a-f]{6}$/iu.test(hex)) throw new TypeError(`A published color is a six-digit sRGB hex, not ${hex}.`);
    // The colors here are scaled so the brightest channel is full; a color scaled otherwise would be a different brightness, not this one.
    if (Math.max(...[1, 3, 5].map(at => parseInt(hex.slice(at, at + 2), 16))) !== 255) throw new TypeError(`The published color ${hex} must have its brightest channel at FF.`);
    const x = requireFiniteNumber(chromaticity.x, 'publishedColor.chromaticity.x'), y = requireFiniteNumber(chromaticity.y, 'publishedColor.chromaticity.y');
    if (!(x > 0 && y > 0 && x + y < 1)) throw new TypeError(`The chromaticity (${x}, ${y}) is not a color.`);
    if (!/https?:\/\//u.test(citation)) throw new TypeError(`The published color ${hex} names its paper by URL, not "${citation}".`);
    return { spectrum: 'published-color', published: { hex: hex.toLowerCase(), chromaticity: { x, y }, citation } };
  }
  if (input.spectrum === 'measured') {
    if (input.temperature !== undefined) throw new TypeError('A color from a measured spectrum takes no temperature.');
    if (input.gamut !== undefined && input.gamut !== 'desaturate') throw new TypeError(`A color record's gamut mapping is 'desaturate', not ${String(input.gamut)}.`);
    return { spectrum: 'measured', measured: parseMeasuredSpectrumRecord(input.measuredSpectrum), ...(input.gamut === 'desaturate' ? { gamut: 'desaturate' as const } : {}) };
  }
  if (input.spectrum === 'gaia-xp-sampled') {
    if (input.temperature !== undefined) throw new TypeError('A color from a measured spectrum takes no temperature.');
    const spectrum = requireRecord(input.sampledSpectrum, 'sampledSpectrum');
    return { spectrum: 'gaia-xp-sampled', spectrumPath: requireString(spectrum.path, 'sampledSpectrum.path'), sourceId: integer(requireString(spectrum.sourceId, 'sampledSpectrum.sourceId')) };
  }
  const temperature = requireRecord(input.temperature, 'temperature');
  if (input.spectrum !== 'planck') throw new TypeError('The stellar color record must name the Planck spectrum, a measured spectrum or a published color.');
  if (temperature.published !== undefined) {
    const published = requireRecord(temperature.published, 'temperature.published');
    const bounds = { kelvin: requireFiniteNumber(published.kelvin, 'temperature.published.kelvin'), lowerKelvin: requireFiniteNumber(published.lowerKelvin, 'temperature.published.lowerKelvin'),
      upperKelvin: requireFiniteNumber(published.upperKelvin, 'temperature.published.upperKelvin') };
    checkStellarTemperature(bounds, `published temperature ${bounds.kelvin} K (${bounds.lowerKelvin} to ${bounds.upperKelvin})`);
    const citation = requireString(published.citation, 'temperature.published.citation');
    if (!/https?:\/\//u.test(citation)) throw new TypeError(`The published temperature ${bounds.kelvin} K names its paper by URL, not "${citation}".`);
    if (input.gamut !== undefined && input.gamut !== 'desaturate') throw new TypeError(`A color record's gamut mapping is 'desaturate', not ${String(input.gamut)}.`);
    return { spectrum: 'planck', published: { ...bounds, citation }, ...(input.gamut === 'desaturate' ? { gamut: 'desaturate' as const } : {}) };
  }
  const sourceId = integer(requireString(temperature.sourceId, 'temperature.sourceId'));
  return { spectrum: 'planck', temperaturePath: requireString(temperature.path, 'temperature.path'), sourceId,
    columns: { value: requireString(temperature.column, 'temperature.column'), lower: requireString(temperature.lowerColumn, 'temperature.lowerColumn'),
      upper: requireString(temperature.upperColumn, 'temperature.upperColumn') } };
}

/** The coolest black body a color is drawn from. Cooler than this, it gives off almost no visible light, so a body's visible
 * color is its reflected light, not its glow (a planet's dayside at 938 K, WASP-8 b, takes its host's light instead). */
export const PLANCK_FLOOR_KELVIN = 1000;

/** Read the temperature and its bounds from the archived catalogue row, by source id. */
export function checkStellarTemperature(temperature: StellarTemperature, label: string): void {
  if (!(temperature.kelvin > PLANCK_FLOOR_KELVIN && temperature.lowerKelvin <= temperature.kelvin && temperature.kelvin <= temperature.upperKelvin)) {
    throw new TypeError(`The ${label} must be a stellar temperature inside its bounds.`);
  }
}

export interface MeasuredSpectrumRecord {
  readonly path: string;
  readonly format: 'fits-table' | 'fits-table-array' | 'tsv-columns' | 'ascii-columns' | 'pulkovo-blocks' | 'burnashev-records' | 'kharitonov-records' | 'gaia-xp-sampled';
  /** FITS: the extension name, or its HDU number when it has none. */
  readonly extension?: string;
  readonly wavelength: { readonly column: string; readonly unit: 'angstrom' | 'nm' | 'um' };
  /** `error` (ascii-columns): the column of each sample's one-sigma flux error. With it, a 1 nm bin below zero within its noise reads as
   * no emission, as an XP sample does, and the report carries the colors one sigma fainter and brighter. */
  readonly flux: { readonly column: string; readonly kind: 'flux' | 'magnitude' | 'log10'; readonly missing?: number; readonly error?: string };
  /** FITS rows (or array samples) whose quality value differs from `good` are left out. */
  readonly quality?: { readonly column: string; readonly good: number };
  readonly gaps: readonly { readonly fromNm: number; readonly toNm: number; readonly reason: string }[];
  /** A spectrograph that splits the visible between arms, each in its own file of the same layout: `path` is used below `nm` and this
   * file from `nm` up. Where the arms overlap, their median flux within 5 nm of the join must agree to JOIN_AGREEMENT. */
  readonly join?: { readonly path: string; readonly nm: number; readonly reason: string };
}

const FORMATS = ['fits-table', 'fits-table-array', 'tsv-columns', 'ascii-columns', 'pulkovo-blocks', 'burnashev-records', 'kharitonov-records', 'gaia-xp-sampled'] as const;
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
  if (flux.error !== undefined && format !== 'ascii-columns') throw new TypeError(`A flux error column is read from ascii-columns spectra, not ${format}.`);
  return { path: requireString(input.path, 'measuredSpectrum.path'), format: format as MeasuredSpectrumRecord['format'],
    ...(input.extension === undefined ? {} : { extension: requireString(input.extension, 'measuredSpectrum.extension') }),
    wavelength: { column: requireString(wavelength.column, 'wavelength.column'), unit: unit as MeasuredSpectrumRecord['wavelength']['unit'] },
    flux: { column: requireString(flux.column, 'flux.column'), kind: kind as MeasuredSpectrumRecord['flux']['kind'],
      ...(flux.missing === undefined ? {} : { missing: requireFiniteNumber(flux.missing, 'flux.missing') }),
      ...(flux.error === undefined ? {} : { error: requireString(flux.error, 'flux.error') }) },
    ...(quality ? { quality: { column: requireString(quality.column, 'quality.column'), good: requireFiniteNumber(quality.good, 'quality.good') } } : {}), gaps,
    ...(input.join === undefined ? {} : (() => {
      const join = requireRecord(input.join, 'measuredSpectrum.join');
      return { join: { path: requireString(join.path, 'measuredSpectrum.join.path'), nm: requireFiniteNumber(join.nm, 'measuredSpectrum.join.nm'), reason: requireString(join.reason, 'measuredSpectrum.join.reason') } };
    })()) };
}
