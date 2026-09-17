// A uniform photosphere colour from a star's catalogued photometric effective temperature: a Planck spectrum at that
// temperature through the CIE 1931 2° observer into sRGB (D65 white), scaled so the brightest linear channel is 1. A
// self-luminous disc shows chromaticity only; its brightness, limb darkening and spectral lines are not modelled.
import { requireFiniteNumber, requireRecord, requireString } from '../../source-values.mts';
import { linearToSrgb } from '../color-transfer.mts';

export interface StellarColorRecord {
  readonly temperaturePath: string; readonly sourceId: string;
  readonly columns: { readonly value: string; readonly lower: string; readonly upper: string };
}
export interface StellarTemperature { readonly kelvin: number; readonly lowerKelvin: number; readonly upperKelvin: number }
export interface StellarColor { readonly linear: readonly [number, number, number]; readonly srgb: readonly [number, number, number] }

export function parseStellarColorRecord(value: unknown): StellarColorRecord {
  const input = requireRecord(value, 'stellar colour record');
  if (input.schema !== 'cssearth-stellar-photometric-color@1') throw new TypeError('The stellar colour record must use cssearth-stellar-photometric-color@1.');
  const temperature = requireRecord(input.temperature, 'temperature');
  if (input.spectrum !== 'planck') throw new TypeError('The stellar colour record must name the Planck spectrum it applies.');
  const sourceId = requireString(temperature.sourceId, 'temperature.sourceId');
  if (!/^\d+$/u.test(sourceId)) throw new TypeError('The catalogue source id must be an integer string.');
  return { temperaturePath: requireString(temperature.path, 'temperature.path'), sourceId,
    columns: { value: requireString(temperature.column, 'temperature.column'), lower: requireString(temperature.lowerColumn, 'temperature.lowerColumn'),
      upper: requireString(temperature.upperColumn, 'temperature.upperColumn') } };
}

/** Read the temperature and its bounds from the archived catalogue row, by source id. */
export function readStellarTemperature(csv: string, record: StellarColorRecord): StellarTemperature {
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

export function planckColor(kelvin: number, colorMatching: Map<number, readonly number[]>): StellarColor {
  const xyz = [0, 0, 0];
  for (let wavelength = 380; wavelength <= 780; wavelength++) {
    const observer = colorMatching.get(wavelength);
    if (!observer) throw new TypeError(`The CIE table must cover ${wavelength} nm.`);
    const metres = wavelength * 1e-9;
    const radiance = 1 / (metres ** 5 * Math.expm1(PLANCK_H * LIGHT_C / (metres * BOLTZMANN_K * kelvin)));
    for (let channel = 0; channel < 3; channel++) xyz[channel] += radiance * observer[channel]!;
  }
  const raw = XYZ_TO_LINEAR_SRGB.map(row => row[0] * xyz[0]! + row[1] * xyz[1]! + row[2] * xyz[2]!);
  const peak = Math.max(...raw);
  const linear = raw.map(value => value / peak) as [number, number, number];
  if (linear.some(value => value < 0)) throw new TypeError(`A ${kelvin} K Planck colour falls outside the sRGB gamut: ${linear.join(', ')}.`);
  return { linear, srgb: linear.map(value => Math.round(255 * linearToSrgb(value))) as [number, number, number] };
}

export async function loadStellarPhotometricColor(read: (path: string) => Promise<Buffer>, science: Record<string, unknown>, sourcePath: string) {
  const record = parseStellarColorRecord(JSON.parse((await read(sourcePath)).toString('utf8')));
  const temperature = readStellarTemperature((await read(record.temperaturePath)).toString('utf8'), record);
  const { parseCieTable } = await import('./disc-integrated-color.mts');
  const colorMatching = parseCieTable((await read(requireString(science.colorMatching, 'science.colorMatching'))).toString('utf8'), 3);
  return { temperature, color: planckColor(temperature.kelvin, colorMatching),
    range: [planckColor(temperature.lowerKelvin, colorMatching), planckColor(temperature.upperKelvin, colorMatching)] as const };
}
