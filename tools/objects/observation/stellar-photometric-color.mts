// A uniform photosphere colour from a star's catalogued photometric effective temperature: a Planck spectrum at that
// temperature through the CIE 1931 2° observer into sRGB (D65 white), scaled so the brightest linear channel is 1. A
// self-luminous disc shows chromaticity only; its brightness and spectral lines are not modelled. Limb darkening is drawn only where
// a measurement gives it (below).
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
  const limbDarkening = science.limbDarkening === undefined ? null : await (async () => {
    const recipe = parseLimbDarkeningRecipe(science.limbDarkening);
    return { recipe, coefficients: readQuadraticLimbDarkening((await read(recipe.path)).toString('utf8'), recipe) };
  })();
  return { temperature, color: planckColor(temperature.kelvin, colorMatching), limbDarkening,
    range: [planckColor(temperature.lowerKelvin, colorMatching), planckColor(temperature.upperKelvin, colorMatching)] as const };
}

// Limb darkening measured from a transiting planet: the planet crosses the disc and the depth of the transit at each point measures
// the star's intensity there. A quadratic law gives I(mu) / I(1) = 1 - u1 (1 - mu) - u2 (1 - mu)^2, with mu the cosine of the angle
// from the disc centre. The emissive route draws it as a limb plate: black, fitted edge to edge to the sphere's outline and composited
// over it, so its alpha scales the displayed colour. Compositing happens on sRGB-encoded values, so the alpha is chosen for the
// displayed luminance of the photosphere colour at each intensity ratio, not the linear ratio itself.
export interface LimbDarkeningRecipe {
  readonly law: 'quadratic'; readonly path: string; readonly star: string;
  readonly columns: { readonly u1: string; readonly u2: string; readonly u1Upper: string; readonly u1Lower: string; readonly u2Upper: string; readonly u2Lower: string };
}
export interface QuadraticLimbDarkening { readonly u1: number; readonly u2: number; readonly u1Bounds: readonly [number, number]; readonly u2Bounds: readonly [number, number] }

export function parseLimbDarkeningRecipe(value: unknown): LimbDarkeningRecipe {
  const input = requireRecord(value, 'limbDarkening');
  if (input.law !== 'quadratic') throw new TypeError('Limb darkening must name the quadratic law.');
  const columns = requireRecord(input.columns, 'limbDarkening.columns');
  const column = (name: string) => requireString(columns[name], `limbDarkening.columns.${name}`);
  return { law: 'quadratic', path: requireString(input.path, 'limbDarkening.path'), star: requireString(input.star, 'limbDarkening.star'),
    columns: { u1: column('u1'), u2: column('u2'), u1Upper: column('u1Upper'), u1Lower: column('u1Lower'), u2Upper: column('u2Upper'), u2Lower: column('u2Lower') } };
}

/** The coefficients for one star from a VizieR tab-separated table: a header row, a dashed rule, then data rows. Upper and lower
 * columns are distances from the value (68% credibility), as the catalogue gives them. */
export function readQuadraticLimbDarkening(tsv: string, recipe: LimbDarkeningRecipe): QuadraticLimbDarkening {
  const lines = tsv.split(/\r?\n/u).filter(line => line.trim() && !/^-+(\t-+)*$/u.test(line.trim()));
  const [header, ...rows] = lines.map(line => line.split('\t').map(cell => cell.trim()));
  if (!header) throw new TypeError('The limb-darkening table is empty.');
  const index = (name: string) => { const i = header.indexOf(name); if (i < 0) throw new TypeError(`The limb-darkening table lacks ${name}.`); return i; };
  const matches = rows.filter(row => row[index('Name')] === recipe.star);
  if (matches.length !== 1) throw new TypeError(`The limb-darkening table must hold exactly one row for ${recipe.star}.`);
  const read = (name: string) => requireFiniteNumber(Number(matches[0]![index(name)]), name);
  const u1 = read(recipe.columns.u1), u2 = read(recipe.columns.u2);
  const coefficients = { u1, u2, u1Bounds: [u1 - read(recipe.columns.u1Lower), u1 + read(recipe.columns.u1Upper)] as const, u2Bounds: [u2 - read(recipe.columns.u2Lower), u2 + read(recipe.columns.u2Upper)] as const };
  if (!(quadraticIntensity(0, u1, u2) >= 0 && quadraticIntensity(0, u1, u2) <= 1)) throw new TypeError('The limb-darkening law must keep the limb between dark and the centre brightness.');
  return coefficients;
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
