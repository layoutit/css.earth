/** Published solar-neighborhood mMMP spectrum -> fixed optical mean intensity; offline preparation only. */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { hg, type Vec } from './types.mts';

export const ISRF_SOURCE_URL = 'https://www.astro.princeton.edu/~draine/PAHspec/mMMP/isrf_mmpisrf_0.00.gz';
export const ISRF_WAVELENGTH_MICRON: Vec = [.805, .537, .436]; // Display-channel order I/V/B, matching Pleiades stars.
export const ISRF_RADIANCE_UNIT = 1e-8; // W m^-2 sr^-1 nm^-1, the model linear radiance unit.
const ROOT = `${resolve('src/objects/milky-way-pleiades-dust/source/inputs/isrf')}/`, SOURCE_PATH = `${ROOT}isrf-mmpisrf_0.00.gz`, RECORD_PATH = `${ROOT}optical-field.json`;
const C = 299792458, H = 6.62607015e-34, K = 1.380649e-23;
const SCHEMA = 'pleiades-wide-optical-isrf@1';
interface SpectrumRow { wavelengthMicron: number; lambdaULambdaErgCm3: number }
interface Spectrum { rows: SpectrumRow[]; uTotalErgCm3: number; uStarlightErgCm3: number; U: number }
export interface IsrfMetadata {
  schema: typeof SCHEMA;
  model: string;
  sourceUrl: string;
  paperUrl: string;
  wavelengthMicron: Vec;
  channelOrder: string[];
  jWm2SrNm: Vec;
  jModelRadiance: Vec;
  radianceUnitWm2SrNm: number;
  uStarlightErgCm3: number;
  sourceUnits: string;
  conversion: string;
  scatteringSource: string;
  assumptions: string[];
  checks: Record<string, unknown>;
}
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
function require(condition: boolean, message: string): void { if (!condition) throw Error(message); }
function vector(value: unknown, name: string): Vec {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(finite)) throw Error(`Invalid ${name}`);
  return [value[0]!, value[1]!, value[2]!];
}
function parseSpectrum(text: string): Spectrum {
  require(text.includes('lambda*u_lambda') && text.includes('(erg cm-3)') && text.includes('(um)'), 'Published spectrum units/header changed.');
  const lines = text.split(/\r?\n/u), rows: SpectrumRow[] = [];
  const header = (label: string) => { const line = lines.find(line => line.includes(label)); if (!line) throw Error(`Source lacks ${label}`); const value = Number(line.trim().split(/\s+/u)[0]); require(Number.isFinite(value) && value > 0, `Invalid ${label}`); return value; };
  for (const line of lines) {
    const m = /^\s*([\d.Ee+\-]+)\s+([\d.Ee+\-]+)\s*$/u.exec(line); if (!m) continue;
    const wavelengthMicron = Number(m[1]), lambdaULambdaErgCm3 = Number(m[2]);
    require(Number.isFinite(wavelengthMicron) && wavelengthMicron > 0 && Number.isFinite(lambdaULambdaErgCm3) && lambdaULambdaErgCm3 >= 0, 'Invalid tabulated ISRF sample.');
    rows.push({ wavelengthMicron, lambdaULambdaErgCm3 });
  }
  require(rows.length === 2500 && rows[0]!.wavelengthMicron === .0912 && rows.at(-1)!.wavelengthMicron === 8000, 'Published 2500-point ISRF wavelength grid changed.');
  require(rows.every((row, i) => i === 0 || row.wavelengthMicron > rows[i - 1]!.wavelengthMicron), 'ISRF wavelengths are not increasing.');
  const U = header('= U (heating rate factor)'), uTotalErgCm3 = header('= u( h nu'), uStarlightErgCm3 = header('= u_starlight');
  require(U === 1 && uStarlightErgCm3 === 1.043e-12 && uTotalErgCm3 === 1.460e-12, 'Unexpected normalization of the fixed published mMMP spectrum.');
  return { rows, U, uTotalErgCm3, uStarlightErgCm3 };
}
function interpolateSpectrum(rows: SpectrumRow[], wavelengthMicron: number): number {
  require(wavelengthMicron >= rows[0]!.wavelengthMicron && wavelengthMicron <= rows.at(-1)!.wavelengthMicron, 'ISRF requested outside the published spectrum.');
  let a = 0, b = rows.length - 1;
  while (b - a > 1) { const middle = (a + b) >>> 1; if (rows[middle]!.wavelengthMicron < wavelengthMicron) a = middle; else b = middle; }
  const low = rows[a]!, high = rows[b]!, t = Math.log(wavelengthMicron / low.wavelengthMicron) / Math.log(high.wavelengthMicron / low.wavelengthMicron);
  require(low.lambdaULambdaErgCm3 > 0 && high.lambdaULambdaErgCm3 > 0, 'Cannot logarithmically interpolate a zero-energy optical bin.');
  return Math.exp((1 - t) * Math.log(low.lambdaULambdaErgCm3) + t * Math.log(high.lambdaULambdaErgCm3));
}
/** lambda*u_lambda[erg/cm^3] -> J_lambda[W/m^2/sr/nm], via u_lambda=4*pi*J_lambda/c. */
function meanIntensitySI(lambdaULambdaErgCm3: number, wavelengthMicron: number): number {
  return C / (4 * Math.PI) * (lambdaULambdaErgCm3 * .1) / (wavelengthMicron * 1000);
}
function dilutedBlackbodySI(wavelengthMicron: number): number {
  const wavelengthM = wavelengthMicron * 1e-6;
  let sum = 0;
  // Published mMMP parameters: Draine2011 Table12.1 and Draine etal2021 section2.1.
  for (const [temperature, dilution] of [[3000, 7e-13], [4000, 1.65e-13], [7500, 1e-14]])
    sum += dilution! * 2 * H * C * C / (wavelengthM ** 5 * Math.expm1(H * C / (wavelengthM * K * temperature!))) * 1e-9;
  return sum;
}
function energyIntegral(rows: SpectrumRow[], maximumMicron: number): number {
  let sum = 0;
  for (let i = 1; i < rows.length; i++) {
    const a = rows[i - 1]!, b = rows[i]!; if (a.wavelengthMicron >= maximumMicron) break;
    const end = Math.min(maximumMicron, b.wavelengthMicron), q = end === b.wavelengthMicron ? b.lambdaULambdaErgCm3 : interpolateSpectrum(rows, end);
    sum += .5 * (a.lambdaULambdaErgCm3 + q) * Math.log(end / a.wavelengthMicron);
  }
  return sum;
}
function simpson(f: (x: number) => number, a: number, b: number, intervals: number): number {
  require(intervals % 2 === 0, 'Simpson quadrature needs an even interval count.');
  const step = (b - a) / intervals; let sum = f(a) + f(b);
  for (let i = 1; i < intervals; i++) sum += f(a + i * step) * (i % 2 ? 4 : 2);
  return sum * step / 3;
}
function numericalChecks(spectrum: Spectrum, jWm2SrNm: Vec): Record<string, unknown> {
  const integratedStarlight = energyIntegral(spectrum.rows, 100), integratedTotal = energyIntegral(spectrum.rows, 8000);
  const stellarEnergyRelativeError = Math.abs(integratedStarlight / spectrum.uStarlightErgCm3 - 1), totalEnergyRelativeError = Math.abs(integratedTotal / spectrum.uTotalErgCm3 - 1);
  // The author's tabulated spectrum integrates0.52% above its stated starlight header. Preserve it, do not refit/rescale.
  require(stellarEnergyRelativeError < .01 && totalEnergyRelativeError < .002, `Tabulated ISRF normalization discrepancy: starlight=${integratedStarlight}/${spectrum.uStarlightErgCm3}, total=${integratedTotal}/${spectrum.uTotalErgCm3}.`);
  const opticalShape = ISRF_WAVELENGTH_MICRON.map((wave, c) => {
    const analytic = dilutedBlackbodySI(wave), relativeError = Math.abs(jWm2SrNm[c]! / analytic - 1);
    require(relativeError < .002, 'Optical table does not reproduce the published mMMP diluted-blackbody shape/normalization.');
    const q = interpolateSpectrum(spectrum.rows, wave), independentlyInCgs = C * 100 / (4 * Math.PI) * q / wave * 1e-6;
    require(Math.abs(independentlyInCgs / jWm2SrNm[c]! - 1) < 1e-12, 'cgs/SI/per-micron/per-nm conversion is inconsistent.');
    return { wavelengthMicron: wave, tableJ_Wm2srNm: jWm2SrNm[c], analyticJ_Wm2srNm: analytic, relativeError };
  });
  const phaseIntegrals = [0, .4369642659, .5415102086, .5661675121, .74].map(g => {
    const integral = 2 * Math.PI * simpson(mu => hg(mu, g), -1, 1, 8192);
    require(Math.abs(integral - 1) < 1e-8, 'Normalized HG does not integrate to one over isotropic illumination.');
    return { g, integral };
  });
  const jInternal: Vec = [jWm2SrNm[0] / ISRF_RADIANCE_UNIT, jWm2SrNm[1] / ISRF_RADIANCE_UNIT, jWm2SrNm[2] / ISRF_RADIANCE_UNIT];
  const extinctionRatio: Vec = [.5661236548558769, 1, 1.2754697849292016], albedo: Vec = [.6537290858725762, .6771989529652352, .6651649758454107];
  const slab = [0, .01, .1, 1, 3].map(tauV => {
    let maximumRelativeError = 0;
    for (let c = 0; c < 3; c++) {
      const tau = tauV * extinctionRatio[c]!, exact = albedo[c]! * jInternal[c]! * -Math.expm1(-tau), count = 4096, dt = tau / count;
      let numerical = 0; for (let i = 0; i < count; i++) numerical += albedo[c]! * jInternal[c]! * dt * Math.exp(-(i + .5) * dt);
      if (tau === 0) require(numerical === 0 && exact === 0, 'Zero dust generated ISRF light.');
      else maximumRelativeError = Math.max(maximumRelativeError, Math.abs(numerical / exact - 1));
    }
    require(maximumRelativeError < 1e-7, 'Outgoing-attenuated ISRF slab fails its analytic transport check.'); return { tauV, maximumRelativeError };
  });
  return { success: true, sourceRows: spectrum.rows.length, integratedStarlightErgCm3Below100um: integratedStarlight, publishedStarlightErgCm3: spectrum.uStarlightErgCm3, stellarEnergyRelativeError,
    energyHeaderDifference: 'As-published table integrates0.52% above its stated starlight header. No amplitude renormalization applied; source-level1% agreement tolerance, not a fitted value.',
    integratedTotalErgCm3Through8000um: integratedTotal, publishedTotalIncludingCmbErgCm3: spectrum.uTotalErgCm3, totalEnergyRelativeError, opticalShape, phaseIntegrals, outgoingSlab: slab,
    zeroDensityZeroLight: true, zeroIlluminationZeroLight: true, isotropicSourceHasNoAdditional4pi: true };
}

