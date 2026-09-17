// A uniform photosphere colour for a star with no image: its measured Gaia XP spectrum where one is published, otherwise a Planck
// spectrum at its catalogued photometric effective temperature, through the CIE 1931 2° observer into sRGB (D65 white), scaled so
// the brightest linear channel is 1. A self-luminous disc shows chromaticity only; its brightness is not modelled. Limb darkening is
// drawn only where a measurement gives it (below).
import { requireFiniteNumber, requireRecord, requireString } from '../../source-values.mts';
import { linearToSrgb } from '../color-transfer.mts';

export type StellarColorRecord = {
  readonly spectrum: 'planck'; readonly temperaturePath: string; readonly sourceId: string;
  readonly columns: { readonly value: string; readonly lower: string; readonly upper: string };
} | { readonly spectrum: 'gaia-xp-sampled'; readonly spectrumPath: string; readonly sourceId: string };
export interface StellarTemperature { readonly kelvin: number; readonly lowerKelvin: number; readonly upperKelvin: number }
export interface StellarColor { readonly linear: readonly [number, number, number]; readonly srgb: readonly [number, number, number] }

export function parseStellarColorRecord(value: unknown): StellarColorRecord {
  const input = requireRecord(value, 'stellar colour record');
  if (input.schema !== 'cssearth-stellar-photometric-color@1') throw new TypeError('The stellar colour record must use cssearth-stellar-photometric-color@1.');
  const integer = (id: string) => { if (!/^\d+$/u.test(id)) throw new TypeError('The catalogue source id must be an integer string.'); return id; };
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

/** Spectral power at each wavelength (nm) through the observer into sRGB, brightest linear channel 1. */
function spectrumColor(wavelengths: readonly number[], power: (wavelength: number) => number, colorMatching: Map<number, readonly number[]>, label: string): StellarColor {
  const xyz = [0, 0, 0];
  for (const wavelength of wavelengths) {
    const observer = colorMatching.get(wavelength);
    if (!observer) throw new TypeError(`The CIE table must cover ${wavelength} nm.`);
    const value = power(wavelength);
    for (let channel = 0; channel < 3; channel++) xyz[channel] += value * observer[channel]!;
  }
  const raw = XYZ_TO_LINEAR_SRGB.map(row => row[0] * xyz[0]! + row[1] * xyz[1]! + row[2] * xyz[2]!);
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
  const rows = lines.slice(1).map(line => /^(\d+),(\d+),([^,]+),([^,]+),"\(([^)]*)\)","\(([^)]*)\)"$/u.exec(line));
  if (rows.some(row => !row)) throw new TypeError('An XP spectrum row does not have the DataLink CSV layout.');
  const matches = rows.filter(row => row![1] === sourceId);
  if (matches.length !== 1) throw new TypeError(`The XP spectrum table must hold exactly one row for source ${sourceId}.`);
  const list = (text: string) => text.split(',').map(value => requireFiniteNumber(Number(value), 'XP sample'));
  const flux = list(matches[0]![5]!), fluxError = list(matches[0]![6]!);
  if (flux.length !== XP_SAMPLED_WAVELENGTHS_NM.length || fluxError.length !== flux.length) throw new TypeError(`An XP sampled spectrum has ${XP_SAMPLED_WAVELENGTHS_NM.length} samples.`);
  return { flux, fluxError };
}

/** The colour of a measured spectrum: its samples at the even wavelengths from 380 to 780 nm through the observer, as the Planck
 * colour takes every nanometre. The samples are 2 nm apart, so the odd wavelengths add nothing a finer grid would change. */
export function xpSampledColor(flux: readonly number[], colorMatching: Map<number, readonly number[]>): StellarColor {
  const index = (wavelength: number) => (wavelength - 336) / 2;
  const wavelengths = XP_SAMPLED_WAVELENGTHS_NM.filter(wavelength => wavelength >= 380 && wavelength <= 780);
  if (wavelengths.some(wavelength => !(flux[index(wavelength)]! > 0))) throw new TypeError('The XP spectrum must be positive across the visible range.');
  return spectrumColor(wavelengths, wavelength => flux[index(wavelength)]!, colorMatching, 'The XP spectrum colour');
}

export async function loadStellarPhotometricColor(read: (path: string) => Promise<Buffer>, science: Record<string, unknown>, sourcePath: string) {
  const record = parseStellarColorRecord(JSON.parse((await read(sourcePath)).toString('utf8')));
  const { parseCieTable } = await import('./disc-integrated-color.mts');
  const colorMatching = parseCieTable((await read(requireString(science.colorMatching, 'science.colorMatching'))).toString('utf8'), 3);
  const limbDarkening = science.limbDarkening === undefined ? null : await (async () => {
    const recipe = parseLimbDarkeningRecipe(science.limbDarkening);
    if (recipe.source === 'table') return { recipe, coefficients: readQuadraticLimbDarkening((await read(recipe.path)).toString('utf8'), recipe) };
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
    return { temperature: null, spectrum: { samples: spectrum.flux.length }, color: xpSampledColor(spectrum.flux, colorMatching), limbDarkening,
      // The colours of the spectrum one standard error fainter and brighter at every sample, a bound on what the noise can move. A faint
      // red dwarf's bluest samples are within their errors of zero; the fainter spectrum stops at zero there rather than going negative.
      range: [xpSampledColor(spectrum.flux.map((value, i) => Math.max(Number.MIN_VALUE, value - spectrum.fluxError[i]!)), colorMatching),
        xpSampledColor(spectrum.flux.map((value, i) => value + spectrum.fluxError[i]!), colorMatching)] as const };
  }
  const temperature = readStellarTemperature((await read(record.temperaturePath)).toString('utf8'), record);
  return { temperature, spectrum: null, color: planckColor(temperature.kelvin, colorMatching), limbDarkening,
    range: [planckColor(temperature.lowerKelvin, colorMatching), planckColor(temperature.upperKelvin, colorMatching)] as const };
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
};
export interface QuadraticLimbDarkening { readonly u1: number; readonly u2: number; readonly u1Bounds: readonly [number, number]; readonly u2Bounds: readonly [number, number] }

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
  const columns = requireRecord(input.columns, 'limbDarkening.columns');
  const column = (name: string) => requireString(columns[name], `limbDarkening.columns.${name}`);
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
