// A uniform false colour for an unresolved body from published photometry in three infrared bands: each band's measured flux
// density drives one display channel, longest wavelength red and shortest blue, through one common range shared by every body
// the range names, so band ratios and the bodies' relative brightness survive. It is not a natural colour and not a map.
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';
import { bandColorByte, bandColorDisplay, type BandColorDisplay } from '../color-transfer.mts';

export const DISC_BAND_COLOR_SCHEMA = 'cssearth-disc-band-color@1';

export interface DiscBand { readonly band: string; readonly wavelengthMicrometres: number; readonly value: number; readonly error: number }
export interface DiscBandColorRecord {
  readonly objectId: string;
  readonly source: { readonly citation: string; readonly url: string; readonly locator: string };
  readonly unit: string;
  /** Red, green, blue: the longest wavelength first. */
  readonly bands: readonly [DiscBand, DiscBand, DiscBand];
  readonly displayRange: readonly [number, number];
  readonly displayRangeSource: string;
}
export interface DiscBandColor { readonly srgb: readonly [number, number, number]; readonly linear: readonly [number, number, number]; readonly display: BandColorDisplay }

/** Validate the cited record down to the numbers the colour uses, and name the field and value of anything refused. */
export function parseDiscBandColorRecord(value: unknown, path = 'disc band colour record'): DiscBandColorRecord {
  const record = requireRecord(value, path);
  if (record.schema !== DISC_BAND_COLOR_SCHEMA) throw new TypeError(`${path}: schema is ${String(record.schema)}, not ${DISC_BAND_COLOR_SCHEMA}.`);
  const source = requireRecord(record.source, `${path} source`);
  const bands = requireArray(record.bands, `${path} bands`).map((entry, index) => {
    const band = requireRecord(entry, `${path} bands[${index}]`);
    const parsed = { band: requireString(band.band, `${path} bands[${index}].band`), wavelengthMicrometres: requireFiniteNumber(band.wavelengthMicrometres, `${path} bands[${index}].wavelengthMicrometres`),
      value: requireFiniteNumber(band.value, `${path} bands[${index}].value`), error: requireFiniteNumber(band.error, `${path} bands[${index}].error`) };
    if (!(parsed.value > 0) || !(parsed.error >= 0)) throw new TypeError(`${path}: ${parsed.band} needs a positive value and a non-negative error, not ${parsed.value} ± ${parsed.error}.`);
    return parsed;
  });
  if (bands.length !== 3) throw new TypeError(`${path}: a band colour binds three bands, not ${bands.length}.`);
  if (!(bands[0]!.wavelengthMicrometres > bands[1]!.wavelengthMicrometres && bands[1]!.wavelengthMicrometres > bands[2]!.wavelengthMicrometres))
    throw new TypeError(`${path}: bands must run red, green, blue from the longest wavelength, not ${bands.map(band => `${band.band} ${band.wavelengthMicrometres} µm`).join(', ')}.`);
  const range = requireArray(record.displayRange, `${path} displayRange`).map((entry, index) => requireFiniteNumber(entry, `${path} displayRange[${index}]`));
  if (range.length !== 2 || range[0] !== 0 || !(range[1]! > 0)) throw new TypeError(`${path}: displayRange must run from zero flux to a positive top, not [${range.join(', ')}].`);
  for (const band of bands) if (band.value > range[1]!) throw new TypeError(`${path}: ${band.band} ${band.value} is above the common range's top ${range[1]}; the range must hold every value it names.`);
  return { objectId: requireString(record.objectId, `${path} objectId`), unit: requireString(record.unit, `${path} unit`),
    source: { citation: requireString(source.citation, `${path} source.citation`), url: requireString(source.url, `${path} source.url`), locator: requireString(source.locator, `${path} source.locator`) },
    bands: [bands[0]!, bands[1]!, bands[2]!], displayRange: [range[0]!, range[1]!], displayRangeSource: requireString(record.displayRangeSource, `${path} displayRangeSource`) };
}

/** The colour: each flux density over the common range, sRGB-encoded once. */
export function discBandColor(record: DiscBandColorRecord): DiscBandColor {
  const display = bandColorDisplay(record.bands.map(band => band.band), 'flux-density', record.displayRange);
  const linear = record.bands.map(band => (band.value - record.displayRange[0]) / (record.displayRange[1] - record.displayRange[0])) as [number, number, number];
  const srgb = record.bands.map(band => bandColorByte(band.value, display)) as [number, number, number];
  return { srgb, linear, display };
}

export async function loadDiscBandColor(read: (path: string) => Promise<Buffer>, sourcePath: string): Promise<DiscBandColor & { readonly record: DiscBandColorRecord }> {
  const record = parseDiscBandColorRecord(JSON.parse((await read(sourcePath)).toString('utf8')) as unknown, sourcePath);
  return { ...discBandColor(record), record };
}
