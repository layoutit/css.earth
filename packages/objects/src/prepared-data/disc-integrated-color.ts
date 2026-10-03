import { requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';

export const DISC_INTEGRATED_COLOR_SCHEMA = 'cssearth-disc-integrated-color@1';

const BANDS = ['B', 'V', 'R', 'I'] as const;
type Band = typeof BANDS[number];
const INDICES = ['B-V', 'V-R', 'V-I'] as const;

export interface DiscColorRecord {
  readonly colorIndices: Readonly<Record<typeof INDICES[number], number>>;
  readonly solarColorIndices: Readonly<Record<typeof INDICES[number], number>>;
  readonly effectiveWavelengthsNm: Readonly<Record<Band, number>>;
  readonly geometricAlbedo: number;
}

const measured = (value: unknown, label: string) => requireFiniteNumber(requireRecord(value, label).value, `${label}.value`);

/** Validate the cited record down to the numbers the method consumes. */
export function parseDiscColorRecord(value: unknown): DiscColorRecord {
  const input = requireRecord(value, 'disc color record');
  if (input.schema !== DISC_INTEGRATED_COLOR_SCHEMA) throw new TypeError(`The disc color record must use ${DISC_INTEGRATED_COLOR_SCHEMA}.`);
  const indices = (record: unknown, label: string) => {
    const values = requireRecord(requireRecord(record, label).indices, `${label}.indices`);
    return Object.fromEntries(INDICES.map(name => [name, measured(values[name], `${label}.indices.${name}`)])) as Record<typeof INDICES[number], number>;
  };
  const wavelengths = requireRecord(requireRecord(input.effectiveWavelengths, 'effectiveWavelengths').nanometres, 'effectiveWavelengths.nanometres');
  const effectiveWavelengthsNm = Object.fromEntries(BANDS.map(band => [band, requireFiniteNumber(wavelengths[band], `effective wavelength ${band}`)])) as Record<Band, number>;
  if (BANDS.some((band, index) => index > 0 && !(effectiveWavelengthsNm[band] > effectiveWavelengthsNm[BANDS[index - 1]!]))) {
    throw new TypeError('Filter effective wavelengths must increase from B to I.');
  }
  const geometricAlbedo = measured(requireRecord(input.geometricAlbedo, 'geometricAlbedo'), 'geometricAlbedo');
  if (requireString(requireRecord(input.geometricAlbedo).band, 'geometricAlbedo.band') !== 'V' || !(geometricAlbedo > 0 && geometricAlbedo <= 1)) {
    throw new TypeError('The geometric albedo must be a V-band value in (0, 1].');
  }
  return { colorIndices: indices(input.object, 'object'), solarColorIndices: indices(input.sun, 'sun'), effectiveWavelengthsNm, geometricAlbedo };
}

/** Public photometry historically consumes only this subset, including numeric coercion.
 * It does not require the color indices or V-band constraints of the color compiler. */
export interface DiscColorPhotometry { band: string; system: string; effectiveWavelength: number; value: number; uncertainty: number }
export function parseDiscColorPhotometry(value: unknown): DiscColorPhotometry {
  const object = (value: unknown, label: string) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
    return value as Record<string, unknown>;
  };
  const source = object(value, 'photometry member');
  if (source.schema !== DISC_INTEGRATED_COLOR_SCHEMA) throw new TypeError('The public photometry executor currently supports the pinned disc-integrated-color schema.');
  const albedo = object(source.geometricAlbedo, 'geometricAlbedo'), body = object(source.object, 'object');
  const waves = object(object(source.effectiveWavelengths, 'effectiveWavelengths').nanometres, 'effective wavelengths');
  const band = String(albedo.band);
  return { band, system: String(body.system), effectiveWavelength: Number(waves[band]), value: Number(albedo.value), uncertainty: Number(albedo.uncertainty) };
}