function parseMetadata(value: unknown): IsrfMetadata {
  if (!record(value) || value.schema !== SCHEMA || value.sourceUrl !== ISRF_SOURCE_URL || value.radianceUnitWm2SrNm !== ISRF_RADIANCE_UNIT || typeof value.model !== 'string' || typeof value.paperUrl !== 'string' || typeof value.sourceUnits !== 'string' || typeof value.conversion !== 'string' || typeof value.scatteringSource !== 'string' || !record(value.checks) || value.checks.success !== true) throw Error('Invalid prepared optical ISRF.');
  const wavelengthMicron = vector(value.wavelengthMicron, 'wavelengths'), jWm2SrNm = vector(value.jWm2SrNm, 'physical mean intensity'), jModelRadiance = vector(value.jModelRadiance, 'Pleiades mean intensity');
  require(wavelengthMicron.every((wave, i) => wave === ISRF_WAVELENGTH_MICRON[i]) && jWm2SrNm.every((j, i) => j > 0 && jModelRadiance[i]! > 0 && Math.abs(jModelRadiance[i]! * ISRF_RADIANCE_UNIT / j - 1) < 1e-12), 'ISRF channel units/order changed.');
  if (!Array.isArray(value.channelOrder) || !value.channelOrder.every(v => typeof v === 'string') || !Array.isArray(value.assumptions) || !value.assumptions.every(v => typeof v === 'string') || !finite(value.uStarlightErgCm3)) throw Error('Malformed ISRF description.');
  return { schema: SCHEMA, model: value.model, sourceUrl: value.sourceUrl, paperUrl: value.paperUrl, wavelengthMicron, channelOrder: value.channelOrder, jWm2SrNm, jModelRadiance, radianceUnitWm2SrNm: ISRF_RADIANCE_UNIT, uStarlightErgCm3: value.uStarlightErgCm3,
    sourceUnits: value.sourceUnits, conversion: value.conversion, scatteringSource: value.scatteringSource, assumptions: value.assumptions, checks: value.checks };
}
/** Fixed I/V/B J_lambda in Pleiades units of1e-8 W/m2/sr/nm. No network or source fitting. */
export async function loadIsrf(): Promise<Vec> { const value = await loadIsrfMetadata(); return [...value.jModelRadiance]; }
/** Use this SI helper when adding the field to the older physical-W/m2/sr/nm regional bake. */
export async function loadIsrfSI(): Promise<Vec> { const value = await loadIsrfMetadata(); return [...value.jWm2SrNm]; }
export async function loadIsrfMetadata(): Promise<IsrfMetadata> { return parseMetadata(JSON.parse(await readFile(RECORD_PATH, 'utf8'))); }
/** rhoV is V optical depth per pc. Result is radiance per pc in the same units as supplied J. */
export function isrfSourcePerPc(rhoV: number, extinctionRatio: Vec, albedo: Vec, J: Vec): Vec {
  require(finite(rhoV) && rhoV >= 0 && extinctionRatio.every(v => finite(v) && v >= 0) && albedo.every(v => finite(v) && v >= 0 && v <= 1) && J.every(v => finite(v) && v >= 0), 'Invalid diffuse scattering source input.');
  return [rhoV * extinctionRatio[0] * albedo[0] * J[0], rhoV * extinctionRatio[1] * albedo[1] * J[1], rhoV * extinctionRatio[2] * albedo[2] * J[2]];
}
async function prepare(): Promise<void> {
  let bytes: Buffer;
  try { bytes = await readFile(SOURCE_PATH); }
  catch (error: unknown) {
    if (!record(error) || error.code !== 'ENOENT') throw error;
    const response = await fetch(ISRF_SOURCE_URL, { signal: AbortSignal.timeout(30_000) }); if (!response.ok) throw Error(`Published ISRF download ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer()); require(bytes.length < 100_000, 'Unexpected ISRF source size.'); await writeFile(SOURCE_PATH, bytes);
  }
  const text = gunzipSync(bytes, { maxOutputLength: 500_000 }).toString('utf8'), spectrum = parseSpectrum(text);
  const jWm2SrNm: Vec = [0, 0, 0];
  for (let c = 0; c < 3; c++) jWm2SrNm[c] = meanIntensitySI(interpolateSpectrum(spectrum.rows, ISRF_WAVELENGTH_MICRON[c]!), ISRF_WAVELENGTH_MICRON[c]!);
  const checks = numericalChecks(spectrum, jWm2SrNm), metadata: IsrfMetadata = {
    schema: SCHEMA, model: 'Draine etal2021 modified Mathis-Mezger-Panagia solar-neighborhood starlight field, U=1', sourceUrl: ISRF_SOURCE_URL,
    paperUrl: 'https://doi.org/10.3847/1538-4357/abff51', wavelengthMicron: [...ISRF_WAVELENGTH_MICRON], channelOrder: ['I (red display lane)', 'V (green display lane)', 'B (blue display lane)'],
    jWm2SrNm, jModelRadiance: [jWm2SrNm[0] / ISRF_RADIANCE_UNIT, jWm2SrNm[1] / ISRF_RADIANCE_UNIT, jWm2SrNm[2] / ISRF_RADIANCE_UNIT], radianceUnitWm2SrNm: ISRF_RADIANCE_UNIT, uStarlightErgCm3: spectrum.uStarlightErgCm3,
    sourceUnits: 'lambda[um],lambda*u_lambda[erg/cm3]; source includes CMB, negligible at requested optical wavelengths',
    conversion: 'J_lambda[W/m2/sr/nm]=c/(4*pi)*(lambda*u_lambda[erg/cm3]*0.1)/(lambda[um]*1000); Pleiades units divide by1e-8',
    scatteringSource: 'j_lambda per pc=rhoV[1/pc]*Cext(lambda)/CextV*albedo(lambda)*J_lambda; isotropic incident intensity and unit-normalized HG integrate to J with no extra4pi factor; propagate exp(-tauOutgoing(lambda))',
    assumptions: ['Published mMMP model adopted uniformly and isotropically over this regional model; not a measured local angular field at the Pleiades', 'Use the same fixed U=1 amplitude and spectrum everywhere; no per-position color or ambient floor', 'Single optical scattering; outgoing extinction mandatory', 'Uniform isotropic boundary intensity; the transport applies its declared incoming shielding.', 'CMB and thermal infrared emission do not contribute measurable B/V/I illumination here', 'Three monochromatic optical samples, not integrated filter/colorimetric photometry'], checks,
  };
  require(isrfSourcePerPc(0, [1, 1, 1], [1, 1, 1], metadata.jModelRadiance).every(v => v === 0), 'Zero density source check failed.');
  require(isrfSourcePerPc(1, [1, 1, 1], [1, 1, 1], [0, 0, 0]).every(v => v === 0), 'Zero illumination source check failed.');
  await writeFile(`${ROOT}isrf-mmpisrf_0.00.txt`, text);
  await writeFile(RECORD_PATH, JSON.stringify({ ...metadata, sourceBytes: bytes.length, sourceDescription: 'Author-hosted tabulation linked by PAHspec.html, file isrf_mmpisrf_0.00.gz', sourcePageUrl: 'https://www.astro.princeton.edu/~draine/PAHspec/PAHspec.html', modifications: 'mMMP raises3000K dilution4e-13to7e-13 and4000K dilution1e-13to1.65e-13;7500K stays1e-14', generator: 'packages/bake/authoring/m45/dust/physics/isrf.mts' }, null, 2) + '\n');
  const replay = await loadIsrf(); require(replay.every((v, i) => v === metadata.jModelRadiance[i]), 'Prepared ISRF replay changed values.');
  console.log(JSON.stringify({ success: true, signal: 'WIDE_ISRF_READY', sourceBytes: bytes.length, sourceRows: spectrum.rows.length, wavelengthMicron: ISRF_WAVELENGTH_MICRON, jWm2SrNm, jModelRadiance: replay, checks }));
}
if (import.meta.main) { require(process.argv.length === 2, 'Run this module from the repository root without arguments.'); await prepare(); }
