import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';

export const DISC_INTEGRATED_COLOR_SCHEMA = 'cssearth-disc-integrated-color@1';

const BANDS = ['B', 'V', 'R', 'I'] as const;
type Band = typeof BANDS[number];
const INDICES = ['B-V', 'V-R', 'V-I'] as const;

/** Color indices against the Sun's: reflectance at four filters. */
export interface DiscColorIndices {
  readonly colorIndices: Readonly<Record<typeof INDICES[number], number>>;
  readonly solarColorIndices: Readonly<Record<typeof INDICES[number], number>>;
  readonly effectiveWavelengthsNm: Readonly<Record<Band, number>>;
  readonly geometricAlbedo: number;
}
/** A published reflectance spectrum, as [wavelength in nm, reflectance] rescaled to 1 at the wavelength it names for V. */
export interface DiscReflectanceSpectrum {
  readonly reflectance: readonly (readonly [number, number])[];
  readonly geometricAlbedo: number;
}
export type DiscColorRecord = DiscColorIndices | DiscReflectanceSpectrum;

const measured = (value: unknown, label: string) => requireFiniteNumber(requireRecord(value, label).value, `${label}.value`);

/** Validate the cited record down to the numbers the method consumes. */
export function parseDiscColor(value: unknown, policy?: { acceptance: 'color' }): DiscColorRecord;
export function parseDiscColor(value: unknown, policy: { acceptance: 'photometry' }): DiscColorPhotometry;
export function parseDiscColor(value: unknown, policy: { acceptance: 'color' | 'photometry' } = { acceptance: 'color' }): DiscColorRecord | DiscColorPhotometry {
  const photometry = policy.acceptance === 'photometry';
  const input = requireRecord(value, photometry ? 'photometry member' : 'disc color record');
  if (input.schema !== DISC_INTEGRATED_COLOR_SCHEMA) throw new TypeError(photometry
    ? 'The public photometry executor currently supports the pinned disc-integrated-color schema.'
    : `The disc color record must use ${DISC_INTEGRATED_COLOR_SCHEMA}.`);
  if (photometry) {
    const object = requireRecord;
    const source = input;
    const albedo = object(source.geometricAlbedo, 'geometricAlbedo'), body = object(source.object, 'object');
    const waves = object(object(source.effectiveWavelengths, 'effectiveWavelengths').nanometres, 'effective wavelengths');
    const band = String(albedo.band);
    return { band, system: String(body.system), effectiveWavelength: Number(waves[band]), value: Number(albedo.value), uncertainty: Number(albedo.uncertainty) };
  }
  const geometricAlbedo = measured(requireRecord(input.geometricAlbedo, 'geometricAlbedo'), 'geometricAlbedo');
  if (requireString(requireRecord(input.geometricAlbedo).band, 'geometricAlbedo.band') !== 'V' || !(geometricAlbedo > 0 && geometricAlbedo <= 1)) {
    throw new TypeError('The geometric albedo must be a V-band value in (0, 1].');
  }
  const spectrum = requireRecord(input.object, 'object').reflectance;
  if (spectrum !== undefined) return { reflectance: reflectanceSpectrum(spectrum), geometricAlbedo };
  const indices = (record: unknown, label: string) => {
    const values = requireRecord(requireRecord(record, label).indices, `${label}.indices`);
    return Object.fromEntries(INDICES.map(name => [name, measured(values[name], `${label}.indices.${name}`)])) as Record<typeof INDICES[number], number>;
  };
  const wavelengths = requireRecord(requireRecord(input.effectiveWavelengths, 'effectiveWavelengths').nanometres, 'effectiveWavelengths.nanometres');
  const effectiveWavelengthsNm = Object.fromEntries(BANDS.map(band => [band, requireFiniteNumber(wavelengths[band], `effective wavelength ${band}`)])) as Record<Band, number>;
  if (BANDS.some((band, index) => index > 0 && !(effectiveWavelengthsNm[band] > effectiveWavelengthsNm[BANDS[index - 1]!]))) {
    throw new TypeError('Filter effective wavelengths must increase from B to I.');
  }
  return { colorIndices: indices(input.object, 'object'), solarColorIndices: indices(input.sun, 'sun'), effectiveWavelengthsNm, geometricAlbedo };
}

/** The V band the albedo is scaled at lies between these wavelengths. */
const V_BAND_NM = [530, 570] as const;

/** `object.reflectance`: samples in rising wavelength, rescaled so the spectrum is 1 at `normalizedAtNm`. */
function reflectanceSpectrum(value: unknown): DiscReflectanceSpectrum['reflectance'] {
  const spectrum = requireRecord(value, 'object.reflectance'), at = requireFiniteNumber(spectrum.normalizedAtNm, 'object.reflectance.normalizedAtNm');
  const points = requireArray(spectrum.samples, 'object.reflectance.samples').map((sample, index) => {
    const entry = requireRecord(sample, `object.reflectance.samples[${index}]`);
    return [requireFiniteNumber(entry.wavelengthNm, `reflectance sample ${index} wavelength`), requireFiniteNumber(entry.value, `reflectance sample ${index} value`)] as const;
  });
  if (points.length < 2) throw new TypeError('A reflectance spectrum needs at least two samples.');
  if (points.some(([wavelength, reflectance], index) => !(reflectance > 0) || (index > 0 && !(wavelength > points[index - 1]![0])))) {
    throw new TypeError('Reflectance samples must be positive and rise in wavelength.');
  }
  if (!(at >= V_BAND_NM[0] && at <= V_BAND_NM[1]) || at < points[0]![0] || at > points[points.length - 1]![0]) {
    throw new TypeError('A reflectance spectrum is normalized inside the V band and inside its own samples.');
  }
  const upper = points.findIndex(([wavelength]) => wavelength >= at), [high, low] = [points[upper]!, points[Math.max(0, upper - 1)]!];
  const unit = high[0] === low[0] ? high[1] : low[1] + (high[1] - low[1]) * (at - low[0]) / (high[0] - low[0]);
  return points.map(([wavelength, reflectance]) => [wavelength, reflectance / unit] as const);
}

/** Public photometry historically consumes only this subset, including numeric coercion.
 * It does not require the color indices or V-band constraints of the color compiler. */
export interface DiscColorPhotometry { band: string; system: string; effectiveWavelength: number; value: number; uncertainty: number }
export const parseDiscColorRecord = (value: unknown): DiscColorRecord => parseDiscColor(value);
export const parseDiscColorPhotometry = (value: unknown): DiscColorPhotometry => parseDiscColor(value, { acceptance: 'photometry' });
